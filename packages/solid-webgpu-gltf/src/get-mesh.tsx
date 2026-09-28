import { type Accessor, createSignal, untrack } from 'solid-js'
import { createBufferFromValue, device, Mat3, Mat4, Mesh, type MeshRef, type TypedArray } from 'solid-webgpu'
import { getAccessor } from './get-accessor'
import { getMaterial } from './get-material'
import type { LoaderContext } from './types'

type SkinData = { joints: number[]; inverseBindMatrices: Float32Array }
const normalizedComponent = (value: number, type: number) => {
  if (type === 5120) return Math.max(value / 127, -1)
  if (type === 5121) return value / 255
  if (type === 5122) return Math.max(value / 32767, -1)
  if (type === 5123) return value / 65535
  return value
}

const createNormals = (positions: ArrayLike<number>, indices: ArrayLike<number>, mode: number, vertexCount: number) => {
  const normals = new Float32Array(vertexCount * 3)
  const addFace = (a: number, b: number, c: number) => {
    const ax = positions[a * 3],
      ay = positions[a * 3 + 1],
      az = positions[a * 3 + 2]
    const abx = positions[b * 3] - ax,
      aby = positions[b * 3 + 1] - ay,
      abz = positions[b * 3 + 2] - az
    const acx = positions[c * 3] - ax,
      acy = positions[c * 3 + 1] - ay,
      acz = positions[c * 3 + 2] - az
    const x = aby * acz - abz * acy,
      y = abz * acx - abx * acz,
      z = abx * acy - aby * acx
    for (const i of [a, b, c]) {
      normals[i * 3] += x
      normals[i * 3 + 1] += y
      normals[i * 3 + 2] += z
    }
  }
  if (mode === 4) {
    for (let i = 0; i + 2 < indices.length; i += 3) addFace(indices[i], indices[i + 1], indices[i + 2])
  } else if (mode === 5) {
    for (let i = 0; i + 2 < indices.length; i++) {
      if (i % 2) addFace(indices[i + 1], indices[i], indices[i + 2])
      else addFace(indices[i], indices[i + 1], indices[i + 2])
    }
  } else if (mode === 6) {
    for (let i = 1; i + 1 < indices.length; i++) addFace(indices[0], indices[i], indices[i + 1])
  }
  for (let i = 0; i < vertexCount; i++) {
    const length = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2])
    if (!length) {
      normals[i * 3 + 2] = 1
      continue
    }
    normals[i * 3] /= length
    normals[i * 3 + 1] /= length
    normals[i * 3 + 2] /= length
  }
  return normals
}

