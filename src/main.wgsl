struct BaseUniform {
  resolution: vec2f,
  time: f32,
  time_delta: f32
};

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) vert_pos: vec3<f32>,
}

@group(0) @binding(0) var<uniform> base_uniform: BaseUniform;
@group(0) @binding(1) var baseColor : texture_2d<f32>;
@group(0) @binding(2) var baseColorSampler : sampler;

@vertex
fn vs_main(@location(0) position: vec2f) -> VertexOutput {
  var out: VertexOutput;
  out.clip_position = vec4<f32>(position, 0.0, 1.0);
  out.vert_pos = out.clip_position.xyz;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  var uv = in.vert_pos.xy;
  uv.x *= base_uniform.resolution.x / base_uniform.resolution.y;

  var r = length(uv)*2.0;
  var a = atan2(uv.y,uv.x);
  var f = uv.y / 2. + 0.5;
  return vec4(rainbow(r/10. + a / (PI * 2.)), 1.0);
}

const PI = 3.141592653589793;

fn palette(t: f32, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>, d: vec3<f32>) -> vec3<f32> {
  return a + b*cos(6.28318*(c*t+d));
}

fn rainbow(t: f32) -> vec3<f32> {
  return palette(t, vec3(0.5, 0.5, 0.5),	vec3(0.5, 0.5, 0.5),vec3(1.0, 1.0, 1.0), vec3(0.00, 0.33, 0.67));
}
