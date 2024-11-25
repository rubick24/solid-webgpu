import { Vec3, Vec3Like } from 'math'
import { createEffect } from 'solid-js/types/server/reactive.js'
import { DefaultTexture, Material, Sampler, Texture, UniformBuffer } from '../material'
import { setBitOfValue } from '../utils'
import shaderCode from './default_pbr.wgsl?raw'

export type PBRMaterialProps = {
  albedo?: Vec3Like
  metallic?: number
  roughness?: number
  occlusion?: number
  albedoTexture?: ImageBitmap
  occlusionRoughnessMetallicTexture?: ImageBitmap
}

export const PBRMaterial = (props: PBRMaterialProps) => {
  const _pbrBuffer = new ArrayBuffer(32)
  createEffect(() => {
    new Vec3(_pbrBuffer).copy(props?.albedo ?? Vec3.fromValues(1, 1, 1))
    const pbrParamsValue = new Float32Array(_pbrBuffer, 12, 3)
    pbrParamsValue[0] = props?.metallic ?? 0
    pbrParamsValue[1] = props?.roughness ?? 0.5
    pbrParamsValue[2] = props?.occlusion ?? 1.0
    const pbrFlag = new Uint32Array(_pbrBuffer, 24, 1)

    pbrFlag[0] = setBitOfValue(pbrFlag[0], 0, !!props?.albedoTexture)
    pbrFlag[0] = setBitOfValue(pbrFlag[0], 1, !!props?.occlusionRoughnessMetallicTexture)
  })

  return (
    <Material
      shaderCode={shaderCode}
      uniforms={
        <>
          <UniformBuffer buildInType="base" />
          <UniformBuffer value={_pbrBuffer} />
          {props.albedoTexture ? (
            <Texture
              descriptor={{
                size: { width: props.albedoTexture.width, height: props.albedoTexture.height }
              }}
              image={props.albedoTexture}
            />
          ) : (
            <DefaultTexture />
          )}
          {props.occlusionRoughnessMetallicTexture ? (
            <Texture
              descriptor={{
                size: {
                  width: props.occlusionRoughnessMetallicTexture.width,
                  height: props.occlusionRoughnessMetallicTexture.height
                }
              }}
              image={props.occlusionRoughnessMetallicTexture}
            />
          ) : (
            <DefaultTexture />
          )}

          <Sampler
            descriptor={{
              magFilter: 'linear',
              minFilter: 'linear',
              mipmapFilter: 'linear',
              addressModeU: 'repeat',
              addressModeV: 'repeat'
            }}
          />
          <UniformBuffer buildInType="punctual_lights" />
        </>
      }
    />
  )
}
