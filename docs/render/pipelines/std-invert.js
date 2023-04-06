import { CY, linearSamplerPtr, } from "../gpu-registry.js";
import { texTypeToSampleType } from "../gpu-struct.js";
// TODO(@darzu): de-duplicate this with createRenderTextureToQuad !!
export function createInvertPipeline(name, inTex, outTex, fragShader) {
    var _a;
    const inTexIsUnfilterable = (_a = texTypeToSampleType[inTex.format]) === null || _a === void 0 ? void 0 : _a.every((f) => f.startsWith("unfilterable"));
    const pipeline = CY.createRenderPipeline(name, {
        globals: [
            { ptr: linearSamplerPtr, alias: "mySampler" },
            // TODO(@darzu): WTF typescript?! This ternary is necessary for some reason.
            inTex.kind === "texture"
                ? { ptr: inTex, alias: "myTexture" }
                : { ptr: inTex, alias: "myTexture" },
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
    @location(0) fragUV : vec2<f32>,
  };

  @stage(vertex)
  fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    var pos = array<vec2<f32>, 6>(
      vec2<f32>(-1.0, -1.0),
      vec2<f32>(1.0, -1.0),
      vec2<f32>(1.0, 1.0),
      vec2<f32>(-1.0, 1.0),
      vec2<f32>(-1.0, -1.0),
      vec2<f32>(1.0, 1.0),
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

  ${fragShader !== null && fragShader !== void 0 ? fragShader : `@stage(fragment)
  fn frag_main(@location(0) fragUV : vec2<f32>) -> @location(0) vec4<f32> {
    ${
            // TODO(@darzu): don't like this...
            inTexIsUnfilterable
                ? `
        let dims : vec2<i32> = vec2<i32>(textureDimensions(myTexture));
        let intUV = vec2<i32>(fragUV * vec2<f32>(dims));
        let res = textureLoad(myTexture, intUV, 0);
        `
                : `let res = textureSample(myTexture, mySampler, fragUV);`}
    return 1.0 - vec4(res);
  }`}
    `;
        },
        shaderFragmentEntry: "frag_main",
        shaderVertexEntry: "vert_main",
    });
    return pipeline;
}
//# sourceMappingURL=std-invert.js.map