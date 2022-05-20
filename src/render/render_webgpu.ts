import { mat4 } from "../gl-matrix.js";
import { assert } from "../test.js";
import {
  capitalize,
  isArray,
  isNumber,
  never,
  pluralize,
  uncapitalize,
  Union,
} from "../util.js";
import {
  createCyIdxBuf,
  createCyMany,
  createCyOne,
  createCyTexture,
  CyBuffer,
  CyIdxBuffer,
  CyMany,
  CyOne,
  CyStruct,
  CyStructDesc,
  CyTexture,
  CyToTS,
  GPUBufferBindingTypeToWgslVar,
  TexTypeAsTSType,
  texTypeToBytes,
  TexTypeToTSType,
} from "./data.js";
import {
  createMeshPool,
  MeshHandle,
  MeshPool,
  MeshPoolOpts,
} from "./mesh-pool.js";
import { Mesh } from "./mesh.js";
import {
  SceneStruct,
  RopeStickStruct,
  RopePointStruct,
  MeshUniformStruct,
  VertexStruct,
  setupScene,
  VertexTS,
  MeshUniformTS,
  computeUniData,
  computeVertsData,
  MeshHandleStd,
  meshPoolPtr,
} from "./pipelines.js";
import { Renderer } from "./renderer.js";
import {
  cloth_shader,
  rope_shader,
  // obj_vertShader,
  // obj_fragShader,
  particle_shader,
} from "./shaders.js";

// render pipeline parameters
const antiAliasSampleCount = 4;
const depthStencilFormat = "depth24plus-stencil8";

interface CyResourcePtr {
  kind: PtrKind;
  name: string;
}

// BUFFERS
export interface CyIdxBufferPtr extends CyResourcePtr {
  kind: "idxBuffer";
  init: () => Uint16Array | number;
}

export interface CyManyBufferPtr<O extends CyStructDesc> extends CyResourcePtr {
  kind: "manyBuffer";
  struct: CyStruct<O>;
  init: () => CyToTS<O>[] | number;
}
export interface CyOneBufferPtr<O extends CyStructDesc> extends CyResourcePtr {
  kind: "oneBuffer";
  struct: CyStruct<O>;
  init: () => CyToTS<O>;
}
export type CyBufferPtr<O extends CyStructDesc> =
  | CyManyBufferPtr<O>
  | CyOneBufferPtr<O>;

// TEXUTRES

export interface CyTexturePtr extends CyResourcePtr {
  kind: "texture";
  size: [number, number];
  resize?: (canvasWidth: number, canvasHeight: number) => [number, number];
  format: GPUTextureFormat;
  init: () => Float32Array | undefined; // TODO(@darzu): | TexTypeAsTSType<F>[]
}

export const canvasTexture = {
  kind: "canvasTexture",
  name: "canvas",
} as const;
export type CyCanvasTexturePtr = typeof canvasTexture;

// MESH POOL
export interface CyMeshPoolPtr<V extends CyStructDesc, U extends CyStructDesc>
  extends CyResourcePtr {
  kind: "meshPool";
  // TODO(@darzu): remove id and name, this doesn't need to be inited directly
  computeVertsData: (m: Mesh) => CyToTS<V>[];
  computeUniData: (m: Mesh) => CyToTS<U>;
  vertsPtr: CyManyBufferPtr<V>;
  unisPtr: CyManyBufferPtr<U>;
  triIndsPtr: CyIdxBufferPtr;
  lineIndsPtr: CyIdxBufferPtr;
}

// PIPELINES

// TODO(@darzu): support more access modes?
// TODO(@darzu): like buffer access modes, is this possibly inferable?
export interface CyGlobalUsage<G extends CyResourcePtr> {
  ptr: G;
  access?: "read" | "write";
  alias?: string;
}

// TODO(@darzu): i know there is some fancy type way to construct this but i
//    can't figure it out.
export type CyGlobal = CyTexturePtr | CyBufferPtr<any>;
export type CyGlobalParam =
  | CyTexturePtr
  | CyBufferPtr<any>
  | CyGlobalUsage<CyTexturePtr>
  | CyGlobalUsage<CyBufferPtr<any>>;

export function isResourcePtr(p: any): p is CyResourcePtr {
  return !!(p as CyResourcePtr).kind;
}

export interface CyCompPipelinePtr extends CyResourcePtr {
  kind: "compPipeline";
  resources: CyGlobalParam[]; // TODO(@darzu): rename "resources" to "globals"?
  workgroupCounts?: [number, number, number];
  shaderComputeEntry: string;
  shader: () => string;
}

export interface CyCompPipeline {
  ptr: CyCompPipelinePtr;
  // resourceLayouts: CyBufferPtrLayout<CyStructDesc>[];
  pipeline: GPUComputePipeline;
  bindGroup: GPUBindGroup;
}

