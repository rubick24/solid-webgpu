import type { TypedArray, TypedArrayConstructor } from 'solid-webgpu'
import type { LoaderContext } from './types'

const components: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }
const arrayTypes: Record<number, TypedArrayConstructor> = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
}
const byteSizes: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const formats: Record<number, string> = {
  5120: 'sint8',
  5121: 'uint8',
  5122: 'sint16',
  5123: 'uint16',
  5125: 'uint32',
  5126: 'float32',
}

const viewBytes = (viewIndex: number, context: LoaderContext) => {
  const view = context.json.bufferViews?.[viewIndex]
  const buffer = view && context.buffers[view.buffer]
  if (!view || !buffer) throw new Error(`Invalid bufferView ${viewIndex}`)
  const start = view.byteOffset ?? 0
  if (start + view.byteLength > buffer.byteLength) throw new Error(`bufferView ${viewIndex} exceeds its buffer`)
  return { view, buffer }
}

const readArray = (buffer: ArrayBuffer, byteOffset: number, count: number, type: number): TypedArray => {
  const Ctor = arrayTypes[type] as unknown as new (
    buffer: ArrayBuffer,
    byteOffset: number,
    length: number,
  ) => TypedArray
  if (!Ctor) throw new Error(`Unsupported accessor componentType ${type}`)
  const bytes = byteSizes[type]
  if (byteOffset % bytes) throw new Error('Accessor byteOffset is not component-aligned')
  if (byteOffset + count * bytes > buffer.byteLength) throw new Error('Accessor exceeds its bufferView')
  return new Ctor(buffer, byteOffset, count)
}

export const getAccessor = (index: number, context: LoaderContext) => {
  const accessor = context.json.accessors?.[index]
  if (!accessor) throw new Error(`Accessor ${index} not found`)
  const itemSize = components[accessor.type]
  const bytesPerComponent = byteSizes[accessor.componentType]
  if (!itemSize || !bytesPerComponent) throw new Error(`Unsupported accessor type ${accessor.type}`)
  if (accessor.normalized && accessor.componentType === 5126) throw new Error('Float accessors cannot be normalized')
  const dimension = accessor.type.startsWith('MAT') ? Number(accessor.type.slice(3)) : 0
  const columnStride = dimension ? Math.ceil((dimension * bytesPerComponent) / 4) * 4 : itemSize * bytesPerComponent
  const elementByteSize = dimension ? dimension * columnStride : itemSize * bytesPerComponent
  const readElement = (buffer: ArrayBuffer, offset: number, output: TypedArray, outputOffset: number) => {
    if (!dimension) {
      output.set(readArray(buffer, offset, itemSize, accessor.componentType), outputOffset)
      return
    }
    for (let column = 0; column < dimension; column++) {
      const valuesInColumn = readArray(buffer, offset + column * columnStride, dimension, accessor.componentType)
      output.set(valuesInColumn, outputOffset + column * dimension)
    }
  }

  const Values = arrayTypes[accessor.componentType] as unknown as new (length: number) => TypedArray
  const values = new Values(accessor.count * itemSize)
  if (accessor.bufferView !== undefined) {
    const { view, buffer } = viewBytes(accessor.bufferView, context)
    const stride = view.byteStride ?? elementByteSize
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    if (view.byteStride !== undefined && (stride < 4 || stride > 252 || stride % 4)) {
      throw new Error(`Invalid bufferView byteStride for accessor ${index}`)
    }
    if (stride < elementByteSize || stride % bytesPerComponent) {
      throw new Error(`Invalid byteStride for accessor ${index}`)
    }
    const accessedEnd =
      (accessor.byteOffset ?? 0) + (accessor.count ? (accessor.count - 1) * stride + elementByteSize : 0)
    if (accessedEnd > view.byteLength) throw new Error(`Accessor ${index} exceeds its bufferView`)
    for (let element = 0; element < accessor.count; element++) {
      readElement(buffer, offset + element * stride, values, element * itemSize)
    }
  }

  if (accessor.sparse) {
    const sparse = accessor.sparse
    const indexInfo = viewBytes(sparse.indices.bufferView, context)
    const indexOffset = (indexInfo.view.byteOffset ?? 0) + (sparse.indices.byteOffset ?? 0)
    if (
      (sparse.indices.byteOffset ?? 0) + sparse.count * byteSizes[sparse.indices.componentType] >
      indexInfo.view.byteLength
    ) {
      throw new Error(`Sparse accessor ${index} exceeds its indices bufferView`)
    }
    const sparseIndices = readArray(indexInfo.buffer, indexOffset, sparse.count, sparse.indices.componentType)
    for (let i = 1; i < sparseIndices.length; i++) {
      if (sparseIndices[i] <= sparseIndices[i - 1])
        throw new Error(`Sparse accessor ${index} indices must be strictly increasing`)
    }
    const valueInfo = viewBytes(sparse.values.bufferView, context)
    const valueOffset = (valueInfo.view.byteOffset ?? 0) + (sparse.values.byteOffset ?? 0)
    const sparseValues = new Values(sparse.count * itemSize)
    const sparseEnd = (sparse.values.byteOffset ?? 0) + sparse.count * elementByteSize
    if (sparseEnd > valueInfo.view.byteLength) throw new Error(`Sparse accessor ${index} exceeds its values bufferView`)
    for (let i = 0; i < sparse.count; i++)
      readElement(valueInfo.buffer, valueOffset + i * elementByteSize, sparseValues, i * itemSize)
    for (let i = 0; i < sparse.count; i++) {
      const target = sparseIndices[i]
      if (target >= accessor.count) throw new Error(`Sparse accessor ${index} index is out of range`)
      values.set(sparseValues.subarray(i * itemSize, (i + 1) * itemSize), target * itemSize)
    }
  }

  let format = `${formats[accessor.componentType]}${itemSize > 1 ? `x${itemSize}` : ''}`
  if (accessor.normalized) {
    const normalizedFormats: Record<number, string> = {
      5120: 'snorm8',
      5121: 'unorm8',
      5122: 'snorm16',
      5123: 'unorm16',
    }
    format = `${normalizedFormats[accessor.componentType]}${itemSize > 1 ? `x${itemSize}` : ''}`
  }

  return {
    ...accessor,
    index,
    itemSize,
    itemType: (
      { 5120: 'i8', 5121: 'u8', 5122: 'i16', 5123: 'u16', 5125: 'u32', 5126: 'f32' } as Record<number, string>
    )[accessor.componentType],
    arrayStride: itemSize * bytesPerComponent,
    format: format as GPUVertexFormat,
    bufferData: values,
  }
}
