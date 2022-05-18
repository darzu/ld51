import { mat4, vec3 } from "../gl-matrix.js";
import { jitter } from "../math.js";
import { range } from "../util.js";
import { computeTriangleNormal } from "../utils-3d.js";
import {
  createCyMany,
  createCyOne,
  createCyStruct,
  CyBuffer,
  CyStruct,
  CyStructDesc,
  CyToTS,
} from "./data.js";
import { MeshHandle, MeshPoolOpts } from "./mesh-pool.js";
import { getAABBFromMesh, Mesh } from "./mesh.js";
import {
  registerCompPipeline,
  registerRenderPipeline,
  registerIdxBufPtr,
  registerTexPtr,
  CyTexturePtr,
  registerMeshPoolPtr,
  registerOneBufPtr,
  registerManyBufPtr,
} from "./render_webgpu.js";
import {
  cloth_shader,
  mesh_shader,
  particle_shader,
  rope_shader,
} from "./shaders.js";

// TODO:
//  [ ] pipeline attachements / outputs
//        use case: two cameras
//  [ ] mesh pool handle enable/disable
//  [x] textures and samplers as resources
//  [x] resource ping-ponging for cloth texs and boids
//  [x] shader VertexInput struct auto gen

// TODO(@darzu):
export const VertexStruct = createCyStruct(
  {
    position: "vec3<f32>",
    color: "vec3<f32>",
    normal: "vec3<f32>",
    uv: "vec2<f32>",
  },
  {
    isCompact: true,
    serializer: ({ position, color, normal, uv }, _, offsets_32, views) => {
      views.f32.set(position, offsets_32[0]);
      views.f32.set(color, offsets_32[1]);
      views.f32.set(normal, offsets_32[2]);
      views.f32.set(uv, offsets_32[3]);
    },
  }
);
export type VertexTS = CyToTS<typeof VertexStruct.desc>;

export const RopeStickStruct = createCyStruct({
  aIdx: "u32",
  bIdx: "u32",
  length: "f32",
});
export type RopeStickTS = CyToTS<typeof RopeStickStruct.desc>;

export const SceneStruct = createCyStruct(
  {
    cameraViewProjMatrix: "mat4x4<f32>",
    light1Dir: "vec3<f32>",
    light2Dir: "vec3<f32>",
    light3Dir: "vec3<f32>",
    cameraPos: "vec3<f32>",
    playerPos: "vec2<f32>",
    time: "f32",
  },
  {
    isUniform: true,
    serializer: (data, _, offsets_32, views) => {
      views.f32.set(data.cameraViewProjMatrix, offsets_32[0]);
      views.f32.set(data.light1Dir, offsets_32[1]);
      views.f32.set(data.light2Dir, offsets_32[2]);
      views.f32.set(data.light3Dir, offsets_32[3]);
      views.f32.set(data.cameraPos, offsets_32[4]);
      views.f32.set(data.playerPos, offsets_32[5]);
      views.f32[offsets_32[6]] = data.time;
    },
  }
);
export type SceneTS = CyToTS<typeof SceneStruct.desc>;

export function setupScene(): SceneTS {
  // create a directional light and compute it's projection (for shadows) and direction
  const worldOrigin = vec3.fromValues(0, 0, 0);
  const D = 50;
  const light1Pos = vec3.fromValues(D, D * 2, D);
  const light2Pos = vec3.fromValues(-D, D * 1, D);
  const light3Pos = vec3.fromValues(0, D * 0.5, -D);
  const light1Dir = vec3.subtract(vec3.create(), worldOrigin, light1Pos);
  vec3.normalize(light1Dir, light1Dir);
  const light2Dir = vec3.subtract(vec3.create(), worldOrigin, light2Pos);
  vec3.normalize(light2Dir, light2Dir);
  const light3Dir = vec3.subtract(vec3.create(), worldOrigin, light3Pos);
  vec3.normalize(light3Dir, light3Dir);

  return {
    cameraViewProjMatrix: mat4.create(), // updated later
    light1Dir,
    light2Dir,
    light3Dir,
    cameraPos: vec3.create(), // updated later
    playerPos: [0, 0], // updated later
    time: 0, // updated later
  };
}

export const RopePointStruct = createCyStruct(
  {
    position: "vec3<f32>",
    prevPosition: "vec3<f32>",
    locked: "f32",
  },
  {
    isUniform: false,
    serializer: (data, _, offsets_32, views) => {
      views.f32.set(data.position, offsets_32[0]);
      views.f32.set(data.prevPosition, offsets_32[1]);
      views.f32[offsets_32[2]] = data.locked;
    },
  }
);
export type RopePointTS = CyToTS<typeof RopePointStruct.desc>;

