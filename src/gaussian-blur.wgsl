
struct VertexUniforms {
  pixel_count: u32,
  kernel_size: u32,
  texture_width: u32,
  texture_height: u32
};
@group(0) @binding(0) var<uniform> uniforms: VertexUniforms;
@group(0) @binding(1) var<storage> kernel: array<f32>;

@group(0) @binding(2) var input_texture: texture_2d<f32>;
@group(0) @binding(3) var output_texture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if index >= uniforms.pixel_count { return; }

    let coords = vec2(i32(index % uniforms.texture_width), i32(index / uniforms.texture_height));
    let kernel_size = i32(uniforms.kernel_size);

    let width = i32(uniforms.texture_width);

    var dst_color = vec4(0.);

    for (var i = -kernel_size; i <= kernel_size; i++) {
        let px = min(width - 1, max(0, coords.x + i));
        let w = kernel[i + kernel_size];
        let col = textureLoad(input_texture, vec2(px, coords.y), 0);
        dst_color += col * w;
    }

    textureStore(output_texture, coords, dst_color);
}


@compute @workgroup_size(64)
fn main_vertical(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if index >= uniforms.pixel_count { return; }

    let coords = vec2(i32(index % uniforms.texture_width), i32(index / uniforms.texture_height));
    let kernel_size = i32(uniforms.kernel_size);

    let height = i32(uniforms.texture_height);

    var dst_color = vec4(0.);

    for (var i = -kernel_size; i <= kernel_size; i++) {
        let py = min(height - 1, max(0, coords.y + i));
        let w = kernel[i + kernel_size];
        let col = textureLoad(input_texture, vec2(coords.x, py), 0);
        dst_color += col * w;
    }

    textureStore(output_texture, coords, dst_color);
}