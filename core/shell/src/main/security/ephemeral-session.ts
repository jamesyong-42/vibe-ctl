/**
 * Ephemeral session factory (spec 05 §8.4).
 *
 * Creates a unique, cache-less session partition for detached widget
 * windows. Each session receives the same CSP + permission handlers as
 * the default session (defense-in-depth: a hostile cross-origin
 * navigation that slips past the guard can't drop anything that
 * survives a close).
 *
 * Used by the detached widget window factory (Phase 7).
 */

import { randomUUID } from 'node:crypto';
import { type Session, session } from 'electron';
import { setupSessionSecurity } from './setup.js';

export function createEphemeralSession(): Session {
  const ephemeral = session.fromPartition(`ephemeral-${randomUUID()}`, {
    cache: false,
  });
  setupSessionSecurity(ephemeral);
  return ephemeral;
}
