import { existsSync, readdirSync, statSync } from 'node:fs'
import replace from '@rollup/plugin-replace'
import solidPlugin from '@solidjs/vite-plugin'

const examplesPath = './src'

const entries = readdirSync(examplesPath)
  .map(v => {
    let filePath = `${examplesPath}/${v}`
    const isDir = statSync(filePath).isDirectory()
    if (!isDir && v.endsWith('.html')) {
      return [v, filePath]
    } else {
      filePath = `${filePath}/index.html`
      if (existsSync(filePath)) {
        return [v, filePath]
      }
    }
    return undefined
  })
  .filter(v => v)

/** @type {import('vite').UserConfig} */
export default {
  base: '',
  optimizeDeps: {
    exclude: ['solid-webgpu'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        ...entries.reduce((p, c) => {
          p[c[0]] = c[1]
          return p
        }, {}),
      },
    },
  },
  plugins: [
    replace({
      values: {
        _EXAMPLES: `${JSON.stringify(entries)}`,
      },
      preventAssignment: true,
    }),
    solidPlugin(),
  ],
}
