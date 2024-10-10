struct VertexInput {
    @location(0) POSITION: vec3<f32>,
    @location(1) NORMAL: vec3<f32>,
    @location(2) TANGENT: vec4<f32>,
    @location(3) TEXCOORD_0: vec2<f32>
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) world_position: vec3<f32>,
    @location(1) world_normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
};

struct BaseUniforms {
    model: mat4x4<f32>,
    view: mat4x4<f32>,
    projection: mat4x4<f32>,
    model_view: mat4x4<f32>,
    normal_matrix: mat3x3<f32>,
    camera_position: vec3<f32>
};

struct PBRParams {
    albedo: vec3<f32>,
    metallic: f32,
    roughness: f32,
    ao: f32,
    use_textures: u32, // Bitfield to indicate use value or textures
};

struct PointLight {
    position: vec3<f32>,
    color: vec3<f32>,
    intensity: f32
};
struct DirectionalLight {
    color: vec3<f32>,
    direction: vec3<f32>,
    intensity: f32
};
struct SpotLight {
    position: vec3<f32>,
    color: vec3<f32>,
    direction: vec3<f32>,
    intensity: f32,
    radius: f32,
    inner_angle: f32,
    outer_angle: f32
};


@group(0) @binding(0)
var<uniform> uniforms: BaseUniforms;

@group(0) @binding(1)
var<uniform> pbr_params: PBRParams;

@group(0) @binding(2)
var<uniform> point_lights: array<PointLight, 1>;

@group(0) @binding(3)
var albedo_texture: texture_2d<f32>;

@group(0) @binding(4)
var occlusion_roughness_metallic_texture: texture_2d<f32>;

@group(0) @binding(5)
var texture_sampler: sampler;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let world_position = (uniforms.model * vec4<f32>(input.POSITION, 1.0)).xyz;
    let view_position = (uniforms.view * vec4<f32>(world_position, 1.0)).xyz;
    output.clip_position = uniforms.projection * vec4<f32>(view_position, 1.0);
    output.world_position = world_position;
    output.world_normal = normalize((uniforms.model * vec4<f32>(input.NORMAL, 0.0)).xyz);
    output.uv = input.TEXCOORD_0;
    return output;
}

fn get_pbr_values(uv: vec2<f32>) -> PBRParams {
    var result = pbr_params;

    if (pbr_params.use_textures & 1u) != 0u {
        result.albedo = textureSample(albedo_texture, texture_sampler, uv).rgb;
    }

    if (pbr_params.use_textures & 2u) != 0u {
        let orm = textureSample(occlusion_roughness_metallic_texture, texture_sampler, uv);
        result.metallic = orm.b;
        result.roughness = orm.g;
        result.ao = orm.r;
    }

    return result;
}


const PI: f32 = 3.14159265359;

fn DistributionGGX(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(N, H), 0.0);
    let NdotH2 = NdotH * NdotH;

    let num = a2;
    let denom = (NdotH2 * (a2 - 1.0) + 1.0);
    return num / (PI * denom * denom);
}

fn GeometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
    let r = (roughness + 1.0);
    let k = (r * r) / 8.0;

    return NdotV / (NdotV * (1.0 - k) + k);
}

fn GeometrySmith(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
    let NdotV = max(dot(N, V), 0.0);
    let NdotL = max(dot(N, L), 0.0);
    let ggx2 = GeometrySchlickGGX(NdotV, roughness);
    let ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}

fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn calculatePointLight(light: PointLight, input: VertexOutput, pbr_values: PBRParams) -> vec3<f32> {
    let N = normalize(input.world_normal);
    let V = normalize(uniforms.camera_position - input.world_position);

    let F0 = mix(vec3<f32>(0.04), pbr_values.albedo, pbr_values.metallic);

    // Calculate per-light radiance
    let L = normalize(light.position - input.world_position);
    let H = normalize(V + L);
    let distance = length(light.position - input.world_position);
    let attenuation = 1.0 / (distance * distance);
    let radiance = light.color * attenuation;

    // Cook-Torrance BRDF
    let NDF = DistributionGGX(N, H, pbr_values.roughness);
    let G = GeometrySmith(N, V, L, pbr_values.roughness);
    let F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    let numerator = NDF * G * F;
    let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    let specular = numerator / denominator;

    let kS = F;
    let kD = (vec3(1.0) - kS) * (1.0 - pbr_values.metallic);

    let NdotL = max(dot(N, L), 0.0);
    return (kD * pbr_values.albedo / PI + specular) * radiance * NdotL;
}

