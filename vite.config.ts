import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/samsara-proxy': {
          target: 'https://api.samsara.com',
          changeOrigin: true,
          rewrite: () => '/form-submissions/stream',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.VITE_SAMSARA_API_TOKEN}`);
              // Forward query string from original request
              const qs = req.url?.split('?')[1] ?? '';
              proxyReq.path = `/form-submissions/stream${qs ? '?' + qs : ''}`;
            });
          },
        },
        '/api/samsara-drivers': {
          target: 'https://api.samsara.com',
          changeOrigin: true,
          rewrite: () => '/fleet/drivers',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.VITE_SAMSARA_API_TOKEN}`);
              proxyReq.path = '/fleet/drivers';
            });
          },
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
