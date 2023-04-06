import { canvasTexturePtr, CY, } from "./gpu-registry.js";
import { createCyStruct } from "./gpu-struct.js";
import { cloth_shader, particle_shader, rope_shader } from "./shaders.js";
import { sceneBufPtr, canvasDepthTex } from "./std-pipeline.js";
// TODO:
//  [x] pipeline attachements / outputs
//        use case: two cameras
//  [ ] mesh pool handle enable/disable
//  [x] textures and samplers as resources
//  [x] resource ping-ponging for cloth texs and boids
//  [x] shader VertexInput struct auto gen
//  [x] debug view of the depth buffer
//  [ ] shadows
//  [x] debug view of any texture
//  [x] dynamic resizing texture based on canvas size
//  [x] split screen
//  [ ] re-enable anti aliasing
//  [ ] ECS integration w/ custom gpu data
//  [ ] general usable particle system
//  [ ] split *ptr CY.register from webgpu impl
//  [ ] webgl impl
//  [ ] multiple pipeline outputs
//  [ ] deferred rendering
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
    shader: particle_shader,
    shaderVertexEntry: "vert_main",
    shaderFragmentEntry: "frag_main",
    output: canvasTexturePtr,
    depthStencil: canvasDepthTex,
});
const CLOTH_SIZE = 10; // TODO(@darzu):
const clothTexPtrDesc = {
    size: [CLOTH_SIZE, CLOTH_SIZE],
    format: "rgba32float",
    init: () => {
        const clothData = new Float32Array(10 * 10 * 4);
        for (let x = 0; x < 10; x++) {
            for (let y = 0; y < 10; y++) {
                const i = (y + x * 10) * 3;
                clothData[i + 0] = i / clothData.length;
                clothData[i + 1] = i / clothData.length;
                clothData[i + 2] = i / clothData.length;
            }
        }
        return clothData;
    },
};
const clothTexPtr0 = CY.registerTexPtr("clothTex0", {
    ...clothTexPtrDesc,
});
const clothTexPtr1 = CY.registerTexPtr("clothTex1", {
    ...clothTexPtrDesc,
});
// TODO(@darzu): CLOTH
let clothReadIdx = 1;
const cmpClothPipelinePtr0 = CY.registerCompPipeline("clothComp0", {
    resources: [
        { ptr: clothTexPtr0, access: "read", alias: "inTex" },
        { ptr: clothTexPtr1, access: "write", alias: "outTex" },
    ],
    shader: cloth_shader,
    shaderComputeEntry: "main",
});
const cmpClothPipelinePtr1 = CY.registerCompPipeline("clothComp1", {
    resources: [
        { ptr: clothTexPtr1, access: "read", alias: "inTex" },
        { ptr: clothTexPtr0, access: "write", alias: "outTex" },
    ],
    shader: cloth_shader,
    shaderComputeEntry: "main",
});
//# sourceMappingURL=xp-pipelines.js.map