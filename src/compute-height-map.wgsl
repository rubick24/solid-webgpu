
struct VertexUniforms {
  vertex_count: u32,
  vertex_stride: u32, // NEW: Number of *floats* between each normal value
  texture_width: u32,
  texture_height: u32
};
@group(0) @binding(0) var<uniform> uniforms: VertexUniforms;
// UPDATED: Note that this is no longer an array of vec3fs!
@group(0) @binding(1) var<storage, read_write> vertices: array<f32>;
@group(0) @binding(2) var base_texture : texture_2d<f32>;

// NEW: Get the normal vector at the given index
// fn get_vec3(index: u32) -> vec3f {
//     let offset = index * vertex.stride;
//     return vec3f(
//         vertices[offset],
//         vertices[offset + 1u],
//         vertices[offset + 2u]
//     );
// }

// NEW: Set the normal vector at the given index
fn set_vec3(index: u32, value: vec3f) {
    let offset = index * uniforms.vertex_stride;
    vertices[offset] = value.x;
    vertices[offset + 1u] = value.y;
    vertices[offset + 2u] = value.z;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if index >= uniforms.vertex_count { return; }

    // Invert the normal in-place
    let uv = vec2(
        (global_id.x % uniforms.texture_width),
        (global_id.x / uniforms.texture_width)
    );
    let color = textureLoad(base_texture, uv, 0);
    set_vec3(index, vec3(f32(uv.x), color.r, f32(uv.y)));
}