import { readdirSync, statSync, existsSync } from 'fs'

const examplesPath = './examples'
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
  .reduce((p, c) => {
    p[`example-${c[0]}`] = c[1]
    return p
  }, {})

/** @type {import('vite').UserConfig} */
export default {
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        ...entries
      }
    }
  }
}
