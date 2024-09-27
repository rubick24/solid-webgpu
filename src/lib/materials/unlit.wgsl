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

struct Params {
    albedo: vec3<f32>,
    use_textures: u32, // Bitfield to indicate use value or textures
};

@group(0) @binding(0)
var<uniform> uniforms: BaseUniforms;

@group(0) @binding(1)
var<uniform> params: Params;

@group(0) @binding(2)
var albedo_texture: texture_2d<f32>;

@group(0) @binding(3)
var texture_sampler: sampler;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let world_position = (uniforms.model * vec4<f32>(input.POSITION, 1.0)).xyz;
    let view_position = (uniforms.view * vec4<f32>(world_position, 1.0)).xyz;
    output.clip_position = uniforms.projection * vec4<f32>(view_position, 1.0);
    output.uv = input.TEXCOORD_0;
    return output;
}

fn get_values(uv: vec2<f32>) -> Params {
    var result = params;

    if (params.use_textures & 1u) != 0u {
        result.albedo = textureSample(albedo_texture, texture_sampler, uv).rgb;
    }

    return result;
}


const PI: f32 = 3.14159265359;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {


    let values = get_values(input.uv);

    let color = values.albedo;

    // // Tone mapping
    // let mapped = color / (color + vec3<f32>(1.0));
    // // Gamma correction
    // let corrected = pow(mapped, vec3<f32>(1.0 / 2.2));

    return vec4<f32>(color, 1.0);
}