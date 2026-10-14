import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { importLegacyData } from './storage';
import './styles/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container #root is missing from index.html');
}

// Copy any pre-rename data across before anything reads storage (FR-69). It
// never throws, so a failure cannot stop the app from starting.
importLegacyData();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
