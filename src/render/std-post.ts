import { CY, linearSamplerPtr } from "./gpu-registry.js";
import {
  canvasDepthTex,
  canvasTexturePtr,
  mainTexturePtr,
  normalsTexturePtr,
  positionsTexturePtr,
  sceneBufPtr,
  surfacesTexturePtr,
} from "./std-scene.js";

// TODO(@darzu): rewrite post processing with compute shader?
//  https://computergraphics.stackexchange.com/questions/54/when-is-a-compute-shader-more-efficient-than-a-pixel-shader-for-image-filtering
//  result: yes, probably it is a good idea.

export const postProcess = CY.createRenderPipeline("postProcess", {
  globals: [
    { ptr: linearSamplerPtr, alias: "samp" },
    { ptr: mainTexturePtr, alias: "colorTex" },
    { ptr: normalsTexturePtr, alias: "normTex" },
    { ptr: positionsTexturePtr, alias: "posTex" },
    { ptr: surfacesTexturePtr, alias: "surfTex" },
    { ptr: canvasDepthTex, alias: "depthTex" },
    sceneBufPtr,
  ],
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

  let dims : vec2<i32> = textureDimensions(surfTex);
  let dimsF = vec2<f32>(dims);

  let lineWidth = 3.0;
  // NOTE: we make the line width depend on resolution b/c that gives a more consistent
  //    look across resolutions.
  // let lineWidth = max((f32(dims.r) / 800.0), 1.0);

  let coord = fragUV * vec2<f32>(dims);
  let t = coord - vec2(0.0, lineWidth);
  let l = coord - vec2(lineWidth, 0.0);
  let r = coord + vec2(lineWidth, 0.0);
  let b = coord + vec2(0.0, lineWidth);
  let sT = textureLoad(surfTex, vec2<i32>(t), 0);
  let sL = textureLoad(surfTex, vec2<i32>(l), 0);
  let sR = textureLoad(surfTex, vec2<i32>(r), 0);
  let sB = textureLoad(surfTex, vec2<i32>(b), 0);  

  let h = textureSample(depthTex, samp, fragUV);
  let hT = textureSample(depthTex, samp, t / dimsF);
  let hL = textureSample(depthTex, samp, l / dimsF);
  let hR = textureSample(depthTex, samp, r / dimsF);
  let hB = textureSample(depthTex, samp, b / dimsF);  

  // NOTE: since depth changes naturally along a surface, we can't
  //  just compare depth values, we have to see if the delta in depth
  //  accross our point of interest changes.
  let depthDx = ((hR - h) - (h - hL));
  let depthDy = ((hT - h) - (h - hB));
  let depthFactor = abs(depthDx) + abs(depthDy) * 100.0;

  let n = normalize(textureSample(normTex, samp, fragUV).xyz);
  let nT = normalize(textureSample(normTex, samp, t / dimsF).xyz);
  let nL = normalize(textureSample(normTex, samp, l / dimsF).xyz);
  let nR = normalize(textureSample(normTex, samp, r / dimsF).xyz);
  let nB = normalize(textureSample(normTex, samp, b / dimsF).xyz);
  
  let surfaceDidChange = sT.r != sB.r || sL.r != sR.r;
  let objectDidChange = sT.g != sB.g || sL.g != sR.g;

  let convexXf = nR.x - nL.x;
  let convexYf = nT.y - nB.y;
  let convexityF = convexYf + convexXf;
  let convexity = max(convexityF, 0.0);
  let concavity = max(-convexityF, 0.0);

  let outlineFactor = f32(objectDidChange);

  let edgeLight = convexity * 0.1 * f32(!objectDidChange);
  let edgeDark = concavity * 0.2 + outlineFactor + depthFactor;
  let edgeColor = (edgeLight - min(edgeDark, 0.2));
  color += edgeColor * f32(surfaceDidChange || objectDidChange);

  // DEBUG: visualizes surface IDs
  // let s = textureLoad(surfTex, vec2<i32>(coord), 0);
  // color = vec4(u32toVec3f32(u32(s.r), 24u), 1.0);

  // vignette
  let edgeDistV = fragUV - 0.5;
  let edgeDist = 1.0 - dot(edgeDistV, edgeDistV) * 0.5;
  // let edgeDist = 1.0 - length(fragUV - 0.5) * 0.5;
  color *= edgeDist;
  
  return color;
}

fn u32toVec3f32(i: u32, max: u32) -> vec3<f32> {
  let maxF = f32(max);
  return vec3(
    f32(((((i % 7u) + 1u) & 1u) >> 0u) * ((i / 7u) + 1u)) / ceil(maxF / 7.0),
    f32(((((i % 7u) + 1u) & 2u) >> 1u) * ((i / 7u) + 1u)) / ceil(maxF / 7.0),
    f32(((((i % 7u) + 1u) & 4u) >> 2u) * ((i / 7u) + 1u)) / ceil(maxF / 7.0),
  );
}
  `;
  },
  shaderFragmentEntry: "frag_main",
  shaderVertexEntry: "vert_main",
});