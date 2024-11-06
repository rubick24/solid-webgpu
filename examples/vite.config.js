import replace from '@rollup/plugin-replace'
import { existsSync, readdirSync, statSync } from 'fs'
import solidPlugin from 'vite-plugin-solid'

const examplesPath = './src'

const entries = readdirSync(examplesPath)
  .map(v => {
    let filePath = examplesPath + '/' + v
    const isDir = statSync(filePath).isDirectory()
    if (!isDir && v.endsWith('.html')) {
      return [v, filePath]
    } else {
      filePath = filePath + '/index.html'
      if (existsSync(filePath)) {
        return [v, filePath]
      }
    }
  })
  .filter(v => v)

/** @type {import('vite').UserConfig} */
export default {
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        ...entries.reduce((p, c) => {
          p[c[0]] = c[1]
          return p
        }, {})
      }
    }
  },
  plugins: [
    replace({
      values: {
        _EXAMPLES: `${JSON.stringify(entries)}`
      },
      preventAssignment: true
    }),
    solidPlugin({
      solid: {
        moduleName: 'solid-webgpu',
        generate: 'universal'
      }
    })
  ]
}