const createTangents = (
  positions: ArrayLike<number>,
  normals: ArrayLike<number>,
  uvs: ArrayLike<number>,
  indices: ArrayLike<number>,
  mode: number,
  vertexCount: number,
) => {
  const tangent = new Float32Array(vertexCount * 3)
  const bitangent = new Float32Array(vertexCount * 3)
  const addFace = (a: number, b: number, c: number) => {
    const x1 = positions[b * 3] - positions[a * 3],
      y1 = positions[b * 3 + 1] - positions[a * 3 + 1],
      z1 = positions[b * 3 + 2] - positions[a * 3 + 2]
    const x2 = positions[c * 3] - positions[a * 3],
      y2 = positions[c * 3 + 1] - positions[a * 3 + 1],
      z2 = positions[c * 3 + 2] - positions[a * 3 + 2]
    const s1 = uvs[b * 2] - uvs[a * 2],
      t1 = uvs[b * 2 + 1] - uvs[a * 2 + 1]
    const s2 = uvs[c * 2] - uvs[a * 2],
      t2 = uvs[c * 2 + 1] - uvs[a * 2 + 1]
    const determinant = s1 * t2 - s2 * t1
    if (Math.abs(determinant) < 1e-12) return
    const r = 1 / determinant
    const tx = (x1 * t2 - x2 * t1) * r,
      ty = (y1 * t2 - y2 * t1) * r,
      tz = (z1 * t2 - z2 * t1) * r
    const bx = (x2 * s1 - x1 * s2) * r,
      by = (y2 * s1 - y1 * s2) * r,
      bz = (z2 * s1 - z1 * s2) * r
    for (const i of [a, b, c]) {
      tangent[i * 3] += tx
      tangent[i * 3 + 1] += ty
      tangent[i * 3 + 2] += tz
      bitangent[i * 3] += bx
      bitangent[i * 3 + 1] += by
      bitangent[i * 3 + 2] += bz
    }
  }
  const triangles = (add: (a: number, b: number, c: number) => void) => {
    if (mode === 4) for (let i = 0; i + 2 < indices.length; i += 3) add(indices[i], indices[i + 1], indices[i + 2])
    else if (mode === 5)
      for (let i = 0; i + 2 < indices.length; i++)
        i % 2 ? add(indices[i + 1], indices[i], indices[i + 2]) : add(indices[i], indices[i + 1], indices[i + 2])
    else if (mode === 6) for (let i = 1; i + 1 < indices.length; i++) add(indices[0], indices[i], indices[i + 1])
  }
  triangles(addFace)
  const result = new Float32Array(vertexCount * 4)
  for (let i = 0; i < vertexCount; i++) {
    const nx = normals[i * 3],
      ny = normals[i * 3 + 1],
      nz = normals[i * 3 + 2]
    let tx = tangent[i * 3],
      ty = tangent[i * 3 + 1],
      tz = tangent[i * 3 + 2]
    const dot = nx * tx + ny * ty + nz * tz
    tx -= nx * dot
    ty -= ny * dot
    tz -= nz * dot
    const length = Math.hypot(tx, ty, tz) || 1
    tx /= length
    ty /= length
    tz /= length
    result[i * 4] = tx
    result[i * 4 + 1] = ty
    result[i * 4 + 2] = tz
    const cx = ny * tz - nz * ty,
      cy = nz * tx - nx * tz,
      cz = nx * ty - ny * tx
    result[i * 4 + 3] = cx * bitangent[i * 3] + cy * bitangent[i * 3 + 1] + cz * bitangent[i * 3 + 2] < 0 ? -1 : 1
  }
  return result
}

