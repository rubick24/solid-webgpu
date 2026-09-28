import { readFileSync } from 'node:fs'
import { babel } from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const raw = () => {
  return {
    name: 'raw',
    load(id) {
      if (id.endsWith('?raw')) {
        const content = readFileSync(id.replace('?raw', '')).toString('utf-8')
        return `export default \`${content.replace(/`/g, '\\`')}\``
      }
    },
  }
}

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
  },
  external: ['solid-js', '@solidjs/web'],
  plugins: [
    nodeResolve({
      extensions: ['.js', '.ts', '.tsx'],
    }),
    raw(),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.ts', '.tsx'],
      presets: ['@babel/preset-typescript'],
      plugins: ['@solidjs/babel-plugin'],
    }),
  ],
}
