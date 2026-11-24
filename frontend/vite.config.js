import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * Route fallback plugin:
 * Ensures routes like /billing, /bills, /customers without .html extension work directly
 * on static hosts like Vercel by generating dist/<route>/index.html.
 */
function routeFallbackPlugin() {
  return {
    name: 'route-fallback-plugin',
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist');
      const pages = ['login', 'billing', 'bills', 'products', 'customers', 'customer-ledger', 'reports', 'settings'];

      pages.forEach((page) => {
        const pageHtmlPath = path.join(dist, `${page}.html`);
        if (fs.existsSync(pageHtmlPath)) {
          const content = fs.readFileSync(pageHtmlPath, 'utf8');
          const routeDir = path.join(dist, page);
          if (!fs.existsSync(routeDir)) {
            fs.mkdirSync(routeDir, { recursive: true });
          }
          fs.writeFileSync(path.join(routeDir, 'index.html'), content);
        }
      });

      // 404 fallback
      const indexPath = path.join(dist, 'index.html');
      if (fs.existsSync(indexPath)) {
        fs.writeFileSync(path.join(dist, '404.html'), fs.readFileSync(indexPath, 'utf8'));
      }
      console.log('[Build] Generated multi-page static route directory fallbacks.');
    }
  };
}

export default defineConfig({
  plugins: [routeFallbackPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        login: path.resolve(__dirname, 'login.html'),
        billing: path.resolve(__dirname, 'billing.html'),
        bills: path.resolve(__dirname, 'bills.html'),
        products: path.resolve(__dirname, 'products.html'),
        customers: path.resolve(__dirname, 'customers.html'),
        customerLedger: path.resolve(__dirname, 'customer-ledger.html'),
        reports: path.resolve(__dirname, 'reports.html'),
        settings: path.resolve(__dirname, 'settings.html'),
      }
    }
  },
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
