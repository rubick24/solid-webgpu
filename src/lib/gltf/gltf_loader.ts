import { GlTF } from '../../generated/glTF'
import { parseGLB } from './parse_glb'

const relativeURL = (base: string, target: string) => {
  if (base.lastIndexOf('/') !== -1) {
    return base.slice(0, base.lastIndexOf('/')) + '/' + target
  } else {
    return target
  }
}
export const gltfLoader = async (url: string) => {
  let json: GlTF
  let buffers: ArrayBuffer[]

  if (/\.gltf$/.test(url)) {
    json = (await fetch(url).then(res => res.json())) as GlTF
    if (!json.buffers) {
      throw new Error('glTFLoader: no buffer specified in gltf file')
    }
    buffers = await Promise.all(
      json.buffers.map(buffer => {
        if (!buffer.uri) {
          throw new Error('glTFLoader: buffer.uri not specified')
        }
        const binURL = relativeURL(url, buffer.uri)
        return fetch(binURL).then(res => res.arrayBuffer())
      })
    )
  } else if (/\.glb$/.test(url)) {
    const r = await parseGLB(url)
    json = r[0]
    buffers = r[1]
  } else {
    throw new Error('glTFLoader: file suffix not support')
  }

  // const materials = getMaterials(json, images)
}
