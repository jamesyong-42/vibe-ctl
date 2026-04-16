/**
 * Privileged scheme registration (spec 05 §7).
 *
 * **CRITICAL**: `protocol.registerSchemesAsPrivileged` MUST be called
 * before `app.whenReady()`. This module is imported for its side effect
 * at the very top of the main entry, before any `app.whenReady` call.
 */

import { protocol } from 'electron';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'host',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
      stream: true,
    },
  },
  {
    scheme: 'plugin',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
      stream: true,
    },
  },
]);