export const MeshUniformStruct = createCyStruct(
  {
    transform: "mat4x4<f32>",
    aabbMin: "vec3<f32>",
    aabbMax: "vec3<f32>",
    tint: "vec3<f32>",
  },
  {
    isUniform: true,
    serializer: (d, _, offsets_32, views) => {
      views.f32.set(d.transform, offsets_32[0]);
      views.f32.set(d.aabbMin, offsets_32[1]);
      views.f32.set(d.aabbMax, offsets_32[2]);
      views.f32.set(d.tint, offsets_32[3]);
    },
  }
);
export type MeshUniformTS = CyToTS<typeof MeshUniformStruct.desc>;

// TODO(@darzu): IMPL
export type MeshHandleStd = MeshHandle<typeof MeshUniformStruct.desc>;

export const CLOTH_W = 12;

function generateRopeGrid(): {
  ropePointData: RopePointTS[];
  ropeStickData: RopeStickTS[];
} {
  // setup scene data:
  // TODO(@darzu): allow init to pass in above

  // setup rope
  // TODO(@darzu): ROPE
  const ropePointData: RopePointTS[] = [];
  const ropeStickData: RopeStickTS[] = [];
  // let n = 0;
  const idx = (x: number, y: number) => {
    if (x >= CLOTH_W || y >= CLOTH_W) return CLOTH_W * CLOTH_W;
    return x * CLOTH_W + y;
  };
  for (let x = 0; x < CLOTH_W; x++) {
    for (let y = 0; y < CLOTH_W; y++) {
      let i = idx(x, y);
      // assert(i === n, "i === n");
      const pos: vec3 = [x, y + 4, 0];
      const p: RopePointTS = {
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
let _initRopePointData: RopePointTS[];
let _initRopeStickData: RopeStickTS[];

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

const sceneBufPtr = registerOneBufPtr("scene", {
  struct: SceneStruct,
  init: setupScene,
});
const ropePointBufPtr = registerManyBufPtr("ropePoint", {
  struct: RopePointStruct,
  init: genRopePointData,
});
const ropeStickBufPtr = registerManyBufPtr("ropeStick", {
  struct: RopeStickStruct,
  init: genRopeStickData,
});
const compRopePipelinePtr = registerCompPipeline("ropeComp", {
  resources: [sceneBufPtr, ropePointBufPtr, ropeStickBufPtr],
  shader: rope_shader,
  shaderComputeEntry: "main",
});

// rope particle render
const ParticleVertStruct = createCyStruct(
  {
    position: "vec3<f32>",
  },
  {
    isCompact: true,
  }
);
const initParticleVertData: () => CyToTS<
  typeof ParticleVertStruct.desc
>[] = () => [
  { position: [1, 1, 1] },
  { position: [1, -1, -1] },
  { position: [-1, 1, -1] },
  { position: [-1, -1, 1] },
];
const particleVertBufPtr = registerManyBufPtr("particleVert", {
  struct: ParticleVertStruct,
  init: initParticleVertData,
});

const initParticleIdxData = () =>
  new Uint16Array([2, 1, 0, 3, 2, 0, 1, 3, 0, 2, 3, 1]);

const particleIdxBufPtr = registerIdxBufPtr("particleIdx", {
  init: initParticleIdxData,
});

const renderRopePipelineDesc = registerRenderPipeline("renderRope", {
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
});

const CLOTH_SIZE = 10; // TODO(@darzu):

const clothTexPtrDesc: Parameters<typeof registerTexPtr>[1] = {
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
const clothTexPtr0 = registerTexPtr("clothTex0", {
  ...clothTexPtrDesc,
});
const clothTexPtr1 = registerTexPtr("clothTex1", {
  ...clothTexPtrDesc,
});

export const MAX_MESHES = 20000;
export const MAX_VERTICES = 21844;

const meshVertsPtr = registerManyBufPtr("meshVertsBuf", {
  struct: VertexStruct,
  init: () => MAX_VERTICES,
});

const meshTriIndsPtr = registerIdxBufPtr("meshTriIndsBuf", {
  init: () => MAX_VERTICES,
});

const meshLineIndsPtr = registerIdxBufPtr("meshLineIndsBuf", {
  init: () => MAX_VERTICES * 2,
});

const meshUnisPtr = registerManyBufPtr("meshUni", {
  struct: MeshUniformStruct,
  init: () => MAX_MESHES,
});

export const meshPoolPtr = registerMeshPoolPtr("meshPool", {
  computeVertsData,
  computeUniData,
  vertsPtr: meshVertsPtr,
  unisPtr: meshUnisPtr,
  triIndsPtr: meshTriIndsPtr,
  lineIndsPtr: meshLineIndsPtr,
});

export function computeUniData(m: Mesh): MeshUniformTS {
  const { min, max } = getAABBFromMesh(m);
  const uni: MeshUniformTS = {
    transform: mat4.create(),
    aabbMin: min,
    aabbMax: max,
    tint: vec3.create(),
  };
  return uni;
}

export function computeVertsData(m: Mesh): VertexTS[] {
  const vertsData: VertexTS[] = m.pos.map((pos, i) => ({
    position: pos,
    color: [0.0, 0.0, 0.0],
    normal: [1.0, 0.0, 0.0],
    uv: m.uvs ? m.uvs[i] : [0.0, 0.0],
  }));
  m.tri.forEach((triInd, i) => {
    // set provoking vertex data
    // TODO(@darzu): add support for writting to all three vertices (for non-provoking vertex setups)
    const normal = computeTriangleNormal(
      m.pos[triInd[0]],
      m.pos[triInd[1]],
      m.pos[triInd[2]]
    );
    vertsData[triInd[0]].normal = normal;
    vertsData[triInd[0]].color = m.colors[i];
  });
  return vertsData;
}

const renderTriPipelineDesc = registerRenderPipeline("triRender", {
  resources: [
    sceneBufPtr,
    // TODO(@darzu): support textures
    { ptr: clothTexPtr0, access: "read", alias: "clothTex" },
  ],
  meshOpt: {
    pool: meshPoolPtr,
    stepMode: "per-mesh-handle",
  },
  shader: mesh_shader,
  shaderVertexEntry: "vert_main",
  shaderFragmentEntry: "frag_main",
});

// TODO(@darzu): CLOTH
let clothReadIdx = 1;

const cmpClothPipelinePtr0 = registerCompPipeline("clothComp0", {
  resources: [
    { ptr: clothTexPtr0, access: "read", alias: "inTex" },
    { ptr: clothTexPtr1, access: "write", alias: "outTex" },
  ],
  shader: cloth_shader,
  shaderComputeEntry: "main",
});
const cmpClothPipelinePtr1 = registerCompPipeline("clothComp1", {
  resources: [
    { ptr: clothTexPtr1, access: "read", alias: "inTex" },
    { ptr: clothTexPtr0, access: "write", alias: "outTex" },
  ],
  shader: cloth_shader,
  shaderComputeEntry: "main",
});

// BOIDS

const BoidData = createCyStruct({
  pos: "vec3<f32>",
  vel: "vec3<f32>",
});
const numBoids = 1500;
const boidData0 = registerManyBufPtr("boidData0", {
  struct: BoidData,
  init: () =>
    range(numBoids).map((_, i) => ({
      pos: [jitter(10), jitter(10), jitter(10)] as vec3,
      vel: [jitter(10), jitter(10), jitter(10)] as vec3,
    })),
});
const boidData1 = registerManyBufPtr("boidData1", {
  struct: BoidData,
  init: () => numBoids,
});
const BoidVert = createCyStruct({
  pos: "vec3<f32>",
});

const boidVerts = registerManyBufPtr("boidVerts", {
  struct: BoidVert,
  init: () => [
    { pos: [1, 1, 1] },
    { pos: [1, -1, -1] },
    { pos: [-1, 1, -1] },
    { pos: [-1, -1, 1] },
  ],
});
const boidInds = registerIdxBufPtr("boidIdx", {
  init: () => new Uint16Array([2, 1, 0, 3, 2, 0, 1, 3, 0, 2, 3, 1]),
});
const boidRender = registerRenderPipeline("boidRender", {
  resources: [sceneBufPtr],
  meshOpt: {
    index: boidInds,
    instance: boidData0,
    vertex: boidVerts,
    stepMode: "per-instance",
  },
  shader: () => {
    return `
    @stage(vertex)
    fn vert_main(vIn: VertexInput, iIn: InstanceInput) -> @builtin(position) vec4<f32> {
      // let angle = -atan2(a_particleVel.x, a_particleVel.y);
      // let pos = vec2<f32>(
      //     (a_pos.x * cos(angle)) - (a_pos.y * sin(angle)),
      //     (a_pos.x * sin(angle)) + (a_pos.y * cos(angle)));
      let pos = scene.cameraViewProjMatrix * vec4<f32>(vIn.pos * 0.1 + iIn.pos, 1.0);
      return pos;
    }
    
    @stage(fragment)
    fn frag_main() -> @location(0) vec4<f32> {
      return vec4<f32>(1.0, 1.0, 1.0, 1.0);
    }
  `;
  },
  shaderFragmentEntry: "frag_main",
  shaderVertexEntry: "vert_main",
});

const BoidParams = createCyStruct(
  {
    deltaT: "f32",
    cohesionDistance: "f32",
    seperationDistance: "f32",
    alignDistance: "f32",
    cohesionScale: "f32",
    seperationScale: "f32",
    alignScale: "f32",
    worldSize: "f32",
    speed: "f32",
  },
  {
    // TODO(@darzu): wish we didn't need to specify this
    isUniform: true,
  }
);
const boidParams = registerOneBufPtr("boidParams", {
  struct: BoidParams,
  init: () => {
    return {
      deltaT: 0.04,
      cohesionDistance: 1.0,
      seperationDistance: 0.25,
      alignDistance: 0.5,
      cohesionScale: 0.02,
      seperationScale: 0.2,
      alignScale: 0.1,
      worldSize: 10.0,
      speed: 0.3,
    };
  },
});

const boidCompDesc: Omit<
  Parameters<typeof registerCompPipeline>[1],
  "resources"
> = {
  shaderComputeEntry: "main",
  shader: () => `  
  @stage(compute) @workgroup_size(64)
  fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    var index : u32 = GlobalInvocationID.x;
  
    var vPos = inBoids.ms[index].pos;
    var vVel = inBoids.ms[index].vel;
    var cMass = vec3<f32>(0.0, 0.0, 0.0);
    var cVel = vec3<f32>(0.0, 0.0, 0.0);
    var colVel = vec3<f32>(0.0, 0.0, 0.0);
    var cMassCount : u32 = 0u;
    var cVelCount : u32 = 0u;
    var pos : vec3<f32>;
    var vel : vec3<f32>;
  
    for (var i : u32 = 0u; i < arrayLength(&inBoids.ms); i = i + 1u) {
      if (i == index) {
        continue;
      }
  
      pos = inBoids.ms[i].pos.xyz;
      vel = inBoids.ms[i].vel.xyz;
      if (distance(pos, vPos) < boidParams.cohesionDistance) {
        cMass = cMass + pos;
        cMassCount = cMassCount + 1u;
      }
      if (distance(pos, vPos) < boidParams.seperationDistance) {
        colVel = colVel - (pos - vPos);
      }
      if (distance(pos, vPos) < boidParams.alignDistance) {
        cVel = cVel + vel;
        cVelCount = cVelCount + 1u;
      }
    }
    if (cMassCount > 0u) {
      var temp = f32(cMassCount);
      cMass = (cMass / vec3<f32>(temp, temp, temp)) - vPos;
    }
    if (cVelCount > 0u) {
      var temp = f32(cVelCount);
      cVel = cVel / vec3<f32>(temp, temp, temp);
    }
    vVel = vVel + (cMass * boidParams.cohesionScale) + (colVel * boidParams.seperationScale) +
        (cVel * boidParams.alignScale);
  
    // clamp velocity for a more pleasing simulation
    vVel = normalize(vVel) * boidParams.speed; // max velocity
    // vVel = normalize(vVel) * clamp(length(vVel), 0.0, 1.0); // max velocity
    // kinematic update
    vPos = vPos + (vVel * boidParams.deltaT);
    // Wrap around boundary
    if (vPos.x < -boidParams.worldSize) {
      vPos.x = boidParams.worldSize;
    }
    if (vPos.x > boidParams.worldSize) {
      vPos.x = -boidParams.worldSize;
    }
    if (vPos.y < -boidParams.worldSize) {
      vPos.y = boidParams.worldSize;
    }
    if (vPos.y > boidParams.worldSize) {
      vPos.y = -boidParams.worldSize;
    }
    if (vPos.z < -boidParams.worldSize) {
      vPos.z = boidParams.worldSize;
    }
    if (vPos.z > boidParams.worldSize) {
      vPos.z = -boidParams.worldSize;
    }
    // Write back
    outBoids.ms[index].pos = vPos;
    outBoids.ms[index].vel = vVel;
  }
  `,
  workgroupCounts: [Math.ceil(numBoids / 64), 1, 1],
};

const boidComp0 = registerCompPipeline("boidComp0", {
  ...boidCompDesc,
  resources: [
    boidParams,
    { ptr: boidData0, access: "read", alias: "inBoids" },
    { ptr: boidData1, access: "write", alias: "outBoids" },
  ],
});
const boidComp1 = registerCompPipeline("boidComp1", {
  ...boidCompDesc,
  resources: [
    boidParams,
    { ptr: boidData1, access: "read", alias: "inBoids" },
    { ptr: boidData0, access: "write", alias: "outBoids" },
  ],
});
