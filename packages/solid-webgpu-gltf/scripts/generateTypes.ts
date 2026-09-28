import { writeFileSync } from 'node:fs'
import { compileFromFile } from 'json-schema-to-typescript'

// schema copied from https://github.com/KhronosGroup/glTF/tree/main/specification/2.0/schema
compileFromFile('./scripts/schema/glTF.schema.json', {
  cwd: './scripts/schema',
  ignoreMinAndMaxItems: true,
  style: {
    semi: false,
  },
}).then(ts => writeFileSync('./src/generated/glTF.ts', ts))
