/**
 * Kernel ECS tags. Spec 02 §7.
 *
 * Tags carry no data; their presence/absence on an entity is the signal.
 * Used by HealthSystem + ActivationScheduler to short-circuit queries.
 */

import { defineTag } from '@jamesyong42/reactive-ecs';

/** User or health system has disabled the plugin. Don't activate. */
export const Disabled = defineTag('Disabled');

/** Plugin has failed — see PluginHealth for details. Needs user action to recover. */
export const Failed = defineTag('Failed');

/** Plugin is installed locally but at a version below one of its peers. */
export const NeedsUpdate = defineTag('NeedsUpdate');

/** Plugin has `eagerActivation: true` in its manifest. */
export const Eager = defineTag('Eager');
