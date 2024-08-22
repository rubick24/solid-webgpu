struct BaseUniform {
    resolution: vec2f,
    time: f32,
    time_delta: f32,
    model_matrix: mat4x4<f32>,
    view_matrix: mat4x4<f32>,
    projection_matrix: mat4x4<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) vert_pos: vec3<f32>,
}

@group(0) @binding(0) var<uniform> base_uniform: BaseUniform;
@group(0) @binding(1) var base_texture: texture_2d<f32>;
@group(0) @binding(2) var base_sampler: sampler;

@vertex
fn vs_main(@location(0) position: vec3f) -> VertexOutput {
    var out: VertexOutput;
    out.clip_position = base_uniform.projection_matrix * base_uniform.view_matrix * base_uniform.model_matrix * vec4(position, 1.);
    out.vert_pos = position;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {

    let uv = (in.vert_pos.xy + 1.) / 2.;
    let a = textureSample(base_texture, base_sampler, uv);

    return vec4(a);
}


const PI = 3.141592653589793;
