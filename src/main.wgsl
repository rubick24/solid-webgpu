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
  // return vec4(rainbow(r/10. + a / (PI * 2.)), 1.0);

  var v = a / PI;
  let scale = 1.;
  v = scale - abs((abs(v) % (2.*scale)) - scale);

  v = voronoise(vec2(v * 10., base_uniform.time/1000.), .8, 0.8);
  return vec4(vec3(v), 1.0);
}

const PI = 3.141592653589793;

fn palette(t: f32, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>, d: vec3<f32>) -> vec3<f32> {
  return a + b*cos(6.28318*(c*t+d));
}

fn rainbow(t: f32) -> vec3<f32> {
  return palette(t, vec3(0.5, 0.5, 0.5),	vec3(0.5, 0.5, 0.5),vec3(1.0, 1.0, 1.0), vec3(0.00, 0.33, 0.67));
}


fn hash3(p: vec2<f32>) -> vec3<f32> {
  let q = vec3( dot(p,vec2(127.1,311.7)), 
				   dot(p,vec2(269.5,183.3)), 
				   dot(p,vec2(419.2,371.9)) );
	return fract(sin(q)*43758.5453);
}

fn voronoise(p: vec2<f32>, u: f32, v: f32) -> f32 {
	let k = 1.0+63.0*pow(1.0-v,6.0);
  let i = floor(p);
  let f = fract(p);
    
	var a = vec2(0., 0.);
  for(var y=-2; y<=2; y++) {
    for(var x=-2; x<=2; x++) {
      let g = vec2(f32(x), f32(y));
      let o = hash3(i + g)*vec3(u, u, 1.);
      let d = g - f + o.xy;
      let w = pow(1.0-smoothstep(0.0, 1.414, length(d)), k);
      a += vec2(o.z*w, w);
    }
  }


  return a.x/a.y;
}