/**
 * Renderer entry. Mounts the React tree and kicks off renderer-side
 * runtime initialisation (canvas engine hookup, IPC channel wiring).
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { bootRenderer } from './boot.js';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('renderer: #root not found in index.html');
}

void bootRenderer();

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
