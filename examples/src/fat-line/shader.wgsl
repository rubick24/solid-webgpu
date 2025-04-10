struct VertexInput {
    @location(0) POSITION: vec3<f32>,
    @location(1) TANGENT: vec3<f32>,
    @location(2) SIDE: f32,
    @location(3) IS_ENDPOINT: u32,
    @location(4) ANGLE: f32
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

const worldLineWidth: f32 = 0.3;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    let halfWidth = worldLineWidth * 0.5;
    var finalPosition = input.POSITION;

    if (input.IS_ENDPOINT == 0u) {
        let camDir = normalize(uniforms.camera_position - input.POSITION);
        var dir = cross(camDir, input.TANGENT);
        dir = normalize(dir);
        finalPosition += dir * halfWidth * input.SIDE;
    } else {
        // joint
        let camRight = normalize(vec3(
            uniforms.view[0][0],
            uniforms.view[1][0],
            uniforms.view[2][0]
        ));
        let camUp = normalize(vec3(
            uniforms.view[0][1],
            uniforms.view[1][1],
            uniforms.view[2][1]
        ));

        let angle = input.ANGLE;
        let circleX = cos(angle) * halfWidth;
        let circleY = sin(angle) * halfWidth;
        finalPosition = input.POSITION + (camRight * circleX + camUp * circleY);
    }

    var output: VertexOutput;
    let world_position = (uniforms.model * vec4<f32>(finalPosition, 1.0)).xyz;
    let view_position = (uniforms.view * vec4<f32>(world_position, 1.0)).xyz;
    output.clip_position = uniforms.projection * vec4<f32>(view_position, 1.0);
    output.uv = vec2<f32>(0.0, 0.0);
    return output;
}
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}
