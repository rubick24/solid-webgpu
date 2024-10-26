import { BuiltinUniform, Material, Sampler, Texture, UniformBuffer } from '../material'
import shaderCode from './default_pbr.wgsl?raw'
import { setBitOfValue, textureFromUrl, white1pxBase64 } from '../utils'
import { Vec3 } from '../math'

const defaultTexture = await textureFromUrl(white1pxBase64)

export class PBRMaterial extends Material {
  _pbrBuffer: ArrayBuffer
  _albedo: Vec3
  _pbrParamsValue: Float32Array
  _pbrFlag: Uint32Array

  declare uniforms: [BuiltinUniform, UniformBuffer, Texture, Texture, Sampler, UniformBuffer]

  constructor(options?: {
    albedo?: Vec3
    metallic?: number
    roughness?: number
    occlusion?: number
    albedoTexture?: Texture
    occlusionRoughnessMetallicTexture?: Texture
  }) {
    const v = {
      albedo: options?.albedo ?? Vec3.fromValues(1, 1, 1),
      metallic: options?.metallic ?? 0,
      roughness: options?.roughness ?? 0.5,
      occlusion: options?.occlusion ?? 1.0
    }

    const _pbrBuffer = new ArrayBuffer(32)
    const albedo = new Vec3(_pbrBuffer).copy(v.albedo)
    const pbrParamsValue = new Float32Array(_pbrBuffer, 12, 3)
    pbrParamsValue[0] = v.metallic
    pbrParamsValue[1] = v.roughness
    pbrParamsValue[2] = v.occlusion
    const pbrFlag = new Uint32Array(_pbrBuffer, 24, 1)
    pbrFlag[0] = setBitOfValue(pbrFlag[0], 0, !!options?.albedoTexture)
    pbrFlag[0] = setBitOfValue(pbrFlag[0], 1, !!options?.occlusionRoughnessMetallicTexture)

    super({
      shaderCode,
      uniforms: [
        { builtin_type: 'base' },
        {
          type: 'buffer',
          value: _pbrBuffer
        },
        options?.albedoTexture ?? defaultTexture,
        options?.occlusionRoughnessMetallicTexture ?? defaultTexture,
        {
          type: 'sampler',
          descriptor: {
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat'
          }
        },
        { builtin_type: 'punctual_lights' }
      ]
    })
    this._pbrBuffer = _pbrBuffer

    this._albedo = albedo
    this._pbrParamsValue = pbrParamsValue
    this._pbrFlag = pbrFlag
  }

  set albedo(v: Vec3) {
    this._albedo.set(v, 0)
    this.uniforms[1].needsUpdate = true
  }
  get albedo(): Float32Array {
    return this._albedo
  }

  set metallic(v: number) {
    this._pbrParamsValue[0] = v
    this.uniforms[1].needsUpdate = true
  }
  get metallic() {
    return this._pbrParamsValue[0]
  }

  set roughness(v: number) {
    this._pbrParamsValue[1] = v
    this.uniforms[1].needsUpdate = true
  }
  get roughness() {
    return this._pbrParamsValue[1]
  }

  set occlusion(v: number) {
    this._pbrParamsValue[2] = v
    this.uniforms[1].needsUpdate = true
  }
  get occlusion() {
    return this._pbrParamsValue[2]
  }

  set albedoTexture(v: Texture | null) {
    this.uniforms[2] = v ?? defaultTexture
    this._pbrFlag[0] = setBitOfValue(this._pbrFlag[0], 0, !!v)
    this.uniforms[1].needsUpdate = true
  }
  get albedoTexture() {
    return this.uniforms[2] as Texture | null
  }

  set occlusionRoughnessMetallicTexture(v: Texture | null) {
    this.uniforms[3] = v ?? defaultTexture
    this._pbrFlag[0] = setBitOfValue(this._pbrFlag[0], 1, !!v)
    this.uniforms[1].needsUpdate = true
  }
  get occlusionRoughnessMetallicTexture() {
    return this.uniforms[3] as Texture | null
  }
}
