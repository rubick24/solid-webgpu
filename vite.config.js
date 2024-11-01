import { readdirSync, statSync, existsSync, readFileSync } from 'fs'
import replace from '@rollup/plugin-replace'

const examplesPath = './examples'

const packageJSON = JSON.parse(readFileSync('./package.json'))
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
          p[`example-${c[0]}`] = c[1]
          return p
        }, {})
      }
    }
  },
  plugins: [
    replace({
      values: {
        _PACKAGE_VERSION: `${packageJSON.version}`,
        _EXAMPLES: `${JSON.stringify(entries)}`
      },
      preventAssignment: true
    })
  ]
}
