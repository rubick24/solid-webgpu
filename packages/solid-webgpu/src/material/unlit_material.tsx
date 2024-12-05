import { Vec3, Vec3Like } from 'math'
import { createEffect } from 'solid-js'
import { setBitOfValue } from '../utils'
import { DefaultTexture, Material, Sampler, Texture, UniformBuffer } from './material'
import shaderCode from './unlit.wgsl?raw'

export type UnlitMaterialProps = {
  albedo?: Vec3Like
  albedoTexture?: ImageBitmap
}
export const UnlitMaterial = (props: UnlitMaterialProps) => {
  const _buffer = new ArrayBuffer(16)

  createEffect(() => {
    const albedo = new Vec3(_buffer).copy(props?.albedo ?? Vec3.fromValues(0, 0.5, 1))

    const flag = new Uint32Array(_buffer, 12, 1)
    flag[0] = setBitOfValue(flag[0], 0, !!props?.albedoTexture)
  })

  return (
    <Material shaderCode={shaderCode}>
      <UniformBuffer buildInType="base" />
      <UniformBuffer value={_buffer} />
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
      <Sampler
        descriptor={{
          magFilter: 'linear',
          minFilter: 'linear',
          mipmapFilter: 'linear',
          addressModeU: 'repeat',
          addressModeV: 'repeat'
        }}
      />
    </Material>
  )
}
