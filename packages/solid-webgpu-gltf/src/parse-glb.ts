import type { GlTF } from './generated/glTF'

const GLB_MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

export const parseGLBData = (data: ArrayBuffer): [GlTF, ArrayBuffer[]] => {
  if (data.byteLength < 20) throw new Error('Invalid GLB: file is too short')
  const view = new DataView(data)
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Invalid GLB magic')
  if (view.getUint32(4, true) !== 2) throw new Error('Only glTF version 2 is supported')

  const declaredLength = view.getUint32(8, true)
  if (declaredLength !== data.byteLength) throw new Error('Invalid GLB length')

  let offset = 12
  let json: GlTF | undefined
  const binaryChunks: ArrayBuffer[] = []
  let chunkIndex = 0
  while (offset < declaredLength) {
    if (offset + 8 > declaredLength) throw new Error('Invalid GLB chunk header')
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    offset += 8
    if (chunkLength % 4 || offset + chunkLength > declaredLength) throw new Error('Invalid GLB chunk length')

    if (chunkType === JSON_CHUNK) {
      if (json || chunkIndex !== 0) throw new Error('GLB JSON must be the first and only JSON chunk')
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, offset, chunkLength))) as GlTF
    } else if (chunkType === BIN_CHUNK) {
      if (!json || binaryChunks.length || chunkIndex !== 1) throw new Error('GLB BIN chunk must be the second chunk')
      binaryChunks.push(data.slice(offset, offset + chunkLength))
    }
    offset += chunkLength
    chunkIndex++
  }

  if (!json) throw new Error('GLB has no JSON chunk')
  return [json, binaryChunks]
}

export const parseGLB = async (url: string): Promise<[GlTF, ArrayBuffer[]]> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load GLB (${response.status}): ${url}`)
  return parseGLBData(await response.arrayBuffer())
}
