import { BuiltinUniform, Material, Sampler, Texture, UniformBuffer } from '../material'
import shaderCode from './unlit.wgsl?raw'
import { setBitOfValue, textureFromUrl, white1pxBase64 } from '../utils'
import { Vec3 } from '../math'

const defaultTexture = await textureFromUrl(white1pxBase64)

export class UnlitMaterial extends Material {
  _buffer: ArrayBuffer
  _albedo: Vec3
  _flag: Uint32Array

  declare uniforms: [BuiltinUniform, UniformBuffer, Texture, Sampler]

  constructor(options?: { albedo?: Vec3; albedoTexture?: Texture }) {
    const _buffer = new ArrayBuffer(16)
    const albedo = new Vec3(_buffer).copy(options?.albedo ?? Vec3.fromValues(0, 0.5, 1))

    const flag = new Uint32Array(_buffer, 12, 1)
    flag[0] = setBitOfValue(flag[0], 0, !!options?.albedoTexture)

    super({
      shaderCode,
      uniforms: [
        { builtin_type: 'base' },
        {
          type: 'buffer',
          value: _buffer
        },
        options?.albedoTexture ?? defaultTexture,
        {
          type: 'sampler',
          descriptor: {
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat'
          }
        }
      ]
    })
    this._buffer = _buffer

    this._albedo = albedo
    this._flag = flag
  }

  set albedo(v: Vec3) {
    this._albedo.set(v, 0)
    this.uniforms[1].needsUpdate = true
  }
  get albedo(): Float32Array {
    return this._albedo
  }

  set albedoTexture(v: Texture | null) {
    this.uniforms[2] = v ?? defaultTexture
    this._flag[0] = setBitOfValue(this._flag[0], 0, !!v)
    this.uniforms[1].needsUpdate = true
  }
  get albedoTexture() {
    return this.uniforms[2] as Texture | null
  }
}
