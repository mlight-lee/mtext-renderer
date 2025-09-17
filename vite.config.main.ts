import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MTextRenderer',
      fileName: 'index',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      // Exclude dependencies and the web worker entry from the main bundle
      external: (id) => {
        if (id === 'three') return true;
        // Do not bundle the worker in the main build; it's built by a separate config
        // Handle both POSIX and Windows paths
        return (
          id.endsWith('/src/worker/mtextWorker.ts') ||
          id.endsWith('\\src\\worker\\mtextWorker.ts')
        );
      },
      output: {
        globals: {
          three: 'THREE'
        }
      }
    }
  },
  plugins: [
    dts({
      outDir: 'lib',
      insertTypesEntry: true
    })
  ]
});
