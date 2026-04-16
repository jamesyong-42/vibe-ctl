/**
 * Kernel ECS world. Spec 02 §7.
 *
 * The kernel runs its own reactive-ecs world alongside the canvas world.
 * Both share the same reactive-ecs runtime (host-provided singleton) so
 * plugins that register canvas systems use the same library.
 *
 * This world is internal — plugins never query it directly (spec 02 §11.9).
 * The shell and sibling kernel modules use it for reactive queries over
 * plugin state (plugin manager UI, "peers have plugin X" badges, etc).
 */

import { createWorld, type World } from '@jamesyong42/reactive-ecs';

/** Alias used across the runtime so consumers don't import reactive-ecs directly. */
export type KernelWorld = World;

/**
 * Create the kernel ECS world. Returns a fresh reactive-ecs world.
 *
 * Components and tags are registered lazily on first use by reactive-ecs
 * (defineComponent / defineTag just create frozen descriptors; the world
 * lazily allocates storage when addComponent / addTag is first called for
 * a given type). No upfront registration step needed.
 *
 * System scheduling is handled separately via `SystemScheduler` — this
 * factory only creates the raw world. The caller (Runtime.start or tests)
 * wires systems on top.
 */
export function createKernelWorld(): KernelWorld {
  return createWorld();
}
