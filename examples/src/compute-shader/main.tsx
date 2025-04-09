import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Canvas,
  createMaterial,
  createOrbitControl,
  createUniformBufferBase,
  device,
  GeometryOptions,
  Mesh,
  PerspectiveCamera,
  Vec3,
  Vec3Like,
  type CameraRef
} from 'solid-webgpu'

const formLineVertices = (options: { pointA: Vec3Like; pointB: Vec3Like; lineWidth: number; segments: number }) => {
  const { pointA, pointB, segments } = options
  const vertices = []
  const indices = []
  let vertexCount = 0

  const direction = Vec3.subtract(Vec3.create(), pointB, pointA)
  direction.normalize()

  vertices.push(
    // position, tangent, normal, side, isEndpoint, endpointAngle
    [...pointA, ...direction, -1.0, 0, 0.0],
    [...pointA, ...direction, 1.0, 0, 0.0],
    [...pointB, ...direction, -1.0, 0, 0.0],
    [...pointB, ...direction, 1.0, 0, 0.0]
  )
  // main box
  indices.push(0, 1, 2, 2, 1, 3)
  vertexCount = 4

  const startCenter = vertexCount
  vertices.push([...pointA, ...direction, 0.0, 1, 0.0]) // 中心点
  vertexCount++

  for (let i = 0; i <= segments; i++) {
    const angle = (Math.PI * i) / segments // 0 到 π
    vertices.push([...pointA, ...direction, 1, 1, angle])

    if (i > 0) {
      indices.push(startCenter, vertexCount - 1, vertexCount)
    }
    vertexCount++
  }

  const endCenter = vertexCount
  vertices.push([...pointB, ...direction, 0.0, 2, 0.0]) // 中心点
  vertexCount++

  for (let i = 0; i <= segments; i++) {
    const angle = (Math.PI * i) / segments // 0 到 π
    vertices.push([...pointB, ...direction, 1, 2, angle])

    if (i > 0) {
      indices.push(endCenter, vertexCount, vertexCount - 1)
    }
    vertexCount++
  }

  return { vertices, indices }
}

const createLineGeometry = (options: { vertices: number[][]; indices: number[] }) => {
  const { vertices, indices } = options
  const sizePerVertex = 9

  const b = new ArrayBuffer(vertices.length * sizePerVertex * Float32Array.BYTES_PER_ELEMENT)
  const f32arr = new Float32Array(b)
  const i32arr = new Uint32Array(b)
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]
    f32arr.set(v, i * sizePerVertex)

    i32arr[i * sizePerVertex + 7] = v[7]
  }
  const vertexBuffer = device.createBuffer({
    size: b.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(vertexBuffer, 0, b)

  const indexVals = new Uint32Array(indices)
  const indexBuffer = device.createBuffer({
    size: indexVals.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(indexBuffer, 0, indexVals)

  const geo: GeometryOptions = {
    primitive: {
      topology: 'triangle-list'
      // cullMode: 'none'
    },
    indexBuffer: {
      buffer: indexBuffer,
      BYTES_PER_ELEMENT: Uint32Array.BYTES_PER_ELEMENT
    },
    vertexBuffers: [
      {
        buffer: vertexBuffer,
        layout: {
          stepMode: 'vertex',
          arrayStride: sizePerVertex * Float32Array.BYTES_PER_ELEMENT,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3'
            }, // POSITION
            {
              shaderLocation: 1,
              offset: 12,
              format: 'float32x3'
            }, // TANGENT
            {
              shaderLocation: 2,
              offset: 24,
              format: 'float32'
            }, // side
            {
              shaderLocation: 3,
              offset: 28,
              format: 'uint32'
            }, // isEndpoint
            {
              shaderLocation: 4,
              offset: 32,
              format: 'float32'
            } // endpointAngle
          ]
        }
      }
    ]
  }
  return geo
}

const App = () => {
  const [camera, setCamera] = createSignal<CameraRef>()
  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>()

  createOrbitControl(canvas, camera)

  const geo = createLineGeometry(
    formLineVertices({
      pointA: [0, 0, 0],
      pointB: [1, 1, 1],
      lineWidth: 0.5,
      segments: 8
    })
  )
  const { buffer: base, update: updateBase } = createUniformBufferBase()
  const mat = createMaterial(
    `
struct VertexInput {
    @location(0) POSITION: vec3<f32>,
    @location(1) TANGENT: vec3<f32>,
    @location(2) SIDE: f32,
    @location(3) IS_ENDPOINT: u32,
    @location(4) ENDPOINT_ANGLE: f32
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

const worldLineWidth: f32 = 0.5;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    let halfWidth = worldLineWidth * 0.5;
    var finalPosition = input.POSITION;


    let camDir = normalize(vec3(
        -uniforms.view[0][2],
        -uniforms.view[1][2],
        -uniforms.view[2][2]
    ));
    let dir = normalize(cross(camDir, input.TANGENT));

    if (input.IS_ENDPOINT == 0u) {
        finalPosition += dir * halfWidth * input.SIDE;
    } else {
        let angle = input.ENDPOINT_ANGLE;  // 0到π的角度
        let circleX = cos(angle) * halfWidth;
        let circleY = sin(angle) * halfWidth;

        var capDir = select(input.TANGENT, -input.TANGENT, input.IS_ENDPOINT == 1u);
        capDir = rotateVectorToPlane(capDir, camDir);

        let endPos = input.POSITION + (circleY * capDir - circleX * dir);
        finalPosition = endPos;
    }

    var output: VertexOutput;
    let world_position = (uniforms.model * vec4<f32>(finalPosition, 1.0)).xyz;
    let view_position = (uniforms.view * vec4<f32>(world_position, 1.0)).xyz;
    output.clip_position = uniforms.projection * vec4<f32>(view_position, 1.0);
    return output;
}
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}

fn rotateVectorToPlane(v: vec3f, n: vec3f) -> vec3f {
    // Calculate the original length
    let originalLength = length(v);

    // Subtract to get the component in the plane
    var projectedVector = v - dot(v, n) * n;
    
    // Check if the projection is non-zero
    let projectedLength = length(projectedVector);
    if (projectedLength < 0.0001) {
        // The vector is perpendicular to the plane, so we need to choose
        // an arbitrary vector in the plane
        let arbitrary = select(vec3(1., 0., 0.), vec3(0., 1., 0.), abs(n.x) < 0.9);
        projectedVector = normalize(cross(n, arbitrary));
    } else {
        // Normalize and scale to preserve the original length
        projectedVector = projectedVector / projectedLength;
    }
    
    // Scale to original length
    return projectedVector * originalLength;
}

    
    `,
    [base],
    updateBase
  )

  return (
    <Canvas camera={camera()} ref={setCanvas}>
      <PerspectiveCamera label="main_camera" ref={setCamera} position={[0, 0, 5]} aspect={16 / 9} />

      <Mesh geometry={geo} material={mat()} />
    </Canvas>
  )
}

render(() => <App />, document.getElementById('app')!)
