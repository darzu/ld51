import {
  CY,
  CyDepthTexturePtr,
  CyRenderPipelinePtr,
  CySingletonPtr,
  CyTexturePtr,
  linearSamplerPtr,
} from "./gpu-registry.js";
import { createCyStruct, texTypeToSampleType } from "./gpu-struct.js";
import { litTexturePtr } from "./pipelines/std-scene.js";

export const QuadStruct = createCyStruct(
  {
    minX: "f32",
    maxX: "f32",
    minY: "f32",
    maxY: "f32",
  },
  {
    isUniform: true,
  }
);

export function createRenderTextureToQuad(
  name: string,
  inTex: CyTexturePtr | CyDepthTexturePtr,
  outTex: CyTexturePtr,
  minX = -1,
  maxX = 1,
  minY = -1,
  maxY = 1,
  sample = false,
  // TODO(@darzu): maybe all shaders should work this way?
  //   with this dictionary being statically typed based on the globals
  //   defined in the CyPtr. Kind of like the ECS systems.
  fragSnippet?: (varNames: {
    inPx: string;
    inTex: string;
    xy: string;
    uv: string;
  }) => string
): {
  pipeline: CyRenderPipelinePtr;
  quad: CySingletonPtr<typeof QuadStruct.desc>;
} {
  const quad = CY.createSingleton(`${name}Quad`, {
    struct: QuadStruct,
    init: () => ({
      minX,
      maxX,
      minY,
      maxY,
    }),
  });
  const inTexIsUnfilterable = texTypeToSampleType[inTex.format]?.every((f) =>
    f.startsWith("unfilterable")
  );
  // TODO(@darzu): turn on-off sampling?
  const doSample = !inTexIsUnfilterable && sample;
  const pipeline = CY.createRenderPipeline(name, {
    globals: [
      // TODO(@darzu): Actually, not all textures (e.g. unfilterable rgba32float)
      //  support this sampler.
      //  Hmm. Actually the shader code itself might need to change based on filterable vs not. F.
      { ptr: linearSamplerPtr, alias: "mySampler" },
      // TODO(@darzu): WTF typescript?! This ternary is necessary for some reason.
      inTex.kind === "texture"
        ? { ptr: inTex, alias: "inTex" }
        : { ptr: inTex, alias: "inTex" },
      { ptr: quad, alias: "quad" },
    ],
    meshOpt: {
      vertexCount: 6,
      stepMode: "single-draw",
    },
    output: [outTex],
    shader: () => {
      return `
  struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) uv : vec2<f32>,
  };

  @vertex
  fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    var pos = array<vec2<f32>, 6>(
      vec2<f32>(quad.minX, quad.minY),
      vec2<f32>(quad.maxX, quad.minY),
      vec2<f32>(quad.maxX, quad.maxY),
      vec2<f32>(quad.minX, quad.maxY),
      vec2<f32>(quad.minX, quad.minY),
      vec2<f32>(quad.maxX, quad.maxY),
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
    output.uv = uv[VertexIndex];
    return output;
  }

  ${`@fragment
  fn frag_main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
    let dims : vec2<i32> = textureDimensions(inTex);
    let intUV = vec2<i32>(uv * vec2<f32>(dims));
    ${
      // TODO(@darzu): don't like this...
      !doSample
        ? `let inPx = textureLoad(inTex, intUV, 0);`
        : `let inPx = textureSample(inTex, mySampler, uv);`
    }
    ${
      fragSnippet
        ? fragSnippet({
            inPx: "inPx",
            uv: "uv",
            inTex: "inTex",
            xy: "intUV",
          })
        : `
    return vec4(inPx);
    `
    }
  }`}
    `;
    },
    shaderFragmentEntry: "frag_main",
    shaderVertexEntry: "vert_main",
  });

  return { pipeline, quad };
}