export const getMesh = async (index: number, context: LoaderContext, weights?: () => Float32Array, skin?: SkinData) => {
  const json = context.json.meshes?.[index]
  if (!json) {
    throw new Error('gltf mesh not found')
  }
  const _accessor = (i: number) => context.withCache(`accessor_${i}`, () => getAccessor(i, context))
  const _material = (i: number | undefined) =>
    context.withCache(`material_${i ?? 'default'}`, () => getMaterial(i, context))

  return await Promise.all(
    json.primitives.map(async primitive => {
      const createMat = await _material(primitive.material)
      const attributes = primitive.attributes
      const materialJson = primitive.material === undefined ? undefined : context.json.materials?.[primitive.material]
      const isUnlit = !!(materialJson?.extensions && 'KHR_materials_unlit' in materialJson.extensions)
      const mr = materialJson?.pbrMetallicRoughness
      const textureInfos = isUnlit
        ? [mr?.baseColorTexture]
        : [
            mr?.baseColorTexture,
            mr?.metallicRoughnessTexture,
            materialJson?.normalTexture,
            materialJson?.occlusionTexture,
            materialJson?.emissiveTexture,
          ]
      const uvSetIndices = [
        ...new Set([0, ...textureInfos.filter(info => !!info).map(info => info!.texCoord ?? 0)]),
      ].sort((a, b) => a - b)
      for (const uvSet of uvSetIndices) {
        if (attributes[`TEXCOORD_${uvSet}`] === undefined)
          throw new Error(`Material texture references missing TEXCOORD_${uvSet}`)
      }
      const positionAccessor = attributes.POSITION
      if (positionAccessor === undefined) throw new Error(`Mesh ${index} primitive has no POSITION attribute`)
      const position = _accessor(positionAccessor)
      if (position.type !== 'VEC3' || position.componentType !== 5126 || position.normalized) {
        throw new Error(`Mesh ${index} POSITION must be a non-normalized FLOAT VEC3`)
      }
      const positionData = position.bufferData
      const vertexCount = positionData.length / 3
      const mode = primitive.mode ?? 4
      const indexAccessor = primitive.indices === undefined ? undefined : _accessor(primitive.indices)
      if (
        indexAccessor &&
        (indexAccessor.type !== 'SCALAR' ||
          indexAccessor.normalized ||
          ![5121, 5123, 5125].includes(indexAccessor.componentType))
      ) {
        throw new Error(`Mesh ${index} indices must be an unsigned integer SCALAR`)
      }
      if (![0, 1, 2, 3, 4, 5, 6].includes(mode)) throw new Error(`Mesh ${index} uses invalid primitive mode ${mode}`)
      const sourceIndices = indexAccessor
        ? indexAccessor.bufferData
        : Uint32Array.from({ length: vertexCount }, (_, i) => i)
      for (const [name, attributeIndex] of Object.entries(attributes)) {
        const accessor = _accessor(attributeIndex)
        if (accessor.count !== vertexCount) throw new Error(`${name} count does not match POSITION`)
        if (
          name === 'NORMAL' &&
          !(accessor.componentType === 5126 || (accessor.normalized && [5120, 5122].includes(accessor.componentType)))
        ) {
          throw new Error('NORMAL must use FLOAT or normalized BYTE/SHORT components')
        }
        if (name === 'TANGENT' && (accessor.componentType !== 5126 || accessor.normalized)) {
          throw new Error('TANGENT must use non-normalized FLOAT components')
        }
        if (
          (name.startsWith('TEXCOORD_') || name.startsWith('COLOR_')) &&
          !(accessor.componentType === 5126 || (accessor.normalized && [5121, 5123].includes(accessor.componentType)))
        ) {
          throw new Error(`${name} must use FLOAT or normalized UNSIGNED_BYTE/UNSIGNED_SHORT components`)
        }
      }
      for (const target of primitive.targets ?? []) {
        for (const [name, accessorIndex] of Object.entries(target)) {
          if (!['POSITION', 'NORMAL', 'TANGENT'].includes(name))
            throw new Error(`Unsupported morph target attribute ${name}`)
          const accessor = _accessor(accessorIndex)
          if (accessor.componentType !== 5126 || accessor.normalized || accessor.count !== vertexCount) {
            throw new Error(`Morph target ${name} must use FLOAT data matching POSITION`)
          }
        }
      }
      if (sourceIndices.some(index => index >= vertexCount))
        throw new Error(`Mesh ${index} has an index outside POSITION`)
      const generatedNormals = createNormals(positionData, sourceIndices, mode, vertexCount)
      const normalTexCoord = materialJson?.normalTexture?.texCoord ?? 0
      const hasNormalTexture = !!materialJson?.normalTexture
      const normalAccessor = attributes.NORMAL === undefined ? undefined : _accessor(attributes.NORMAL)
      const normalData = normalAccessor
        ? normalAccessor.normalized
          ? Float32Array.from(normalAccessor.bufferData, value =>
              normalizedComponent(value, normalAccessor.componentType),
            )
          : normalAccessor.bufferData
        : generatedNormals
      const tangentUvAccessor =
        attributes[`TEXCOORD_${normalTexCoord}`] === undefined
          ? undefined
          : _accessor(attributes[`TEXCOORD_${normalTexCoord}`])
      const uvData = tangentUvAccessor
        ? Float32Array.from(tangentUvAccessor.bufferData, value =>
            tangentUvAccessor.normalized ? normalizedComponent(value, tangentUvAccessor.componentType) : value,
          )
        : new Float32Array(vertexCount * 2)
      const generatedTangents = hasNormalTexture
        ? createTangents(positionData, normalData, uvData, sourceIndices, mode, vertexCount)
        : undefined
      const skinAttributes: { joints: Uint16Array | Uint8Array; weights: TypedArray }[] = []
      if (skin) {
        for (
          let set = 0;
          attributes[`JOINTS_${set}`] !== undefined || attributes[`WEIGHTS_${set}`] !== undefined;
          set++
        ) {
          const jointsIndex = attributes[`JOINTS_${set}`]
          const weightsIndex = attributes[`WEIGHTS_${set}`]
          if (jointsIndex === undefined || weightsIndex === undefined)
            throw new Error(`Mesh ${index} skin attributes must provide JOINTS_${set} and WEIGHTS_${set}`)
          const joints = _accessor(jointsIndex)
          const jointWeights = _accessor(weightsIndex)
          if (joints.itemSize !== 4 || ![5121, 5123].includes(joints.componentType) || joints.normalized) {
            throw new Error(`JOINTS_${set} must be an unsigned byte or short VEC4`)
          }
          if (
            jointWeights.itemSize !== 4 ||
            !(
              jointWeights.componentType === 5126 ||
              ([5121, 5123].includes(jointWeights.componentType) && jointWeights.normalized)
            )
          ) {
            throw new Error(`WEIGHTS_${set} must be FLOAT or normalized integer VEC4`)
          }
          const rawWeights = jointWeights.bufferData
          const normalizedWeights = jointWeights.normalized
            ? Float32Array.from(rawWeights, value => value / (jointWeights.componentType === 5121 ? 255 : 65535))
            : Float32Array.from(rawWeights)
          skinAttributes.push({ joints: joints.bufferData as Uint16Array | Uint8Array, weights: normalizedWeights })
        }
        if (!skinAttributes.length) throw new Error(`Mesh ${index} has a skin but no JOINTS_n/WEIGHTS_n attributes`)
      }
      const [meshRef, setMeshRef] = createSignal<MeshRef>()

      return () => {
        if (uvSetIndices.some(set => (set === 0 ? 3 : 5 + set) >= device.limits.maxVertexAttributes)) {
          throw new Error(`Mesh ${index} uses a TEXCOORD set beyond this GPU's vertex attribute limit`)
        }
        const skinPalette = skin
          ? () => {
              const mesh = meshRef()
              if (!mesh) return [] as { matrix: Mat4; normal: Mat3 }[]
              const scene = mesh.scene()?.[0]
              const meshInverse = Mat4.invert(Mat4.create(), mesh.matrix())
              if (!meshInverse) return [] as { matrix: Mat4; normal: Mat3 }[]
              return skin.joints.map((joint, jointIndex) => {
                const refs = context.nodeRefs.get(joint) ?? []
                const jointRef = [...refs].find(ref => ref.scene()?.[0] === scene) ?? refs.values().next().value
                if (!jointRef) return { matrix: Mat4.create(), normal: Mat3.create() }
                const matrix = Mat4.mul(
                  Mat4.create(),
                  jointRef.matrix(),
                  skin.inverseBindMatrices.subarray(jointIndex * 16, jointIndex * 16 + 16),
                )
                Mat4.mul(matrix, meshInverse, matrix)
                return { matrix, normal: Mat3.normalFromMat4(Mat3.create(), matrix) ?? Mat3.create() }
              })
            }
          : undefined

        const vertexAttributes = [
          { name: 'POSITION', location: 0 },
          { name: 'NORMAL', location: 1 },
          { name: 'TANGENT', location: 2 },
          { name: 'TEXCOORD_0', location: 3 },
          { name: 'COLOR_0', location: 4 },
          ...uvSetIndices.filter(set => set > 0).map(set => ({ name: `TEXCOORD_${set}`, location: 5 + set })),
        ]
        const bufferUpdates: (() => void)[] = []
        const vertexBuffers = vertexAttributes.map(({ name, location }) => {
          const accessorIndex = attributes[name]
          const accessor = accessorIndex === undefined ? undefined : _accessor(accessorIndex)
          if (accessor && accessor.count !== vertexCount) throw new Error(`${name} count does not match POSITION`)
          const expectedSize =
            name === 'POSITION' || name === 'NORMAL'
              ? 3
              : name === 'TANGENT' || name === 'COLOR_0'
                ? undefined
                : name.startsWith('TEXCOORD_')
                  ? 2
                  : undefined
          if (accessor && expectedSize !== undefined && accessor.itemSize !== expectedSize) {
            throw new Error(`${name} must have ${expectedSize} components`)
          }
          const defaultValues: Record<string, number[]> = {
            POSITION: [],
            NORMAL: [],
            TANGENT: [1, 0, 0, 1],
            TEXCOORD_0: [0, 0],
            COLOR_0: [1, 1, 1, 1],
          }
          if (name.startsWith('TEXCOORD_')) defaultValues[name] = [0, 0]
          const itemSize =
            name === 'POSITION' || name === 'NORMAL' ? 3 : name === 'TANGENT' || name === 'COLOR_0' ? 4 : 2
          let buffer: TypedArray | Accessor<TypedArray> =
            accessor?.bufferData ??
            (name === 'NORMAL'
              ? generatedNormals
              : name === 'TANGENT' && generatedTangents
                ? generatedTangents
                : new Float32Array(Array.from({ length: vertexCount }, () => defaultValues[name]).flat()))
          let format = accessor?.format ?? (`float32x${itemSize}` as GPUVertexFormat)
          let stride = accessor?.arrayStride ?? itemSize * Float32Array.BYTES_PER_ELEMENT
          if (name === 'NORMAL' && accessor?.normalized) {
            buffer = Float32Array.from(accessor.bufferData, value => normalizedComponent(value, accessor.componentType))
            format = 'float32x3'
            stride = 12
          }
          if (name === 'COLOR_0' && accessor) {
            if (accessor.itemSize !== 3 && accessor.itemSize !== 4) throw new Error('COLOR_0 must be VEC3 or VEC4')
            const colors = new Float32Array(vertexCount * 4)
            const source = accessor.bufferData
            const maxValue: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }
            for (let i = 0; i < vertexCount; i++) {
              for (let c = 0; c < accessor.itemSize; c++) {
                const raw = source[i * accessor.itemSize + c]
                colors[i * 4 + c] =
                  (accessor.normalized && accessor.componentType === 5120) ||
                  (accessor.normalized && accessor.componentType === 5122)
                    ? Math.max(raw / maxValue[accessor.componentType], -1)
                    : accessor.normalized
                      ? raw / maxValue[accessor.componentType]
                      : raw
              }
              if (accessor.itemSize === 3) colors[i * 4 + 3] = 1
            }
            buffer = colors
            format = 'float32x4'
            stride = 16
          }
          const targetAccessors = (primitive.targets ?? [])
            .map(target => target[name])
            .filter((target): target is number => target !== undefined)
          if (weights && targetAccessors.length) {
            const base = buffer as TypedArray
            const normalizedBase = Float32Array.from(base)
            const morphItemSize = name === 'TANGENT' ? 3 : itemSize
            const deltas = (primitive.targets ?? []).map(target => {
              if (target[name] === undefined) return new Float32Array(vertexCount * morphItemSize)
              const accessor = _accessor(target[name]!)
              if (accessor.count !== vertexCount || accessor.itemSize !== morphItemSize) {
                throw new Error(`${name} morph target must have ${vertexCount} VEC${morphItemSize} values`)
              }
              return Float32Array.from(accessor.bufferData)
            })
            buffer = () => {
              const result = Float32Array.from(normalizedBase)
              const currentWeights = weights()
              for (let target = 0; target < deltas.length; target++) {
                const weight = currentWeights[target] ?? 0
                if (!weight) continue
                const delta = deltas[target]
                for (let vertex = 0; vertex < vertexCount; vertex++) {
                  for (let component = 0; component < morphItemSize; component++) {
                    result[vertex * itemSize + component] += delta[vertex * morphItemSize + component] * weight
                  }
                }
              }
              return result
            }
            format = `float32x${itemSize}` as GPUVertexFormat
            stride = itemSize * Float32Array.BYTES_PER_ELEMENT
          }
          if (skin && (name === 'POSITION' || name === 'NORMAL' || name === 'TANGENT')) {
            const source = buffer
            buffer = () => {
              const base = typeof source === 'function' ? source() : source
              const result = Float32Array.from(base)
              const palette = skinPalette?.() ?? []
              if (!palette.length) return result

              for (let vertex = 0; vertex < vertexCount; vertex++) {
                const out = [0, 0, 0]
                let totalWeight = 0
                for (const attributes of skinAttributes) {
                  for (let influence = 0; influence < 4; influence++) {
                    const weightIndex = vertex * 4 + influence
                    const weight = attributes.weights[weightIndex]
                    if (weight <= 0) continue
                    const joint = attributes.joints[weightIndex]
                    if (joint >= palette.length) throw new Error(`Mesh ${index} references a joint outside its skin`)
                    const transform = name === 'NORMAL' ? palette[joint].normal : palette[joint].matrix
                    const x = result[vertex * itemSize],
                      y = result[vertex * itemSize + 1],
                      z = result[vertex * itemSize + 2]
                    if (name === 'NORMAL') {
                      out[0] += (transform[0] * x + transform[3] * y + transform[6] * z) * weight
                      out[1] += (transform[1] * x + transform[4] * y + transform[7] * z) * weight
                      out[2] += (transform[2] * x + transform[5] * y + transform[8] * z) * weight
                    } else {
                      out[0] +=
                        (transform[0] * x +
                          transform[4] * y +
                          transform[8] * z +
                          (name === 'POSITION' ? transform[12] : 0)) *
                        weight
                      out[1] +=
                        (transform[1] * x +
                          transform[5] * y +
                          transform[9] * z +
                          (name === 'POSITION' ? transform[13] : 0)) *
                        weight
                      out[2] +=
                        (transform[2] * x +
                          transform[6] * y +
                          transform[10] * z +
                          (name === 'POSITION' ? transform[14] : 0)) *
                        weight
                    }
                    totalWeight += weight
                  }
                }
                if (totalWeight > 0) {
                  const scale = 1 / totalWeight
                  for (let c = 0; c < 3; c++) result[vertex * itemSize + c] = out[c] * scale
                  if (name !== 'POSITION') {
                    const length = Math.hypot(out[0], out[1], out[2]) || 1
                    for (let c = 0; c < 3; c++) result[vertex * itemSize + c] = out[c] / length
                  }
                }
              }
              return result
            }
            format = `float32x${itemSize}` as GPUVertexFormat
            stride = itemSize * Float32Array.BYTES_PER_ELEMENT
          }
          const vbs = createBufferFromValue({ usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }, buffer)
          if (typeof buffer === 'function' && vbs.update) bufferUpdates.push(vbs.update)
          return {
            buffer: untrack(() => vbs()),
            layout: {
              arrayStride: stride,
              attributes: [
                {
                  format,
                  offset: 0,
                  shaderLocation: location,
                },
              ],
            },
            name,
            type: `vec${itemSize}<f32>`,
          }
        })

        let indexData: Uint16Array | Uint32Array | undefined =
          primitive.indices !== undefined || mode === 2 || mode === 5 || mode === 6
            ? sourceIndices instanceof Uint8Array || sourceIndices instanceof Uint16Array
              ? Uint16Array.from(sourceIndices)
              : Uint32Array.from(sourceIndices as Uint32Array)
            : undefined
        if (indexData && mode === 6) {
          const fan: number[] = []
          for (let i = 1; i + 1 < indexData.length; i++) fan.push(indexData[0], indexData[i], indexData[i + 1])
          indexData = indexData instanceof Uint16Array ? Uint16Array.from(fan) : Uint32Array.from(fan)
        } else if (indexData && mode === 2) {
          const loop: number[] = []
          for (let i = 0; i < indexData.length; i++) loop.push(indexData[i], indexData[(i + 1) % indexData.length])
          indexData = indexData instanceof Uint16Array ? Uint16Array.from(loop) : Uint32Array.from(loop)
        }
        const indexArrayBuffer = indexData?.slice().buffer as ArrayBuffer | undefined
        const indexBuffer = indexData
          ? {
              buffer: untrack(() =>
                createBufferFromValue({ usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST }, indexArrayBuffer!)(),
              ),
              BYTES_PER_ELEMENT: indexData.BYTES_PER_ELEMENT,
            }
          : undefined
        const topology = (
          {
            0: 'point-list',
            1: 'line-list',
            2: 'line-list',
            3: 'line-strip',
            4: 'triangle-list',
            5: 'triangle-strip',
            6: 'triangle-list',
          } as Record<number, GPUPrimitiveTopology>
        )[mode]
        if (!topology) throw new Error(`Mesh ${index} uses invalid primitive mode ${mode}`)
        const mat = createMat?.()

        return (
          <Mesh
            ref={setMeshRef}
            label={json.name ?? `gltf mesh ${index}`}
            geometry={{
              update: () => {
                for (const update of bufferUpdates) update()
              },
              indexBuffer,
              vertexBuffers,
              primitive: {
                topology,
                stripIndexFormat:
                  indexData && (mode === 3 || mode === 5)
                    ? indexData instanceof Uint16Array
                      ? 'uint16'
                      : 'uint32'
                    : undefined,
              },
            }}
            material={mat?.()}
          ></Mesh>
        )
      }
    }),
  )
}
