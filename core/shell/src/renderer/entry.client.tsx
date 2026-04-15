/**
 * Renderer entry point. Side-effect imports first (styles, logging,
 * telemetry when it lands), then the provider stack + screen router.
 *
 * Mirrors the Jabali editor's `entry.client.tsx` convention: one
 * small file that reads top-to-bottom as "init everything, then
 * render".
 */

import './styles/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { bootRenderer } from './app/boot.js';
import { Root } from './app/root.js';

const container = document.getElementById('root');
if (!container) {
  throw new Error('renderer: #root not found in index.html');
}

void bootRenderer();

createRoot(container).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
