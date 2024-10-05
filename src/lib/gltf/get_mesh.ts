import { Geometry } from '../geometry'
import { Mesh } from '../mesh'
import { getAccessor } from './get_accessor'
import { getMaterial, defaultMaterial } from './get_material'
import { LoaderContext } from './types'

export const getMesh = async (index: number, context: LoaderContext) => {
  const json = context.json.meshes?.[index]
  if (!json) {
    throw new Error('gltf mesh not found')
  }
  const _accessor = (i: number) => context._cached(`accessor_${i}`, () => getAccessor(i, context))
  const _material = (i: number) => context._cached(`material_${i}`, () => getMaterial(i, context))

  return await Promise.all(
    json.primitives.map(async primitive => {
      const draco = primitive.extensions?.['KHR_draco_mesh_compression'] as {
        bufferView: number
        attributes: Record<string, number>
      }
      if (draco) {
        throw new Error('KHR_draco_mesh_compression not supported')
      }
      const attributeKeys = Object.keys(primitive.attributes)

      const geometry = new Geometry({
        indexBuffer:
          primitive.indices !== undefined
            ? {
                buffer: _accessor(primitive.indices).bufferData
              }
            : undefined,
        vertexBuffers: attributeKeys.map((k, i) => {
          const accessor = _accessor(primitive.attributes[k])
          const buffer = accessor.bufferData
          return {
            attribute: {
              name: k,
              type: `vec${accessor.itemSize}<${accessor.itemType}>`
            },
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

      const mat = primitive.material !== undefined ? await _material(primitive.material) : defaultMaterial
      return new Mesh({ geometry, material: mat, label: json.name ?? `gltf mesh ${index}` })
    })
  )
}
