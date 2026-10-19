import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

async function boot() {
  let Root = App;
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('gallery')) {
    Root = (await import('./ui/Gallery')).Gallery;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
void boot();
