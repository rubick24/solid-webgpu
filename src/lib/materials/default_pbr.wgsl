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

struct PunctualLight {
    position: vec3<f32>,
    direction: vec3<f32>,
    color: vec3<f32>,
    intensity: f32,
    range: f32,
    inner_cone_angle: f32,
    outer_cone_angle: f32,
    light_type: u32,
}

@group(0) @binding(0)
var<uniform> uniforms: BaseUniforms;

@group(0) @binding(1)
var<uniform> pbr_params: PBRParams;

@group(0) @binding(2)
var albedo_texture: texture_2d<f32>;

@group(0) @binding(3)
var occlusion_roughness_metallic_texture: texture_2d<f32>;

@group(0) @binding(4)
var texture_sampler: sampler;

@group(0) @binding(5)
var<uniform> punctual_lights: array<PunctualLight, 1>;

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

fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
fn distributionGGX(NdotH: f32, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH2 = NdotH * NdotH;
    let denom = NdotH2 * (a2 - 1.0) + 1.0;
    return a2 / (3.14159265359 * denom * denom);
}
fn geometrySmith(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;
    let ggx1 = NdotV / (NdotV * (1.0 - k) + k);
    let ggx2 = NdotL / (NdotL * (1.0 - k) + k);
    return ggx1 * ggx2;
}

fn calculatePointLight(light: PunctualLight, input: VertexOutput, pbr_values: PBRParams) -> vec3<f32> {
    let distance = length(light.position - input.world_position);


    let light_dir = normalize(light.position - input.world_position);
    let view_dir = normalize(uniforms.camera_position - input.world_position);

    // Attenuation
    let attenuation = clamp(1.0 - pow(distance / light.range, 4.), 0., 1.) / (distance * distance);

    let radiance = light.color * light.intensity * attenuation;

    // Cook-Torrance BRDF
    let NdotV = max(dot(input.world_normal, view_dir), 0.0);
    let NdotL = max(dot(input.world_normal, light_dir), 0.0);
    let HalfDir = normalize(view_dir + light_dir);
    let NdotH = max(dot(input.world_normal, HalfDir), 0.0);

    let F0 = mix(vec3<f32>(0.04), pbr_values.albedo, pbr_values.metallic);
    let F = fresnelSchlick(max(dot(HalfDir, view_dir), 0.0), F0);
    let D = distributionGGX(NdotH, pbr_values.roughness);
    let G = geometrySmith(NdotV, NdotL, pbr_values.roughness);

    let numerator = D * G * F;
    let denominator = 4.0 * NdotV * NdotL + 0.0001;
    let specular = numerator / denominator;

    let kS = F;
    let kD = (vec3<f32>(1.0) - kS) * (1.0 - pbr_values.metallic);

    let diffuse = kD * pbr_values.albedo / 3.14159265359;

    return (diffuse + specular) * radiance * NdotL;
}

fn calculateDirectionalLight(light: PunctualLight, input: VertexOutput, pbr_values: PBRParams) -> vec3<f32> {
    let light_dir = normalize(-light.direction);
    let view_dir = normalize(uniforms.camera_position - input.world_position);

    // Radiance (no attenuation for directional light)
    let radiance = light.color * light.intensity;

    // Cook-Torrance BRDF
    let NdotV = max(dot(input.world_normal, view_dir), 0.0);
    let NdotL = max(dot(input.world_normal, light_dir), 0.0);
    let HalfDir = normalize(view_dir + light_dir);
    let NdotH = max(dot(input.world_normal, HalfDir), 0.0);

    let F0 = mix(vec3<f32>(0.04), pbr_values.albedo, pbr_values.metallic);
    let F = fresnelSchlick(max(dot(HalfDir, view_dir), 0.0), F0);
    let D = distributionGGX(NdotH, pbr_values.roughness);
    let G = geometrySmith(NdotV, NdotL, pbr_values.roughness);

    let numerator = D * G * F;
    let denominator = 4.0 * NdotV * NdotL + 0.0001;
    let specular = numerator / denominator;

    let kS = F;
    let kD = (vec3<f32>(1.0) - kS) * (1.0 - pbr_values.metallic);

    let diffuse = kD * pbr_values.albedo / 3.14159265359;

    return (diffuse + specular) * radiance * NdotL;
}

