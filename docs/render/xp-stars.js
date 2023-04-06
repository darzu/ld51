import { CY } from "./gpu-registry.js";
import { createCyStruct } from "./gpu-struct.js";
import { outlinedTexturePtr } from "./std-outline.js";
import { mainDepthTex, sceneBufPtr } from "./std-scene.js";
const StarStruct = createCyStruct({
    pos: "vec3<f32>",
    color: "vec3<f32>",
    size: "f32",
});
let NUM_STARS = 1000;
const starData = CY.createArray("starData", {
    struct: StarStruct,
    init: () => NUM_STARS,
    // forceUsage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
});
export const emissionTexturePtr = CY.createTexture("emissionTexture", {
    size: [100, 100],
    onCanvasResize: (w, h) => [w, h],
    format: "rgba16float",
    init: () => undefined,
});
export const initStars = CY.createComputePipeline("initStars", {
    globals: [starData],
    shaderComputeEntry: "main",
    shader: () => `
  var<private> rand_seed : vec2<f32>;

  fn rand() -> f32 {
      rand_seed.x = fract(cos(dot(rand_seed, vec2<f32>(26.88662389, 200.54042905))) * 240.61722267);
      rand_seed.y = fract(cos(dot(rand_seed, vec2<f32>(58.302370833, 341.7795489))) * 523.34916812);
      return rand_seed.y;
  }

  @stage(compute) @workgroup_size(64)
  fn main(@builtin(global_invocation_id) gId : vec3<u32>) {
    rand_seed = vec2<f32>(f32(gId.x));
    // starDatas.ms[gId.x].pos = vec3(0.0);
    starDatas.ms[gId.x].pos = vec3(rand() - 0.5, rand() - 0.5, rand() - 0.5) 
      * 1000.0;
    starDatas.ms[gId.x].color = vec3(rand(), rand(), rand());
    starDatas.ms[gId.x].size = rand() * 3.0;
  }
  `,
    workgroupCounts: [Math.ceil(NUM_STARS / 64), 1, 1],
});
export const renderStars = CY.createRenderPipeline("renderStars", {
    globals: [starData, sceneBufPtr],
    shader: () => `
  struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) uv : vec2<f32>,
    @location(1) color: vec3<f32>,
  };
  
  @stage(vertex)
  fn vert_main(@builtin(vertex_index) gvIdx : u32) -> VertexOutput {
    let vIdx = gvIdx % 6u;
    let starIdx = gvIdx / 6u;

    let star = starDatas.ms[starIdx];
    // Hmmm
    // let S = 4.0;
    let S = star.size;

    let xs = vec2(-S, S);
    let ys = vec2(-S, S);
    var corners = array<vec3<f32>, 6>(
      vec3<f32>(xs.x, ys.x, 0.0),
      vec3<f32>(xs.y, ys.x, 0.0),
      vec3<f32>(xs.y, ys.y, 0.0),
      vec3<f32>(xs.x, ys.y, 0.0),
      vec3<f32>(xs.x, ys.x, 0.0),
      vec3<f32>(xs.y, ys.y, 0.0),
    );
    let corner = corners[vIdx];

    let right = vec3(
      scene.cameraViewProjMatrix[0][0], 
      scene.cameraViewProjMatrix[1][0], 
      scene.cameraViewProjMatrix[2][0]
    );
    let up = vec3(
      scene.cameraViewProjMatrix[0][1], 
      scene.cameraViewProjMatrix[1][1], 
      scene.cameraViewProjMatrix[2][1]
    );

    let worldPos = star.pos
      + right * corner.x
      + up * corner.y;

    let screenPos = scene.cameraViewProjMatrix * vec4(worldPos, 1.0);

    // let worldPos = corners[vIdx] + star.pos;
    // let pos = pos0 + vec4(corners[vIdx], 0.0);
    // pos.w /= pos.w;
  
    var uv = array<vec2<f32>, 6>(
      vec2<f32>(0.0, 1.0),
      vec2<f32>(1.0, 1.0),
      vec2<f32>(1.0, 0.0),
      vec2<f32>(0.0, 0.0),
      vec2<f32>(0.0, 1.0),
      vec2<f32>(1.0, 0.0),
    );
  
    var output : VertexOutput;
    output.Position = screenPos;
    output.uv = uv[vIdx];
    output.color = star.color;
    return output;
  }
  
  struct FragOut {
    @location(0) emission: vec4<f32>,
    @location(1) color: vec4<f32>,
  }

  @stage(fragment)
  fn frag_main(input: VertexOutput) -> FragOut {
    let dist = length(input.uv - vec2(0.5));
    // TODO: what's the perf difference of alpha vs discard?
    if (dist > 0.5) {
      discard;
    }

    // let invDist = 0.5 / dist;
    // // let invDist = 1.0 / max(dist - 0.1, 0.001);
    // let color = input.color * invDist;

    var out: FragOut;

    out.emission = vec4<f32>(input.color * 0.5, 1.0);
    out.color = vec4<f32>(input.color * 2.0, 1.0);

    return out;
  }
  `,
    shaderVertexEntry: "vert_main",
    shaderFragmentEntry: "frag_main",
    meshOpt: {
        vertexCount: 6 * NUM_STARS,
        stepMode: "single-draw",
    },
    depthStencil: mainDepthTex,
    output: [emissionTexturePtr, outlinedTexturePtr],
});
//# sourceMappingURL=xp-stars.js.map