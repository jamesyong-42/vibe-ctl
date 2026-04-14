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

  /** Run topological sort. Pure function over ECS components at call time. */
  resolve(): ResolverOutput {
    throw new Error('not implemented: DependencyResolver.resolve');
  }

  /** Expose the input for debugging. */
  get input(): Readonly<ResolverInput> {
    return this.#input;
  }
}
