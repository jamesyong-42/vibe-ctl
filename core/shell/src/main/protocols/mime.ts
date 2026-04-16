/**
 * Minimal MIME-type table for custom protocol handlers.
 *
 * Covers the file types served through `host:` and `plugin:` schemes.
 * Unknown extensions fall back to `application/octet-stream`.
 */

import { extname } from 'node:path';

const MIME_TABLE: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

export function mimeForPath(filePath: string): string {
  return MIME_TABLE[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}
