import { babel } from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { isAbsolute } from 'path'

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
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.ts', '.tsx'],
      presets: ['@babel/preset-typescript']
    })
  ]
}
