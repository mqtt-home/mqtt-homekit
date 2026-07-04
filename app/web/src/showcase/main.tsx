import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Showcase } from './Showcase';
import '@/index.css';

// The cards call the control API on interaction; on this static page we stub
// those requests so the optimistic UI keeps working as a live demo.
const origFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/api/devices/') && url.endsWith('/control')) {
    return Promise.resolve(new Response('{}', { status: 200 }));
  }
  return origFetch(input, init);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Showcase />
    </ThemeProvider>
  </React.StrictMode>,
);
