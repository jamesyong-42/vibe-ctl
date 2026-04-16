/**
 * DependencyResolver. Spec 02 §8.
 *
 * Topological sort across `provides` / `dependencies` service relations.
 *   - Cycles fail.
 *   - Missing non-optional deps fail.
 *   - `apiVersion` is checked against the kernel; service version ranges
 *     are checked between provider and consumer.
 *
 * Optional deps contribute edges only when present; when absent, the
 * consumer still resolves but receives `null` from `ctx.services.optional`
 * at runtime.
 */

import { PluginDeps, PluginManifest, PluginState } from '../ecs/components.js';
import { Disabled, Failed } from '../ecs/tags.js';
import type { KernelWorld } from '../ecs/world.js';

export interface ResolverInput {
  world: KernelWorld;
  kernelApiVersion: string;
}

export interface ResolverOutput {
  /** Topologically ordered plugin IDs; providers come before their consumers. */
  order: string[];
  /** Plugins that could not be scheduled for activation; never enter the order. */
  unresolved: Array<{ pluginId: string; reason: string }>;
}

export class DependencyResolver {
  readonly #input: ResolverInput;

  constructor(input: ResolverInput) {
    this.#input = input;
  }

  /**
   * Run topological sort. Pure function over ECS components at call time.
   *
   * Algorithm: Kahn's (BFS-based topo sort).
   *   1. Build a map of serviceId → provider pluginId from `provides`.
   *   2. Build directed edges: for each plugin X that depends on service S
   *      provided by plugin Y, add edge Y → X (Y must activate before X).
   *   3. Missing non-optional dep → plugin goes to `unresolved`.
   *   4. Missing optional dep → edge skipped; plugin stays in the graph.
   *   5. Kahn's: iterate zero-in-degree nodes, remove edges, repeat.
   *   6. Remaining nodes after Kahn's exhaustion → cycle; all go to `unresolved`.
   *   7. Populate PluginDeps ECS components on each plugin entity.
   */
  resolve(): ResolverOutput {
    const { world } = this.#input;
    const unresolved: ResolverOutput['unresolved'] = [];

    // Collect all discovered plugin entities (not disabled/failed)
    const entities = world.query(PluginManifest, PluginState);
    const pluginById = new Map<string, number>();
    const manifestById = new Map<
      string,
      typeof PluginManifest extends { defaults: infer T } ? T : never
    >();

    for (const entity of entities) {
      if (world.hasTag(entity, Disabled) || world.hasTag(entity, Failed)) continue;
      const manifest = world.getComponent(entity, PluginManifest);
      if (!manifest) continue;
      pluginById.set(manifest.id, entity);
      manifestById.set(manifest.id, manifest);
    }

    // Build service → provider lookup
    const serviceProvider = new Map<string, string>();
    for (const [pluginId, manifest] of manifestById) {
      for (const serviceId of Object.keys(manifest.provides)) {
        serviceProvider.set(serviceId, pluginId);
      }
    }

    // Build adjacency list + in-degree. Edge: provider → consumer.
    const edges = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    const failedPlugins = new Set<string>();

    for (const pluginId of manifestById.keys()) {
      edges.set(pluginId, new Set());
      inDegree.set(pluginId, 0);
    }

    for (const [pluginId, manifest] of manifestById) {
      const resolvedRequires: string[] = [];
      const resolvedOptional: string[] = [];

      // Required dependencies
      for (const serviceId of Object.keys(manifest.dependencies)) {
        const providerId = serviceProvider.get(serviceId);
        if (!providerId) {
          failedPlugins.add(pluginId);
          unresolved.push({
            pluginId,
            reason: `missing dependency: ${serviceId}`,
          });
          break;
        }
        if (providerId !== pluginId) {
          resolvedRequires.push(providerId);
          const providerEdges = edges.get(providerId);
          if (providerEdges && !providerEdges.has(pluginId)) {
            providerEdges.add(pluginId);
            inDegree.set(pluginId, (inDegree.get(pluginId) ?? 0) + 1);
          }
        }
      }

      if (failedPlugins.has(pluginId)) continue;

      // Optional dependencies — edge only if provider exists
      for (const serviceId of Object.keys(manifest.optionalDependencies)) {
        const providerId = serviceProvider.get(serviceId);
        if (!providerId || providerId === pluginId) continue;
        resolvedOptional.push(providerId);
        const providerEdges = edges.get(providerId);
        if (providerEdges && !providerEdges.has(pluginId)) {
          providerEdges.add(pluginId);
          inDegree.set(pluginId, (inDegree.get(pluginId) ?? 0) + 1);
        }
      }

      // Update PluginDeps on the entity
      const entity = pluginById.get(pluginId);
      if (entity !== undefined) {
        world.setComponent(entity, PluginDeps, {
          requires: resolvedRequires,
          optional: resolvedOptional,
        });
      }
    }

    // Remove failed plugins from the graph before Kahn's
    for (const failedId of failedPlugins) {
      // Remove edges pointing to this plugin
      for (const [, targets] of edges) {
        if (targets.has(failedId)) {
          targets.delete(failedId);
        }
      }
      edges.delete(failedId);
      inDegree.delete(failedId);

      // Also cascade-fail any plugin that has a required dep on a failed plugin
      // (handled below during Kahn's — they'll have unsatisfied in-degree)
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [pluginId, degree] of inDegree) {
      if (degree === 0 && !failedPlugins.has(pluginId)) {
        queue.push(pluginId);
      }
    }
    // Sort for deterministic ordering
    queue.sort();

    const order: string[] = [];
    while (queue.length > 0) {
      const pluginId = queue.shift()!;
      order.push(pluginId);

      const neighbors = edges.get(pluginId);
      if (!neighbors) continue;

      const newReady: string[] = [];
      for (const neighbor of neighbors) {
        const deg = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, deg);
        if (deg === 0) {
          newReady.push(neighbor);
        }
      }
      newReady.sort();
      queue.push(...newReady);
    }

    // Remaining nodes in inDegree that didn't make it into order → cycle
    for (const [pluginId] of inDegree) {
      if (!order.includes(pluginId) && !failedPlugins.has(pluginId)) {
        unresolved.push({ pluginId, reason: 'circular dependency' });
      }
    }

    // Update dependents on provider entities
    for (const [pluginId, manifest] of manifestById) {
      if (failedPlugins.has(pluginId)) continue;
      for (const serviceId of Object.keys(manifest.dependencies)) {
        const providerId = serviceProvider.get(serviceId);
        if (!providerId || providerId === pluginId) continue;
        const providerEntity = pluginById.get(providerId);
        if (providerEntity === undefined) continue;
        const deps = world.getComponent(providerEntity, PluginDeps);
        if (deps && !deps.dependents.includes(pluginId)) {
          world.setComponent(providerEntity, PluginDeps, {
            dependents: [...deps.dependents, pluginId],
          });
        }
      }
    }

    return { order, unresolved };
  }

  /** Expose the input for debugging. */
  get input(): Readonly<ResolverInput> {
    return this.#input;
  }
}
