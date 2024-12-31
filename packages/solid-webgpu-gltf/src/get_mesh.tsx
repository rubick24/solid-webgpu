import { Mesh } from 'solid-webgpu'
import { getAccessor } from './get_accessor'
import { getMaterial } from './get_material'
import { LoaderContext } from './types'

export const getMesh = async (index: number, context: LoaderContext) => {
  const json = context.json.meshes?.[index]
  if (!json) {
    throw new Error('gltf mesh not found')
  }
  const _accessor = (i: number) => context.withCache(`accessor_${i}`, () => getAccessor(i, context))
  const _material = (i: number) => context.withCache(`material_${i}`, () => getMaterial(i, context))

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

      const Geo = () => (
        <Geometry>
          {primitive.indices !== undefined ? (
            <IndexBuffer value={_accessor(primitive.indices!).bufferData} />
          ) : undefined}
          {attributeKeys.map((k, i) => {
            const accessor = _accessor(primitive.attributes[k])
            const buffer = accessor.bufferData
            return (
              <VertexBuffer
                value={buffer}
                layout={{
                  arrayStride: accessor.arrayStride,
                  attributes: [
                    {
                      format: accessor.format,
                      offset: 0,
                      shaderLocation: i
                    }
                  ]
                }}
                attribute={{
                  name: k,
                  type: `vec${accessor.itemSize}<${accessor.itemType}>`
                }}
              />
            )
          })}
        </Geometry>
      )

      const Mat = primitive.material !== undefined ? await _material(primitive.material) : DefaultMaterial

      return () => (
        <Mesh label={json.name ?? `gltf mesh ${index}`}>
          <Mat />
          <Geo />
        </Mesh>
      )
    })
  )
}
