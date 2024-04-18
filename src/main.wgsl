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
  var global_d = length(uv) - abs(base_uniform.time / 6000. % 2. - 1.) * 3. + 1.;
  var a = textureSample(baseColor, baseColorSampler, uv + 0.5);
  var b = vec4(0., 0.75, 0.75, 1.);
  return mix(a, b, dotted_mix(uv, 16., global_d));
}

fn dotted_mix(uv: vec2<f32>, cell: f32, val: f32) -> f32 {
  var d = length(fract(uv * cell) - 0.5);
  var t = val;
  d = mix(d, 1. - length(fract(uv * cell + 0.5) - 0.5), t);
  return step(d, t);
}
