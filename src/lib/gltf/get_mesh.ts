import { GlTF } from '../../generated/glTF'
import { Geometry } from '../geometry'
import { Mesh } from '../mesh'
import { getAccessor } from './get_accessor'
import { getMaterial, defaultMaterial } from './get_material'

export const getMesh = async (
  index: number,
  context: {
    json: GlTF
    buffers: ArrayBuffer[]
  }
) => {
  const json = context.json.meshes?.[index]
  if (!json) {
    throw new Error('gltf mesh not found')
  }
  return await Promise.all(
    json.primitives.map(async primitive => {
      const attributeKeys = Object.keys(primitive.attributes)

      const geometry = new Geometry({
        indexBuffer:
          primitive.indices !== undefined
            ? {
                buffer: getAccessor(primitive.indices, context).bufferData
              }
            : undefined,
        vertexBuffers: attributeKeys.map((k, i) => {
          const accessor = getAccessor(primitive.attributes[k], context)
          const buffer = accessor.bufferData
          // TODO: correct shaderLocation here
          return {
            layout: {
              arrayStride: accessor.arrayStride,
              attributes: [
                {
                  format: accessor.format,
                  offset: 0,
                  shaderLocation: i
                }
              ]
            },
            buffer
          }
        })
      })

      const material =
        primitive.material !== undefined ? await getMaterial(primitive.material, context) : defaultMaterial
      const mesh = new Mesh(geometry, material)
      mesh.label = json.name ?? `gltf mesh ${index}`
    })
  )
}
