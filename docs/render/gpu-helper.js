import { assert } from "../util.js";
import { isFunction, never } from "../util.js";
import { CY, linearSamplerPtr, } from "./gpu-registry.js";
import { createCyStruct, texTypeIsDepth, TexTypeToElementArity, texTypeToSampleType, TexTypeToWGSLElement, } from "./gpu-struct.js";
export const QuadStruct = createCyStruct({
    minX: "f32",
    maxX: "f32",
    minY: "f32",
    maxY: "f32",
}, {
    isUniform: true,
});
export const fullQuad = CY.createSingleton(`fullQuadStruct`, {
    struct: QuadStruct,
    init: () => ({
        minX: -1,
        maxX: 1,
        minY: -1,
        maxY: 1,
    }),
});
export function createRenderTextureToQuad(name, inTex, outTex, minX = -1, maxX = 1, minY = -1, maxY = 1, sample = false, 
// TODO(@darzu): maybe all shaders should work this way?
//   with this dictionary being statically typed based on the globals
//   defined in the CyPtr. Kind of like the ECS systems.
fragSnippet, libs) {
    const quad = CY.createSingleton(`${name}Quad`, {
        struct: QuadStruct,
        init: () => ({
            minX,
            maxX,
            minY,
            maxY,
        }),
    });
    const inTexIsUnfilterable = texTypeToSampleType[inTex.format]?.every((f) => f.startsWith("unfilterable"));
    // TODO(@darzu): turn on-off sampling?
    const doSample = !inTexIsUnfilterable && sample;
    outTex.format;
    const shader = (shaders) => {
        const inputArity = TexTypeToElementArity[inTex.format];
        assert(inputArity, `Missing texture element arity for: ${inTex.format}`);
        const outArity = TexTypeToElementArity[outTex.format];
        assert(outArity, `Missing texture element arity for: ${outTex.format}`);
        const returnWgslType = TexTypeToWGSLElement[outTex.format];
        assert(returnWgslType, `Missing WGSL return type for: ${outTex.format}`);
        // TODO(@darzu): we're doing all kinds of template-y / macro-y stuff w/ shaders
        //      needs more thought for good abstration.
        // TODO(@darzu): so many macro hacks. what's the principled approach?
        let fSnip = `return ${returnWgslType}(inPx);`;
        if (inputArity === 2 && outArity === 4)
            fSnip = `return ${returnWgslType}(inPx.xy, 0.0, 0.0);`;
        if (fragSnippet) {
            if (isFunction(fragSnippet))
                fSnip = fragSnippet({
                    dimsI: "dimsI",
                    dimsF: "dimsF",
                    inPx: "inPx",
                    uv: "uv",
                    inTex: "inTex",
                    xy: "xy",
                });
            else
                fSnip = shaders[fragSnippet].code;
        }
        const loadSuffix = inputArity === 1
            ? texTypeIsDepth[inTex.format]
                ? ``
                : `.x`
            : inputArity === 2
                ? `.xy`
                : inputArity === 4
                    ? `.xyzw`
                    : never(inputArity);
        return `
    ${libs ? libs.map((l) => shaders[l].code).join("\n") : ""}

    ${shaders["std-screen-quad-vert"].code}

    @fragment
    fn frag_main(@location(0) uv : vec2<f32>) -> @location(0) ${returnWgslType} {
      let dimsI : vec2<i32> = vec2<i32>(textureDimensions(inTex));
      let dimsF = vec2<f32>(dimsI);
      let xy = vec2<i32>(uv * dimsF);
      ${
        // TODO(@darzu): don't like this...
        !doSample
            ? `let inPx = textureLoad(inTex, xy, 0)${loadSuffix};`
            : `let inPx = textureSample(inTex, mySampler, uv)${loadSuffix};`}
      ${fSnip}
    }
  `;
    };
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
        shader,
        shaderFragmentEntry: "frag_main",
        shaderVertexEntry: "vert_main",
    });
    return { pipeline, quad };
}
//# sourceMappingURL=gpu-helper.js.map