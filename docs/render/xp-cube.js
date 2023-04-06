import { CY } from "./gpu-registry.js";
import { sceneBufPtr, meshPoolPtr, mainTexturePtr, canvasDepthTex, canvasTexturePtr, } from "./std-scene.js";
export const cubeRenderPipeline = CY.createRenderPipeline("cubeRender", {
    globals: [sceneBufPtr],
    meshOpt: {
        pool: meshPoolPtr,
        stepMode: "per-mesh-handle",
    },
    shaderVertexEntry: "vert_main",
    shaderFragmentEntry: "frag_main",
    output: [
        {
            ptr: mainTexturePtr,
            clear: "once",
            // defaultColor: [0.0, 0.0, 0.0, 1.0],
            defaultColor: [0.1, 0.1, 0.1, 1.0],
            // defaultColor: [0.7, 0.8, 1.0, 1.0],
        },
    ],
    depthStencil: canvasDepthTex,
    shader: () => `
struct VertexOutput {
    @location(0) @interpolate(flat) color : vec3<f32>,
    @builtin(position) position : vec4<f32>,
};

@stage(vertex)
fn vert_main(input: VertexInput) -> VertexOutput {
    var output : VertexOutput;

    output.position = 
      scene.cameraViewProjMatrix 
      * meshUni.transform 
      * vec4<f32>(input.position, 1.0);

    output.color = color + meshUni.tint;

    return output;
}

struct FragOut {
  @location(0) color: vec4<f32>,
}

@stage(fragment)
fn frag_main(input: VertexOutput) -> FragOut {

    var out: FragOut;
    out.color = vec4(input.color, 1.0);

    return out;
}
`,
});
// TODO(@darzu): rg32uint "uint"
// rg16uint "uint"
export const cubePost = CY.createRenderPipeline("cubePost", {
    globals: [{ ptr: mainTexturePtr, alias: "colorTex" }],
    meshOpt: {
        vertexCount: 6,
        stepMode: "single-draw",
    },
    output: [canvasTexturePtr],
    shader: () => {
        return `
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) fragUV : vec2<f32>,
};

@stage(vertex)
fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  let xs = vec2(-1.0, 1.0);
  let ys = vec2(-1.0, 1.0);
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(xs.x, ys.x),
    vec2<f32>(xs.y, ys.x),
    vec2<f32>(xs.y, ys.y),
    vec2<f32>(xs.x, ys.y),
    vec2<f32>(xs.x, ys.x),
    vec2<f32>(xs.y, ys.y),
  );

  var uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
  );

  var output : VertexOutput;
  output.Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
  output.fragUV = uv[VertexIndex];
  return output;
}

@stage(fragment)
fn frag_main(@location(0) fragUV : vec2<f32>) -> @location(0) vec4<f32> {
  var color = textureSample(colorTex, samp, fragUV);

  // vignette
  let edgeDistV = fragUV - 0.5;
  let edgeDist = 1.0 - dot(edgeDistV, edgeDistV) * 0.5;
  color *= edgeDist;
  
  return color;
}
  `;
    },
    shaderFragmentEntry: "frag_main",
    shaderVertexEntry: "vert_main",
});
//# sourceMappingURL=xp-cube.js.map