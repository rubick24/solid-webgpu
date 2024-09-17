export type AttributeData =
  | Float32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array

export type Attribute = {
  /**
   * Attribute data view.
   */
  data: AttributeData
  /**
   * The size (per vertex) of the data array. Used to allocate data to each vertex.
   */
  size: number
  /**
   * The size (per instance) of the data array. Used to allocate data to each instance.
   */
  divisor?: number
  /**
   * Used internally to mark attribute for updates.
   */
  needsUpdate?: boolean
}

export type DrawRange = {
  start: number
  count: number
}

export class Geometry {
  drawRange: DrawRange = { start: 0, count: Infinity }

  constructor(
    /**
     * Geometry program attributes.
     */
    readonly attributes: Record<string, Attribute> = {}
  ) {
    for (const key in attributes) {
      this.attributes[key] = attributes[key]
      this.attributes[key].needsUpdate = true
    }
  }

  /**
   * Disposes geometry from GPU memory.
   */
  dispose(): void {
    // Implemented by renderer
  }
}