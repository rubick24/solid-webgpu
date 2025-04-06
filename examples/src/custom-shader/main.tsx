import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Canvas,
  createMaterial,
  createOrbitControl,
  createPlaneGeometry,
  createUniformBufferBase,
  Mesh,
  PerspectiveCamera,
  type CameraRef
} from 'solid-webgpu'

const App = () => {
  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  const planeGeo = createPlaneGeometry()

  const { buffer: base, update: updateBase } = createUniformBufferBase()
  const mat = createMaterial(
    `
struct VertexInput {
    @location(0) POSITION: vec3<f32>,
    @location(1) NORMAL: vec3<f32>,
    @location(2) TANGENT: vec4<f32>,
    @location(3) TEXCOORD_0: vec2<f32>
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

struct BaseUniforms {
    model: mat4x4<f32>,
    view: mat4x4<f32>,
    projection: mat4x4<f32>,
    model_view: mat4x4<f32>,
    normal_matrix: mat3x3<f32>,
    camera_position: vec3<f32>
};


@group(0) @binding(0)
var<uniform> uniforms: BaseUniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let world_position = (uniforms.model * vec4<f32>(input.POSITION, 1.0)).xyz;
    let view_position = (uniforms.view * vec4<f32>(world_position, 1.0)).xyz;
    output.clip_position = uniforms.projection * vec4<f32>(view_position, 1.0);
    output.uv = input.TEXCOORD_0;
    return output;
}
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.uv, 0.5, 1.0);
}

    
    `,
    [base],
    updateBase
  )

  return (
    <Canvas camera={camera()} ref={setCanvas}>
      <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />

      <Mesh geometry={planeGeo} material={mat()} />
    </Canvas>
  )
}

render(() => <App />, document.getElementById('app')!)
