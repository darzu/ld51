import { CY, canvasTexturePtr } from "./gpu-registry.js";
import { createCyStruct } from "./gpu-struct.js";
import { rope_shader } from "./shaders.js";
import { sceneBufPtr, canvasDepthTex } from "./std-pipeline.js";
export const RopeStickStruct = createCyStruct({
    aIdx: "u32",
    bIdx: "u32",
    length: "f32",
});
export const RopePointStruct = createCyStruct({
    position: "vec3<f32>",
    prevPosition: "vec3<f32>",
    locked: "f32",
}, {
    isUniform: false,
    serializer: (data, _, offsets_32, views) => {
        views.f32.set(data.position, offsets_32[0]);
        views.f32.set(data.prevPosition, offsets_32[1]);
        views.f32[offsets_32[2]] = data.locked;
    },
});
export const CLOTH_W = 12;
function generateRopeGrid() {
    // setup scene data:
    // TODO(@darzu): allow init to pass in above
    // setup rope
    // TODO(@darzu): ROPE
    const ropePointData = [];
    const ropeStickData = [];
    // let n = 0;
    const idx = (x, y) => {
        if (x >= CLOTH_W || y >= CLOTH_W)
            return CLOTH_W * CLOTH_W;
        return x * CLOTH_W + y;
    };
    for (let x = 0; x < CLOTH_W; x++) {
        for (let y = 0; y < CLOTH_W; y++) {
            let i = idx(x, y);
            // assert(i === n, "i === n");
            const pos = [x, y + 4, 0];
            const p = {
                position: pos,
                prevPosition: pos,
                locked: 0.0,
            };
            ropePointData[i] = p;
            // if (y + 1 < W && x + 1 < W) {
            // if (y + 1 < W) {
            ropeStickData.push({
                aIdx: i,
                bIdx: idx(x, y + 1),
                length: 1.0,
            });
            // }
            // if (x + 1 < W) {
            ropeStickData.push({
                aIdx: i,
                bIdx: idx(x + 1, y),
                length: 1.0,
            });
            // }
            // }
            // n++;
        }
    }
    console.log(RopeStickStruct.wgsl(true));
    // fix points
    ropePointData[idx(0, CLOTH_W - 1)].locked = 1.0;
    ropePointData[idx(CLOTH_W - 1, CLOTH_W - 1)].locked = 1.0;
    // for (let i = 0; i < ropePointData.length; i++)
    //   if (ropePointData[i].locked > 0) console.log(`locked: ${i}`);
    // console.dir(ropePointData);
    // console.dir(ropeStickData);
    return { ropePointData, ropeStickData };
}
let _initRopePointData;
let _initRopeStickData;
const genRopePointData = () => {
    if (!_initRopePointData) {
        let res = generateRopeGrid();
        _initRopePointData = res.ropePointData;
        _initRopeStickData = res.ropeStickData;
    }
    return _initRopePointData;
};
const genRopeStickData = () => {
    if (!_initRopeStickData) {
        let res = generateRopeGrid();
        _initRopePointData = res.ropePointData;
        _initRopeStickData = res.ropeStickData;
    }
    return _initRopeStickData;
};
const ropePointBufPtr = CY.registerManyBufPtr("ropePoint", {
    struct: RopePointStruct,
    init: genRopePointData,
});
const ropeStickBufPtr = CY.registerManyBufPtr("ropeStick", {
    struct: RopeStickStruct,
    init: genRopeStickData,
});
const compRopePipelinePtr = CY.registerCompPipeline("ropeComp", {
    resources: [sceneBufPtr, ropePointBufPtr, ropeStickBufPtr],
    shader: rope_shader,
    shaderComputeEntry: "main",
});
// rope particle render
const ParticleVertStruct = createCyStruct({
    position: "vec3<f32>",
}, {
    isCompact: true,
});
const initParticleVertData = () => [
    { position: [1, 1, 1] },
    { position: [1, -1, -1] },
    { position: [-1, 1, -1] },
    { position: [-1, -1, 1] },
];
const particleVertBufPtr = CY.registerManyBufPtr("particleVert", {
    struct: ParticleVertStruct,
    init: initParticleVertData,
});
const initParticleIdxData = () => new Uint16Array([2, 1, 0, 3, 2, 0, 1, 3, 0, 2, 3, 1]);
const particleIdxBufPtr = CY.registerIdxBufPtr("particleIdx", {
    init: initParticleIdxData,
});
const renderRopePipelineDesc = CY.registerRenderPipeline("renderRope", {
    resources: [sceneBufPtr],
    meshOpt: {
        vertex: particleVertBufPtr,
        instance: ropePointBufPtr,
        index: particleIdxBufPtr,
        stepMode: "per-instance",
    },
    shaderVertexEntry: "vert_main",
    shaderFragmentEntry: "frag_main",
    output: canvasTexturePtr,
    depthStencil: canvasDepthTex,
    shader: () => `
struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) color : vec3<f32>,
};

@stage(vertex)
fn vert_main(vIn: VertexInput, iIn: InstanceInput) -> VertexOutput {
  let vertPos = vIn.position;
  let position = iIn.position;
  let prevPosition = iIn.prevPosition;
  let locked = iIn.locked;

  // return vec4<f32>(vertPos, 1.0);
  // let worldPos = vertPos;
  let worldPos = vertPos * 0.3 + position;
  let screenPos = scene.cameraViewProjMatrix * vec4<f32>(worldPos, 1.0);

  // return vec4<f32>(vertPos, 1.0);
  // return vec4<f32>(vertPos + position, 1.0);

  var output : VertexOutput;
  output.position = screenPos;
  output.color = vec3<f32>(locked, 0.0, 0.0);
  // output.color = vec3<f32>(0.0, f32(bIdx) / 10.0, locked);
  // output.color = vec3<f32>(f32(aIdx) / 10.0, 0.0, locked);
  // output.color = vec3<f32>(f32(aIdx) / 10.0, f32(bIdx) / 10.0, locked);
  // output.color = vec3<f32>(0.5, locked, 0.5);
  // output.color = vec3<f32>(0.5, locked.r, 0.5);

  return output;
}

@stage(fragment)
fn frag_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(input.color, 1.0);
}
`,
});
//# sourceMappingURL=xp-ropegrid-pipeline.js.map