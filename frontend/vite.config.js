import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

/**
 * Vite plugin that generates static fallback HTML files for all client-side routes.
 * This guarantees that reloading on /login, /billing, /customers, etc. never yields
 * a 404 NOT_FOUND error on static hosts like Vercel.
 */
function spaFallbackPlugin() {
  return {
    name: 'spa-fallback-plugin',
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist');
      const indexPath = path.join(dist, 'index.html');
      if (fs.existsSync(indexPath)) {
        const indexHtml = fs.readFileSync(indexPath, 'utf8');
        const routes = ['login', 'billing', 'bills', 'products', 'customers', 'reports', 'settings'];
        routes.forEach((route) => {
          const routeDir = path.join(dist, route);
          if (!fs.existsSync(routeDir)) {
            fs.mkdirSync(routeDir, { recursive: true });
          }
          fs.writeFileSync(path.join(routeDir, 'index.html'), indexHtml);
          fs.writeFileSync(path.join(dist, `${route}.html`), indexHtml);
        });
        fs.writeFileSync(path.join(dist, '404.html'), indexHtml);
        console.log('[Build] Generated SPA route fallbacks for direct URL access and refresh.');
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), spaFallbackPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
