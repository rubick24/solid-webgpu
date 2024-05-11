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
@group(0) @binding(1) var base_color : texture_2d<f32>;
@group(0) @binding(2) var base_color_sampler : sampler;

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

    var r = smoothstep(0., 0.3, sd_box(uv, vec2(0.88, 0.45)));
    var n = noise2(uv * base_uniform.resolution.y / 2.);
    var v = step(r, n);

    var b = fractal_noise3(vec3(uv / 5., base_uniform.time / 10000.), 2u);

    var outline_hightlight = v * (r * r * r * 0.6);
    return vec4(outline_hightlight + v * rainbow(map_range_linear(b + n * 0.1, 0., 1., 0.3, 0.6)), 1.);
}


const PI = 3.141592653589793;


fn sd_box(p: vec2<f32>, b: vec2<f32>) -> f32 {
    var d = abs(p) - b;
    return length(max(d, vec2(0.))) + min(max(d.x, d.y), 0.);
}

fn palette(t: f32, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>, d: vec3<f32>) -> vec3<f32> {
    return a + b * cos(6.28318 * (c * t + d));
}

fn rainbow(t: f32) -> vec3<f32> {
    return palette(t, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5), vec3(1.0, 1.0, 1.0), vec3(0.00, 0.33, 0.67));
}

fn wang_hash(_seed: u32) -> u32 {
    var seed = (_seed ^ 61u) ^ (_seed >> 16u);
    seed *= 9u;
    seed = seed ^ (seed >> 4u);
    seed *= 0x27d4eb2du;
    seed = seed ^ (seed >> 15u);
    return seed;
}

fn hash2(x: u32, y: u32) -> u32 {
    return wang_hash(wang_hash(x) + y);
}
fn hash3(x: u32, y: u32, z: u32) -> u32 {
    return wang_hash(wang_hash(wang_hash(x) + y) + z);
}

fn hash_vec2_to_float(v: vec2f) -> f32 {
    return f32(hash2(bitcast<u32>(v.x), bitcast<u32>(v.y))) / 4294967295f;
}
fn hash_vec3_to_float(v: vec3f) -> f32 {
    return f32(hash3(bitcast<u32>(v.x), bitcast<u32>(v.y), bitcast<u32>(v.z))) / 4294967295f;
}


fn noise2(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash_vec2_to_float(i + vec2(0., 0.)),
            hash_vec2_to_float(i + vec2(1., 0.)), u.x),
        mix(hash_vec2_to_float(i + vec2(0., 1.)),
            hash_vec2_to_float(i + vec2(1., 1.)), u.x), u.y
    );
}

fn noise3(p: vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(
            mix(hash_vec3_to_float(i + vec3(0., 0., 0.)),
                hash_vec3_to_float(i + vec3(1., 0., 0.)), u.x),
            mix(hash_vec3_to_float(i + vec3(0., 1., 0.)),
                hash_vec3_to_float(i + vec3(1., 1., 0.)), u.x),
            u.y
        ),
        mix(
            mix(hash_vec3_to_float(i + vec3(0., 0., 1.)),
                hash_vec3_to_float(i + vec3(1., 0., 1.)), u.x),
            mix(hash_vec3_to_float(i + vec3(0., 1., 1.)),
                hash_vec3_to_float(i + vec3(1., 1., 1.)), u.x),
            u.y
        ),
        u.z
    );
}

fn fractal_noise2(p: vec2<f32>, octave: u32) -> f32 {
    var uv = p * 8.;
    let m = mat2x2(1.6, 1.2, -1.2, 1.6);
    var f = 0.;
    for (var i = 0u; i < octave; i += 1u) {
        f += noise2(uv) * (1. / f32(2u << i));
        uv = m * uv;
    }
    return f;
}


fn fractal_noise3(p: vec3<f32>, octave: u32) -> f32 {
    var uv = p * 8.;

    // scale(roate(normalize(vec3(1.)), PI/4.), 2.)
    let m = mat3x3(
        1.60947570824873, 1.011758726803361, -0.6212344350520911,
        -0.6212344350520911, 1.60947570824873, 1.011758726803361,
        1.011758726803361, -0.6212344350520911, 1.60947570824873
    );
    var f = 0.;
    for (var i = 0u; i < octave; i += 1u) {
        f += noise3(uv) * (1. / f32(2u << i));
        uv = m * uv;
    }
    return f;
}


fn smin(a: f32, b: f32, c: f32) -> f32 {
    if c != 0.0 {
        let h = max(c - abs(a - b), 0.0) / c;
        return min(a, b) - h * h * h * c * (1.0 / 6.0);
    } else {
        return min(a, b);
    }
}

fn smax(a: f32, b: f32, c: f32) -> f32 {
    return -smin(-a, -b, c);
}

fn map_range_linear(value: f32,
    from_min: f32,
    from_max: f32,
    to_min: f32,
    to_max: f32) -> f32 {
    if from_max != from_min {
        return to_min + ((value - from_min) / (from_max - from_min)) * (to_max - to_min);
    } else {
        return 0.0;
    }
}

fn pingpong(a: f32, b: f32) -> f32 {
    return abs(fract((a - b) / (b * 2.0)) * b * 2.0 - b);
}