type CyMeshOpt =
  | {
      pool: CyMeshPoolPtr<any, any>;
      stepMode: "per-mesh-handle";
    }
  | {
      vertex: CyBufferPtr<any>;
      instance: CyBufferPtr<any>;
      index: CyIdxBufferPtr;
      stepMode: "per-instance";
    };

export interface CyRndrPipelinePtr extends CyResourcePtr {
  kind: "renderPipeline";
  resources: CyGlobalParam[];
  shader: () => string;
  shaderVertexEntry: string;
  shaderFragmentEntry: string;
  meshOpt: CyMeshOpt;
  output: CyTexturePtr | CyCanvasTexturePtr;
}

// TODO(@darzu): instead of just mushing together with the desc, have desc compose in
export interface CyRndrPipeline {
  ptr: CyRndrPipelinePtr;
  // resourceLayouts: CyBufferPtrLayout<any>[];
  vertexBuf: CyMany<any>;
  indexBuf: CyIdxBuffer;
  instanceBuf?: CyMany<any>;
  pool?: MeshPool<any, any>;
  pipeline: GPURenderPipeline;
  bindGroups: GPUBindGroup[];
}

// HELPERS

function isRenderPipelinePtr(
  p: CyRndrPipelinePtr | CyCompPipelinePtr
): p is CyRndrPipelinePtr {
  const k: keyof CyRndrPipelinePtr = "meshOpt";
  return k in p;
}

// REGISTERS

type PtrKindToPtrType = {
  manyBuffer: CyManyBufferPtr<any>;
  oneBuffer: CyOneBufferPtr<any>;
  idxBuffer: CyIdxBufferPtr;
  texture: CyTexturePtr;
  compPipeline: CyCompPipelinePtr;
  renderPipeline: CyRndrPipelinePtr;
  meshPool: CyMeshPoolPtr<any, any>;
  canvasTexture: CyCanvasTexturePtr;
};
type PtrKindToResourceType = {
  manyBuffer: CyMany<any>;
  oneBuffer: CyOne<any>;
  idxBuffer: CyIdxBuffer;
  texture: CyTexture;
  compPipeline: CyCompPipeline;
  renderPipeline: CyRndrPipeline;
  meshPool: MeshPool<any, any>;
  canvasTexture: CyCanvasTexturePtr;
};
type Assert_ResourceTypePtrTypeMatch =
  PtrKindToPtrType[keyof PtrKindToResourceType] &
    PtrKindToResourceType[keyof PtrKindToPtrType];
type PtrKind = keyof PtrKindToPtrType;
type PtrType = PtrKindToPtrType[PtrKind];
// type PtrDesc<K extends PtrKind> = Omit<
//   Omit<PtrKindToPtrType[K], "name">,
//   "kind"
// >;
type ResourceType = PtrKindToResourceType[PtrKind];

let _cyNameToPtr: { [name: string]: CyResourcePtr } = {};
let _cyKindToPtrs: { [K in PtrKind]: PtrKindToPtrType[K][] } = {
  manyBuffer: [],
  oneBuffer: [],
  idxBuffer: [],
  texture: [],
  compPipeline: [],
  renderPipeline: [],
  meshPool: [],
  canvasTexture: [],
};
function registerCyResource<R extends CyResourcePtr>(ptr: R): R {
  assert(
    !_cyNameToPtr[ptr.name],
    `already registered Cy resource with name: ${ptr.name}`
  );
  _cyNameToPtr[ptr.name] = ptr;
  _cyKindToPtrs[ptr.kind].push(ptr as any);
  return ptr;
}

type Omit_kind_name<T> = Omit<Omit<T, "kind">, "name">;

export function registerOneBufPtr<O extends CyStructDesc>(
  name: string,
  desc: Omit_kind_name<CyOneBufferPtr<O>>
): CyOneBufferPtr<O> {
  return registerCyResource({
    ...desc,
    kind: "oneBuffer",
    name,
  });
}
export function registerManyBufPtr<O extends CyStructDesc>(
  name: string,
  desc: Omit_kind_name<CyManyBufferPtr<O>>
): CyManyBufferPtr<O> {
  return registerCyResource({
    ...desc,
    kind: "manyBuffer",
    name,
  });
}
export function registerIdxBufPtr(
  name: string,
  desc: Omit_kind_name<CyIdxBufferPtr>
): CyIdxBufferPtr {
  return registerCyResource({
    ...desc,
    kind: "idxBuffer",
    name,
  });
}
export function registerTexPtr(
  name: string,
  desc: Omit_kind_name<CyTexturePtr>
): CyTexturePtr {
  return registerCyResource({
    ...desc,
    kind: "texture",
    name,
  });
}
export function registerCompPipeline(
  name: string,
  desc: Omit_kind_name<CyCompPipelinePtr>
): CyCompPipelinePtr {
  return registerCyResource({
    ...desc,
    kind: "compPipeline",
    name,
  });
}
export function registerRenderPipeline(
  name: string,
  desc: Omit_kind_name<CyRndrPipelinePtr>
): CyRndrPipelinePtr {
  return registerCyResource({
    ...desc,
    kind: "renderPipeline",
    name,
  });
}
export function registerMeshPoolPtr<
  V extends CyStructDesc,
  U extends CyStructDesc
