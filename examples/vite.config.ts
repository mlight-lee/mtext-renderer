import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
      },
      output: {
        format: 'es',
      },
    },
  },
  optimizeDeps: {
    include: ['three'],
  },
  worker: {
    format: 'es',
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: './dist/mtext-renderer-worker.js',
          dest: 'assets'
        }
      ]
    })
  ]
});
