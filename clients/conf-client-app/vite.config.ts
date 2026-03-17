import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
    build: {
    sourcemap: true, // Crucial for DevTools to see the compiled logic
  },
  css: {
    devSourcemap: true
  },
  plugins: [
   react({
      // Vite 8/React Plugin v6 Way:
      // This tells the plugin to use the compiler during the transform phase
      babel: {
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      },
    }),   
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@client': path.resolve(__dirname, './src'),
      '@conf-client': path.resolve(__dirname, '../../conf/conf-client/src'),
      '@rooms-client': path.resolve(__dirname, '../../rooms/rooms-client/src'),
      '@websocket-client': path.resolve(__dirname, '../../libs/websocket-client/src'),
      '@webrtc-client': path.resolve(__dirname, '../../libs/webrtc-client/src'),
      '@conf-models': path.resolve(__dirname, '../../conf/conf-models/src'),
      '@rooms-models': path.resolve(__dirname, '../../rooms/rooms-models/src'),
    },
  },
  server: {
    port: 3000,
    host: '192.168.40.43',
    https: {
      key: '../../certs/localhost-key.pem',
      cert: '../../certs/localhost-fullchain.pem',
    },
  },
});