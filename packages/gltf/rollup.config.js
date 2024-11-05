import { babel } from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { readFileSync } from 'fs'
import { isAbsolute } from 'path'

const raw = () => {
  return {
    name: 'raw',
    load(id) {
      if (id.endsWith('?raw')) {
        const content = readFileSync(id.replace('?raw', '')).toString('utf-8')
        return `export default \`${content.replace(/`/g, '\\`')}\``
      }
    }
  }
}

export default {
  external: id => !(isAbsolute(id) || id.startsWith('.')),
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es'
  },
  plugins: [
    nodeResolve({
      extensions: ['.js', '.ts', '.tsx']
    }),
    raw(),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.ts', '.tsx'],
      presets: [['@babel/preset-typescript', { allowDeclareFields: true }]]
    })
  ]
}