fn getSpotFactor(light: PunctualLight, light_dir: vec3<f32>) -> f32 {
    let spot_dir = normalize(-light.direction);

    // can be calcuated on cpu
    let light_angle_scale = 1.0 / max(0.001, cos(light.inner_cone_angle) - cos(light.outer_cone_angle));
    let light_angle_fffset = -cos(light.outer_cone_angle) * light_angle_scale;

    let cd = dot(spot_dir, light_dir);
    let angular_attenuation = saturate(cd * light_angle_scale + light_angle_fffset);
    return angular_attenuation * angular_attenuation;
}

fn calculateSpotLight(light: PunctualLight, input: VertexOutput, pbr_values: PBRParams) -> vec3<f32> {
    let distance = length(light.position - input.world_position);
    if distance > light.range {
        return vec3(0.);
    }
    let view_dir = normalize(uniforms.camera_position - input.world_position);
    let light_dir = normalize(light.position - input.world_position);
    // Attenuation
    let attenuation = clamp(1.0 - pow(distance / light.range, 4.), 0., 1.) / (distance * distance);

    // Spot light cone attenuation
    let spot_factor = getSpotFactor(light, light_dir);

    let radiance = light.color * light.intensity * attenuation * spot_factor;

    // Cook-Torrance BRDF
    let NdotV = max(dot(input.world_normal, view_dir), 0.0);
    let NdotL = max(dot(input.world_normal, light_dir), 0.0);
    let HalfDir = normalize(view_dir + light_dir);
    let NdotH = max(dot(input.world_normal, HalfDir), 0.0);

    let F0 = mix(vec3<f32>(0.04), pbr_values.albedo, pbr_values.metallic);
    let F = fresnelSchlick(max(dot(HalfDir, view_dir), 0.0), F0);
    let D = distributionGGX(NdotH, pbr_values.roughness);
    let G = geometrySmith(NdotV, NdotL, pbr_values.roughness);

    let numerator = D * G * F;
    let denominator = 4.0 * NdotV * NdotL + 0.0001;
    let specular = numerator / denominator;

    let kS = F;
    let kD = (vec3<f32>(1.0) - kS) * (1.0 - pbr_values.metallic);

    let diffuse = kD * pbr_values.albedo / 3.14159265359;

    // return vec3(spot_factor);
    return (diffuse + specular) * radiance * NdotL;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {

    let pbr_values = get_pbr_values(input.uv);

    var Lo = vec3<f32>(0.0);

    for (var i = 0; i < 1; i++) {
        let light = punctual_lights[i];

        // Lo += calculatePointLight(light, input, pbr_values);
        // Lo += calculateDirectionalLight(light, input, pbr_values);
        // Lo += calculateSpotLight(light, input, pbr_values);
        if light.light_type == 0u {
            Lo += calculateDirectionalLight(light, input, pbr_values);
        } else if light.light_type == 1u {
            Lo += calculatePointLight(light, input, pbr_values);
        } else if light.light_type == 2u {
            Lo += calculateSpotLight(light, input, pbr_values);
        }
    }

    // return vec4(Lo, 1.0);
    let ambient = vec3<f32>(0.03) * pbr_values.albedo * pbr_values.ao;
    let color = ambient + Lo;

    // Tone mapping
    let mapped = color / (color + vec3<f32>(1.0));
    // Gamma correction
    let corrected = pow(mapped, vec3<f32>(1.0 / 2.2));

    return vec4<f32>(corrected, 1.0);
}