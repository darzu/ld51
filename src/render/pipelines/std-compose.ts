import { oceanJfa } from "../../game/game-hyperspace.js";
import { createRenderTextureToQuad } from "../gpu-helper.js";
import { CyPipelinePtr, CyRenderPipelinePtr } from "../gpu-registry.js";
import { noiseGridFrame } from "./std-noise.js";
import { canvasTexturePtr, litTexturePtr } from "./std-scene.js";
import { uvToPosTex } from "./xp-uv-unwrap.js";

// TODO(@darzu): rename to grid compose

const padding = 0.05;

// TODO(@darzu): make grid a parameter
export function createGridComposePipelines(): CyRenderPipelinePtr[] {
  // const grid = [
  //   //
  //   [oceanJfa._inputMaskTex, oceanJfa._uvMaskTex],
  //   //
  //   [oceanJfa.voronoiTex, uvToPosTex],
  // ];
  // let grid = noiseGridFrame;
  const grid = oceanJfa._debugGrid;
  // const grid = [[oceanJfa._voronoiTexs[0]], [oceanJfa._voronoiTexs[1]]];

  const width = grid[0].length;
  const height = grid.length;
  const uvWidth = (2.0 - padding * (width + 1)) / width;
  const uvHeight = (2.0 - padding * (height + 1)) / height;
  const uvStartX = -1.0 + padding;
  const uvStartY = 1.0 - padding;

  let pipes: CyRenderPipelinePtr[] = [];

  for (let ri = 0; ri < grid.length; ri++) {
    for (let ci = 0; ci < grid[ri].length; ci++) {
      const tex = grid[ri][ci];
      const xMin = uvStartX + ci * (uvWidth + padding);
      const xMax = xMin + uvWidth;
      const yMax = uvStartY - ri * (uvHeight + padding);
      const yMin = yMax - uvHeight;
      pipes.push(
        createRenderTextureToQuad(
          `composeViews_${ci}x${ri}`,
          tex,
          canvasTexturePtr,
          xMin,
          xMax,
          yMin,
          yMax,
          false
        ).pipeline
      );
    }
  }

  return pipes;
}
