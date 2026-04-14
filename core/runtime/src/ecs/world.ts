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

import type { World } from '@jamesyong42/reactive-ecs';

/** Alias used across the runtime so consumers don't import reactive-ecs directly. */
export type KernelWorld = World;

/**
 * Create + wire the kernel ECS world. Registers the kernel systems in
 * topological order. Called once from Runtime.start().
 */
export function createKernelWorld(): KernelWorld {
  throw new Error('not implemented: createKernelWorld');
}