fn calculateDirectionalLight(light: DirectionalLight, input: VertexOutput, pbr_values: PBRParams) -> vec3<f32> {
    let N = normalize(input.world_normal);
    let V = normalize(uniforms.camera_position - input.world_position);

    let F0 = mix(vec3<f32>(0.04), pbr_values.albedo, pbr_values.metallic);

    let L = normalize(-light.direction);
    let H = normalize(V + L);

    // Cook-Torrance BRDF
    let NDF = DistributionGGX(N, H, pbr_values.roughness);
    let G = GeometrySmith(N, V, L, pbr_values.roughness);
    let F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    let numerator = NDF * G * F;
    let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    let specular = numerator / denominator;

    let kS = F;
    let kD = (vec3(1.0) - kS) * (1.0 - pbr_values.metallic);

    let NdotL = max(dot(N, L), 0.0);
    return (kD * pbr_values.albedo / PI + specular) * light.color * light.intensity * NdotL;
}

fn calculateSpotLight(light: SpotLight, input: VertexOutput, pbr_values: PBRParams) -> vec3<f32> {
    let N = normalize(input.world_normal);
    let V = normalize(uniforms.camera_position - input.world_position);
    let F0 = mix(vec3<f32>(0.04), pbr_values.albedo, pbr_values.metallic);


    let L = normalize(light.position - input.world_position);
    let H = normalize(V + L);
    let distance = length(light.position - input.world_position);
    let attenuation = 1.0 / (distance * distance);

    let cos_theta = dot(L, normalize(-light.direction));
    let epsilon = cos(light.inner_angle) - cos(light.outer_angle);
    let intensity = clamp((cos_theta - cos(light.outer_angle)) / epsilon, 0.0, 1.0);

    if intensity <= 0.0 {
        return vec3<f32>(0.0);
    }
    
    // Cook-Torrance BRDF
    let NDF = DistributionGGX(N, H, pbr_values.roughness);
    let G = GeometrySmith(N, V, L, pbr_values.roughness);
    let F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    let numerator = NDF * G * F;
    let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    let specular = numerator / denominator;

    let kS = F;
    let kD = (vec3(1.0) - kS) * (1.0 - pbr_values.metallic);

    let NdotL = max(dot(N, L), 0.0);
    return (kD * pbr_values.albedo / PI + specular) * light.color * light.intensity * NdotL * attenuation * intensity;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {

    let pbr_values = get_pbr_values(input.uv);

    var Lo = vec3<f32>(0.0);

    for (var i = 0; i < 1; i++) {
        let light = point_lights[i];
        Lo += calculatePointLight(light, input, pbr_values);
    }
    let directional_lights = array<DirectionalLight, 1>(
        DirectionalLight(vec3f(0., 0.5, 1.), vec3f(0., 0., -1.), 1.)
    );
    for (var i = 0; i < 1; i++) {
        let light = directional_lights[i];
        Lo += calculateDirectionalLight(light, input, pbr_values);
    }
    // let spot_lights = array<SpotLight, 1>(
    //     SpotLight(vec3f(0., 0., 3.), vec3f(0.5, 0.5, 0.), vec3f(0., 0., -1.), 10., 0.5, 0.3, 0.5)
    // );
    // for (var i = 0; i < 1; i++) {
    //     let light = spot_lights[i];
    //     Lo += calculateSpotLight(light, input, pbr_values);
    // }

    let ambient = vec3<f32>(0.03) * pbr_values.albedo * pbr_values.ao;
    let color = ambient + Lo;

    // Tone mapping
    let mapped = color / (color + vec3<f32>(1.0));
    // Gamma correction
    let corrected = pow(mapped, vec3<f32>(1.0 / 2.2));

    return vec4<f32>(corrected, 1.0);
}