import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

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
      external: ['three'],
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
})
