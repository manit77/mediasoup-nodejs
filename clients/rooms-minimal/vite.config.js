import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    open: true
  },
  resolve: {
    alias: {
      '@rooms/rooms-models': path.resolve(__dirname, '../../rooms/rooms-models')
    }
  }
});