>(
  name: string,
  desc: Omit_kind_name<CyMeshPoolPtr<V, U>>
): CyMeshPoolPtr<V, U> {
  return registerCyResource({
    ...desc,
    kind: "meshPool",
    name,
  });
}

const prim_tris: GPUPrimitiveState = {
  topology: "triangle-list",
  cullMode: "back",
  frontFace: "ccw",
};
const prim_lines: GPUPrimitiveState = {
  topology: "line-list",
};

const depthStencilOpts: GPUDepthStencilState = {
  depthWriteEnabled: true,
  depthCompare: "less",
  format: depthStencilFormat,
};

export function createWebGPURenderer(
  canvas: HTMLCanvasElement,
  device: GPUDevice,
  context: GPUCanvasContext,
  adapter: GPUAdapter
): Renderer {
  let renderer: Renderer = {
    drawLines: true,
    drawTris: true,
    backgroundColor: [0.6, 0.63, 0.6],

    addMesh,
    addMeshInstance,
    updateMesh,
    renderFrame,
  };

  // let clothReadIdx = 1;

  // let sceneUni = createCyOne(device, SceneStruct, setupScene());
  let canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  // let canvasFormat = context.getPreferredFormat(adapter);

  // determine resource usage modes
  // TODO(@darzu): determine texture usage modes
  const cyNameToBufferUsage: { [name: string]: GPUBufferUsageFlags } = {};
  // all buffers are updatable via queue
  // TODO(@darzu): option for some to opt out? for perf?
  [..._cyKindToPtrs.manyBuffer, ..._cyKindToPtrs.oneBuffer].forEach(
    (r) => (cyNameToBufferUsage[r.name] |= GPUBufferUsage.COPY_DST)
  );
  // all singleton buffers are probably used as uniforms
  _cyKindToPtrs.oneBuffer.forEach(
    (p) => (cyNameToBufferUsage[p.name] |= GPUBufferUsage.UNIFORM)
  );
  // all pipeline global resources are storage or uniform
  // TODO(@darzu): be more precise?
  [..._cyKindToPtrs.compPipeline, ..._cyKindToPtrs.renderPipeline].forEach(
    (p) =>
      p.resources.forEach((r) => {
        if (isResourcePtr(r)) {
          if (r.kind === "oneBuffer" || r.kind === "manyBuffer")
            cyNameToBufferUsage[r.name] |= GPUBufferUsage.STORAGE;
        } else {
          if (r.ptr.kind === "oneBuffer" || r.ptr.kind === "manyBuffer")
            cyNameToBufferUsage[r.ptr.name] |= GPUBufferUsage.STORAGE;
        }
      })
  );
  // render pipelines have vertex buffers and mesh pools have uniform buffers
  _cyKindToPtrs.renderPipeline.forEach((p) => {
    if (p.meshOpt.stepMode === "per-instance") {
      cyNameToBufferUsage[p.meshOpt.instance.name] |= GPUBufferUsage.VERTEX;
      cyNameToBufferUsage[p.meshOpt.vertex.name] |= GPUBufferUsage.VERTEX;
    } else if (p.meshOpt.stepMode === "per-mesh-handle") {
      cyNameToBufferUsage[p.meshOpt.pool.vertsPtr.name] |=
        GPUBufferUsage.VERTEX;
      cyNameToBufferUsage[p.meshOpt.pool.unisPtr.name] |=
        GPUBufferUsage.UNIFORM;
    } else {
      never(p.meshOpt);
    }
  });
  // mesh pools have vert and uniform buffers
  _cyKindToPtrs.meshPool.forEach((p) => {
    cyNameToBufferUsage[p.vertsPtr.name] |= GPUBufferUsage.VERTEX;
    cyNameToBufferUsage[p.unisPtr.name] |= GPUBufferUsage.UNIFORM;
  });

  // create resources
  // TODO(@darzu): IMPL
  const cyKindToNameToRes: {
    [K in PtrKind]: { [name: string]: PtrKindToResourceType[K] };
  } = {
    manyBuffer: {},
    oneBuffer: {},
    idxBuffer: {},
    texture: {},
    compPipeline: {},
    renderPipeline: {},
    meshPool: {},
    canvasTexture: {},
  };
  // TODO(@darzu): IMPL
  const cyRenderToBundle: { [pipelineName: string]: GPURenderBundle } = {};

  // create many-buffers
  _cyKindToPtrs.manyBuffer.forEach((r) => {
    const usage = cyNameToBufferUsage[r.name]!;
    const buf = createCyMany(device, r.struct, usage, r.init());
    cyKindToNameToRes.manyBuffer[r.name] = buf;
  });
  // create one-buffers
  _cyKindToPtrs.oneBuffer.forEach((r) => {
    const usage = cyNameToBufferUsage[r.name]!;
    const buf = createCyOne(device, r.struct, usage, r.init());
    cyKindToNameToRes.oneBuffer[r.name] = buf;
  });
  // create idx-buffers
  _cyKindToPtrs.idxBuffer.forEach((r) => {
    const buf = createCyIdxBuf(device, r.init());
    cyKindToNameToRes.idxBuffer[r.name] = buf;
  });
  // create mesh pools
  _cyKindToPtrs.meshPool.forEach((r) => {
    const verts = cyKindToNameToRes.manyBuffer[r.vertsPtr.name];
    const unis = cyKindToNameToRes.manyBuffer[r.unisPtr.name];
    const triInds = cyKindToNameToRes.idxBuffer[r.triIndsPtr.name];
    const lineInds = cyKindToNameToRes.idxBuffer[r.lineIndsPtr.name];
    assert(
      verts && unis && triInds && lineInds,
      `Missing buffer for mesh pool ${r.name}`
    );
    const pool = createMeshPool({
      computeVertsData: r.computeVertsData,
      computeUniData: r.computeUniData,
      verts,
      unis,
      triInds,
      lineInds,
      // TODO(@darzu): support more?
      shiftMeshIndices: false,
    });
    cyKindToNameToRes.meshPool[r.name] = pool;
  });
  // create texture
  _cyKindToPtrs.texture.forEach((r) => {
    const t = createCyTexture(device, r.size, r.format, r.init);
    cyKindToNameToRes.texture[r.name] = t;
  });
  // create pipelines
  for (let p of [
    ..._cyKindToPtrs["compPipeline"],
    ..._cyKindToPtrs["renderPipeline"],
  ]) {
    const shaderStage = isRenderPipelinePtr(p)
      ? GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT
      : GPUShaderStage.COMPUTE;
    // TODO(@darzu): move helpers elsewhere?
    // TODO(@darzu): dynamic is wierd to pass here
    function mkGlobalLayoutEntry(
      idx: number,
      r: CyGlobalUsage<CyGlobal>,
      dynamic: boolean
    ): GPUBindGroupLayoutEntry {
      if (r.ptr.kind === "oneBuffer" || r.ptr.kind === "manyBuffer") {
        // TODO(@darzu):
        // const struct = isResourcePtr(r) ? r.struct : r.ptr.
        return r.ptr.struct.layout(
          idx,
          shaderStage,
          // TODO(@darzu): more precise?
          r.ptr.struct.opts?.isUniform ? "uniform" : "storage",
          dynamic
        );
      } else if (r.ptr.kind === "texture") {
        if (!r.access || r.access === "read") {
          return {
            binding: idx,
            visibility: shaderStage,
            // TODO(@darzu): need a mapping of format -> sample type?
            texture: { sampleType: "unfilterable-float" },
          };
        } else {
          return {
            binding: idx,
            visibility: shaderStage,
            storageTexture: { format: r.ptr.format, access: "write-only" },
          };
        }
      } else {
        never(r.ptr, "UNIMPLEMENTED");
      }
    }
    function mkBindGroupLayout(
      ptrs: CyGlobalUsage<CyGlobal>[],
      dynamic: boolean
    ) {
      const bindGroupLayoutDesc: GPUBindGroupLayoutDescriptor = {
        entries: ptrs.map((r, i) => {
          return mkGlobalLayoutEntry(i, r, dynamic);
        }),
      };
      return device.createBindGroupLayout(bindGroupLayoutDesc);
    }
    function mkBindGroupEntry(
      idx: number,
      r: CyGlobalUsage<CyGlobal>,
      bufPlurality: "one" | "many"
    ): GPUBindGroupEntry {
      if (r.ptr.kind === "oneBuffer" || r.ptr.kind === "manyBuffer") {
        const buf =
          r.ptr.kind === "oneBuffer"
            ? cyKindToNameToRes.oneBuffer[r.ptr.name]
            : cyKindToNameToRes.manyBuffer[r.ptr.name];
        assert(!!buf, `Missing resource buffer: ${r.ptr.name}`);
        // TODO(@darzu): not super happy with how plurality is handled
        return buf.binding(idx, bufPlurality);
      } else if (r.ptr.kind === "texture") {
        const tex = cyKindToNameToRes.texture[r.ptr.name]!;
        return {
          binding: idx,
          // TODO(@darzu): does this view need to be updated on resize?
          resource: tex.texture.createView(),
        };
      } else {
        never(r.ptr, "unimplemented");
      }
    }
    function mkBindGroup(
      layout: GPUBindGroupLayout,
      ptrs: CyGlobalUsage<CyGlobal>[],
      // TODO(@darzu): this is a hack.....
      bufPlurality: "one" | "many"
    ) {
      const bindGroup = device.createBindGroup({
        layout: layout,
        entries: ptrs.map((r, i) => {
          return mkBindGroupEntry(i, r, bufPlurality);
        }),
      });
      return bindGroup;
    }
    function globalToWgslDefs(
      r: CyGlobalUsage<CyGlobal>,
      plurality: "one" | "many"
    ) {
      if (r.ptr.kind === "oneBuffer" || r.ptr.kind === "manyBuffer") {
        const structStr =
          `struct ${capitalize(r.ptr.name)} {\n` +
          r.ptr.struct.wgsl(true) +
          `\n };\n`;
        if (plurality === "one") {
          return structStr;
        } else {
          return (
            structStr +
            `struct ${pluralize(capitalize(r.ptr.name))} {\n` +
            `ms : array<${capitalize(r.ptr.name)}>,\n` +
            `};\n`
          );
        }
      } else if (r.ptr.kind === "texture") {
        // nothing to do for textures
        return ``;
      } else {
        never(r.ptr, "unimplemented");
      }
    }
    function globalToWgslVars(
      r: CyGlobalUsage<CyGlobal>,
      plurality: "one" | "many",
      groupIdx: number,
      bindingIdx: number
    ) {
      if (r.ptr.kind === "oneBuffer" || r.ptr.kind === "manyBuffer") {
        const usage = r.ptr.struct.opts?.isUniform ? "uniform" : "storage";
        const varPrefix = GPUBufferBindingTypeToWgslVar[usage];
        const varName =
          r.alias ??
          (plurality === "one"
            ? uncapitalize(r.ptr.name)
            : pluralize(uncapitalize(r.ptr.name)));
        // console.log(varName); // TODO(@darzu):
        const varType =
          plurality === "one"
            ? capitalize(r.ptr.name)
            : pluralize(capitalize(r.ptr.name));
        // TODO(@darzu): support multiple groups?
        return `@group(${groupIdx}) @binding(${bindingIdx}) ${varPrefix} ${varName} : ${varType};`;
      } else if (r.ptr.kind === "texture") {
        const varName = r.alias ?? uncapitalize(r.ptr.name);
        if (!r.access || r.access === "read")
          // TODO(@darzu): handle other formats?
          return `@group(${groupIdx}) @binding(${bindingIdx}) var ${varName} : texture_2d<f32>;`;
        else
          return `@group(${groupIdx}) @binding(${bindingIdx}) var ${varName} : texture_storage_2d<${r.ptr.format}, write>;`;
      } else {
        never(r.ptr, "unimpl");
      }
    }

    // normalize global format
    const resUsages = p.resources.map((r, i) => {
      let usage: CyGlobalUsage<CyGlobal>;
      if (isResourcePtr(r)) {
        usage = {
          ptr: r,
          // TODO(@darzu): what is the right default access? per resource type?
          access: "read",
        };
      } else {
        usage = r;
      }
      return usage;
    });

    // resources layout and bindings
    // TODO(@darzu): don't like this dynamic layout var
    const resBindGroupLayout = mkBindGroupLayout(resUsages, false);
    // TODO(@darzu): wait, plurality many isn't right
    const resBindGroup = mkBindGroup(resBindGroupLayout, resUsages, "many");

    // shader resource setup
    const shaderResStructs = resUsages.map((r) => {
      // TODO(@darzu): HACK
      const plurality = r.ptr.kind === "oneBuffer" ? "one" : "many";
      return globalToWgslDefs(r, plurality);
    });
    const shaderResVars = resUsages.map((r, i) => {
      const plurality = r.ptr.kind === "oneBuffer" ? "one" : "many";
      return globalToWgslVars(r, plurality, 0, i);
    });

    if (isRenderPipelinePtr(p)) {
      // TODO(@darzu): OUTPUT parameterize output targets
      const targets: GPUColorTargetState[] = [
        {
          format: canvasFormat,
        },
      ];

      if (p.meshOpt.stepMode === "per-instance") {
        const vertBuf = cyKindToNameToRes.manyBuffer[p.meshOpt.vertex.name];
        const instBuf = cyKindToNameToRes.manyBuffer[p.meshOpt.instance.name];
        const idxBuffer = cyKindToNameToRes.idxBuffer[p.meshOpt.index.name];

        const vertexInputStruct =
          `struct VertexInput {\n` +
          `${vertBuf.struct.wgsl(false, 0)}\n` +
          `}\n`;
        const instanceInputStruct =
          `struct InstanceInput {\n` +
          `${instBuf.struct.wgsl(false, vertBuf.struct.memberCount)}\n` +
          `}\n`;

        // render shader
        // TODO(@darzu): pass vertex buffer and instance buffer into shader
        const shaderStr =
          `${shaderResStructs.join("\n")}\n` +
          `${shaderResVars.join("\n")}\n` +
          `${vertexInputStruct}\n` +
          `${instanceInputStruct}\n` +
          `${p.shader()}\n`;

        // render pipeline
        const shader = device.createShaderModule({
          code: shaderStr,
        });
        const rndrPipelineDesc: GPURenderPipelineDescriptor = {
          // TODO(@darzu): allow this to be parameterized
          primitive: prim_tris,
          depthStencil: depthStencilOpts,
          multisample: {
            count: antiAliasSampleCount,
          },
          layout: device.createPipelineLayout({
            bindGroupLayouts: [resBindGroupLayout],
          }),
          vertex: {
            module: shader,
            entryPoint: p.shaderVertexEntry,
            buffers: [
              vertBuf.struct.vertexLayout("vertex", 0),
              instBuf.struct.vertexLayout(
                "instance",
                vertBuf.struct.memberCount
              ),
            ],
          },
          fragment: {
            module: shader,
            entryPoint: p.shaderFragmentEntry,
            targets,
          },
        };
        // console.dir(rndrPipelineDesc);
        const rndrPipeline = device.createRenderPipeline(rndrPipelineDesc);
        const cyPipeline: CyRndrPipeline = {
          ptr: p,
          indexBuf: idxBuffer,
          vertexBuf: vertBuf,
          instanceBuf: instBuf,
          pipeline: rndrPipeline,
          // resourceLayouts,
          bindGroups: [resBindGroup],
        };
        cyKindToNameToRes.renderPipeline[p.name] = cyPipeline;
      } else if (p.meshOpt.stepMode === "per-mesh-handle") {
        // TODO(@darzu): de-duplicate with above?
        const vertBuf =
          cyKindToNameToRes.manyBuffer[p.meshOpt.pool.vertsPtr.name];
        const idxBuffer =
          cyKindToNameToRes.idxBuffer[p.meshOpt.pool.triIndsPtr.name];
        const uniBuf =
          cyKindToNameToRes.manyBuffer[p.meshOpt.pool.unisPtr.name];
        const pool = cyKindToNameToRes.meshPool[p.meshOpt.pool.name];

        const uniUsage: CyGlobalUsage<CyManyBufferPtr<any>> = {
          ptr: p.meshOpt.pool.unisPtr,
          access: "read",
        };
        const uniBGLayout = mkBindGroupLayout([uniUsage], true);
        const uniBG = mkBindGroup(uniBGLayout, [uniUsage], "one");

        const uniStruct = globalToWgslDefs(uniUsage, "one");
        const uniVar = globalToWgslVars(uniUsage, "one", 1, 0);

        const vertexInputStruct =
          `struct VertexInput {\n` +
          `${vertBuf.struct.wgsl(false, 0)}\n` +
          `}\n`;

        // render shader
        // TODO(@darzu): pass vertex buffer and instance buffer into shader
        const shaderStr =
          `${shaderResStructs.join("\n")}\n` +
          `${shaderResVars.join("\n")}\n` +
          `${uniStruct}\n` +
          `${uniVar}\n` +
          `${vertexInputStruct}\n` +
          `${p.shader()}\n`;

        // TODO(@darzu): need uni bind group layout

        // render pipeline
        const shader = device.createShaderModule({
          code: shaderStr,
        });
        const rndrPipelineDesc: GPURenderPipelineDescriptor = {
          // TODO(@darzu): allow this to be parameterized
          primitive: prim_tris,
          depthStencil: depthStencilOpts,
          multisample: {
            count: antiAliasSampleCount,
          },
          layout: device.createPipelineLayout({
            bindGroupLayouts: [resBindGroupLayout, uniBGLayout],
            // TODO(@darzu): need bind group layout for mesh pool uniform
          }),
          vertex: {
            module: shader,
            entryPoint: p.shaderVertexEntry,
            buffers: [vertBuf.struct.vertexLayout("vertex", 0)],
          },
          fragment: {
            module: shader,
            entryPoint: p.shaderFragmentEntry,
            targets,
          },
        };
        // console.dir(rndrPipelineDesc);
        const rndrPipeline = device.createRenderPipeline(rndrPipelineDesc);
        const cyPipeline: CyRndrPipeline = {
          ptr: p,
          indexBuf: idxBuffer,
          vertexBuf: vertBuf,
          pipeline: rndrPipeline,
          pool,
          // resourceLayouts,
          bindGroups: [resBindGroup, uniBG],
        };
        cyKindToNameToRes.renderPipeline[p.name] = cyPipeline;
      } else {
        never(p.meshOpt, `Unimplemented step kind`);
      }
    } else {
      const shaderStr =
        `${shaderResStructs.join("\n")}\n` +
        `${shaderResVars.join("\n")}\n` +
        `${p.shader()}\n`;

      const emptyLayout = device.createBindGroupLayout({
        entries: [],
      });

      let compPipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({
          bindGroupLayouts: [resBindGroupLayout],
        }),
        compute: {
          module: device.createShaderModule({
            code: shaderStr,
          }),
          entryPoint: p.shaderComputeEntry ?? "main",
        },
      });
      const cyPipeline: CyCompPipeline = {
        ptr: p,
        pipeline: compPipeline,
        bindGroup: resBindGroup,
      };
      cyKindToNameToRes.compPipeline[p.name] = cyPipeline;
    }
  }

  // TODO(@darzu): pass in elsewhere?
  const pool: MeshPool<
    typeof VertexStruct.desc,
    typeof MeshUniformStruct.desc
  > = cyKindToNameToRes.meshPool["meshPool"]!;

  // TODO(@darzu): hacky grab
  let sceneUni: CyOne<typeof SceneStruct.desc> =
    cyKindToNameToRes.oneBuffer["scene"]!;

  // render bundle
  let bundledMIds = new Set<number>();
  let needsRebundle = false;
  let lastWireMode: [boolean, boolean] = [
    renderer.drawLines,
    renderer.drawTris,
  ];
  // let renderBundle: GPURenderBundle;
  updateRenderBundle([]);

  function gpuBufferWriteAllMeshUniforms(handles: MeshHandleStd[]) {
    // TODO(@darzu): make this update all meshes at once
    for (let m of handles) {
      pool.updateUniform(m);
    }
  }

  // recomputes textures, widths, and aspect ratio on canvas resize
  let depthTexture: GPUTexture | null = null;
  let depthTextureView: GPUTextureView | null = null;
  let canvasTexture: GPUTexture | null = null;
  let canvasTextureView: GPUTextureView | null = null;
  let lastWidth = 0;
  let lastHeight = 0;

  function checkCanvasResize() {
    const newWidth = canvas.width;
    const newHeight = canvas.height;
    if (lastWidth === newWidth && lastHeight === newHeight) return;

    const newSize = [newWidth, newHeight] as const;

    context.configure({
      device: device,
      format: canvasFormat, // presentationFormat
      // TODO(@darzu): support transparency?
      compositingAlphaMode: "opaque",
    });

    depthTexture?.destroy();
    depthTexture = device.createTexture({
      size: newSize,
      format: depthStencilFormat,
      sampleCount: antiAliasSampleCount,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    depthTextureView = depthTexture.createView();

    canvasTexture?.destroy();
    canvasTexture = device.createTexture({
      size: newSize,
      sampleCount: antiAliasSampleCount,
      format: canvasFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    canvasTextureView = canvasTexture.createView();

    lastWidth = newWidth;
    lastHeight = newHeight;
  }

  function canvasAttachment(): GPURenderPassColorAttachment {
    return {
      view: canvasTextureView!,
      resolveTarget: context.getCurrentTexture().createView(),
      loadOp: "clear",
      clearValue: {
        r: renderer.backgroundColor[0],
        g: renderer.backgroundColor[1],
        b: renderer.backgroundColor[2],
        a: 1,
      },
      storeOp: "store",
    };
  }

  function depthAttachment(): GPURenderPassDepthStencilAttachment {
    return {
      view: depthTextureView!,
      depthLoadOp: "clear",
      depthClearValue: 1.0,
      depthStoreOp: "store",
      stencilLoadOp: "clear",
      stencilClearValue: 0,
      stencilStoreOp: "store",
    };
  }

  function addMesh(m: Mesh): MeshHandleStd {
    const handle: MeshHandleStd = pool.addMesh(m);
    return handle;
  }
  function addMeshInstance(oldHandle: MeshHandleStd): MeshHandleStd {
    const d = MeshUniformStruct.clone(oldHandle.shaderData);
    const newHandle = pool.addMeshInstance(oldHandle, d);
    return newHandle;
  }
  function updateMesh(handle: MeshHandleStd, newMeshData: Mesh) {
    pool.updateMeshVertices(handle, newMeshData);
  }

  function updateRenderBundle(handles: MeshHandleStd[]) {
    needsRebundle = false; // TODO(@darzu): hack?

    bundledMIds.clear();
    handles.forEach((h) => bundledMIds.add(h.mId));

    lastWireMode = [renderer.drawLines, renderer.drawTris];

    // record all the draw calls we'll need in a bundle which we'll replay during the render loop each frame.
    // This saves us an enormous amount of JS compute. We need to rebundle if we add/remove meshes.
    for (let p of Object.values(cyKindToNameToRes.renderPipeline)) {
      // TODO(@darzu): OUTPUT, pipeline.output;
      //    just airty and color here
      //    need bundle per-pipeline, or per same output
      const bundleEnc = device.createRenderBundleEncoder({
        colorFormats: [canvasFormat],
        depthStencilFormat: depthStencilFormat,
        sampleCount: antiAliasSampleCount,
      });

      bundleEnc.setPipeline(p.pipeline);
      if (p.bindGroups.length)
        // bind group 0 is always the global resources
        // TODO(@darzu): this seems a bit hacky
        bundleEnc.setBindGroup(0, p.bindGroups[0]);
      bundleEnc.setIndexBuffer(p.indexBuf.buffer, "uint16");
      bundleEnc.setVertexBuffer(0, p.vertexBuf.buffer);
      if (p.ptr.meshOpt.stepMode === "per-instance") {
        assert(!!p.instanceBuf);
        bundleEnc.setVertexBuffer(1, p.instanceBuf.buffer);
        bundleEnc.drawIndexed(p.indexBuf.length, p.instanceBuf.length, 0, 0);
      } else if (p.ptr.meshOpt.stepMode === "per-mesh-handle") {
        assert(!!p.pool && p.bindGroups.length >= 2);
        const uniBG = p.bindGroups[1]; // TODO(@darzu): hacky convention?
        // TODO(@darzu): filter meshes?
        for (let m of p.pool.allMeshes) {
          // TODO(@darzu): HACK
          if (handles.indexOf(m) < 0) continue;
          bundleEnc.setBindGroup(1, uniBG, [
            m.uniIdx * p.pool.opts.unis.struct.size,
          ]);
          bundleEnc.drawIndexed(
            m.triNum * 3,
            undefined,
            m.triIdx * 3,
            m.vertIdx
          );
        }
      } else {
        never(p.ptr.meshOpt, `Unimplemented mesh step mode`);
      }

      let renderBundle = bundleEnc.finish();
      cyRenderToBundle[p.ptr.name] = renderBundle;
    }
  }

  function renderFrame(viewProj: mat4, handles: MeshHandleStd[]): void {
    checkCanvasResize();

    // update scene data
    sceneUni.queueUpdate({
      ...sceneUni.lastData!,
      time: 1000 / 60,
      cameraViewProjMatrix: viewProj,
    });

    // update all mesh transforms
    gpuBufferWriteAllMeshUniforms(handles);

    // TODO(@darzu): more fine grain
    needsRebundle =
      needsRebundle ||
      bundledMIds.size !== handles.length ||
      renderer.drawLines !== lastWireMode[0] ||
      renderer.drawTris !== lastWireMode[1];
    if (!needsRebundle) {
      for (let mId of handles.map((o) => o.mId)) {
        if (!bundledMIds.has(mId)) {
          needsRebundle = true;
          break;
        }
      }
    }
    if (needsRebundle) {
      // console.log("rebundeling");
      updateRenderBundle(handles);
    }

    // start collecting our render commands for this frame
    const commandEncoder = device.createCommandEncoder();

    // run compute shaders
    for (let p of Object.values(cyKindToNameToRes.compPipeline)) {
      const compPassEncoder = commandEncoder.beginComputePass();
      compPassEncoder.setPipeline(p.pipeline);
      compPassEncoder.setBindGroup(0, p.bindGroup);
      // TODO(@darzu): parameterize workgroup count
      compPassEncoder.dispatchWorkgroups(
        ...(p.ptr.workgroupCounts ?? [1, 1, 1])
      );
      compPassEncoder.end();
    }

    // TODO(@darzu): support multi-output
    function isOutputEq(
      a: CyRndrPipelinePtr["output"],
      b: CyRndrPipelinePtr["output"]
    ) {
      return a.name === b.name;
    }

    // render bundles
    // TODO(@darzu): ordering needs to be set by outside config
    // TODO(@darzu): same attachments need to be shared
    let canvAtt = canvasAttachment();
    let depthAtt = depthAttachment();
    let lastOutput: CyRndrPipelinePtr["output"] | undefined;
    let renderPassEncoder: GPURenderPassEncoder | undefined;
    for (let p of Object.values(cyKindToNameToRes.renderPipeline)) {
      if (!lastOutput) lastOutput = p.ptr.output;

      const bundle = cyRenderToBundle[p.ptr.name];

      if (!renderPassEncoder || !isOutputEq(lastOutput, p.ptr.output)) {
        renderPassEncoder?.end();
        renderPassEncoder = commandEncoder.beginRenderPass({
          // TODO(@darzu): OUTPUT, different render targets
          //    need different pass per different output; start with one bundle per pipeline
          colorAttachments: [canvAtt],
          depthStencilAttachment: depthAtt,
        });
      }

      renderPassEncoder.executeBundles([bundle]);

      lastOutput = p.ptr.output;
    }
    renderPassEncoder?.end();

    // submit render passes to GPU
    device.queue.submit([commandEncoder.finish()]);
  }

  return renderer;
}
