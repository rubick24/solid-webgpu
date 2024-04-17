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

  var cell = 16.;
  uv.x *= base_uniform.resolution.x / base_uniform.resolution.y;

  var global_d = length(uv) + sin(base_uniform.time / 2000.);

  var d = length(fract(uv * cell) - 0.5);
  var t = global_d;
  // t = t * 2. - 1.;
  // var v = (1. - pow(abs(t), 0.9)) * 0.5;
  // t = select(v, 1. - v, t > 0.);
  d = mix(d, 1. - length(fract(uv * cell + 0.5) - 0.5), t);
  d = step(t, d);
  var col = vec4(vec3(d), 1.0);
  return col;
}
