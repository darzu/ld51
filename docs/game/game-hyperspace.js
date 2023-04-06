import { CameraDef } from "../camera.js";
import { PositionDef, RotationDef } from "../physics/transform.js";
import { RendererDef, RenderableConstructDef } from "../render/renderer-ecs.js";
import { stdRenderPipeline } from "../render/pipelines/std-mesh.js";
import { postProcess } from "../render/pipelines/std-post.js";
import { outlineRender } from "../render/pipelines/std-outline.js";
import { shadowDepthTextures, shadowPipelines, } from "../render/pipelines/std-shadow.js";
import { initStars } from "../render/pipelines/std-stars.js";
import { AssetsDef } from "./assets.js";
import { MeDef } from "../net/components.js";
import { createPlayer } from "./player.js";
import { createPlayerShip } from "./player-ship.js";
import { GameStateDef } from "./gamestate.js";
import { createGridComposePipelines } from "../render/pipelines/std-compose.js";
import { noisePipes } from "../render/pipelines/std-noise.js";
import { DevConsoleDef } from "../console.js";
import { initOcean, OceanDef, UVPosDef } from "./ocean.js";
import { quat, vec2, vec3 } from "../gl-matrix.js";
import { createSpawner } from "./spawner.js";
import { tempVec3 } from "../temp-pool.js";
import { createDarkStarNow, STAR1_COLOR, STAR2_COLOR } from "./darkstar.js";
import { renderOceanPipe } from "../render/pipelines/std-ocean.js";
import { WoodAssetsDef, WoodStateDef } from "../wood.js";
import { ColliderDef } from "../physics/collider.js";
import { EASE_INQUAD } from "../util-ease.js";
// export let jfaMaxStep = VISUALIZE_JFA ? 0 : 999;
function spawnRandomDarkStar(res, approxPosition, color) {
    const orbitalAxis = vec3.fromValues(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    vec3.normalize(orbitalAxis, orbitalAxis);
    vec3.normalize(orbitalAxis, orbitalAxis);
    // TODO: this only works because the darkstar is orbiting the origin
    const perpendicular = vec3.cross(tempVec3(), approxPosition, orbitalAxis);
    const starPosition = vec3.cross(perpendicular, orbitalAxis, perpendicular);
    vec3.normalize(starPosition, starPosition);
    vec3.scale(starPosition, starPosition, vec3.length(approxPosition));
    return createDarkStarNow(res, starPosition, color, vec3.fromValues(0, 0, 0), orbitalAxis);
}
export async function initHyperspaceGame(em) {
    const camera = em.addSingletonComponent(CameraDef);
    camera.fov = Math.PI * 0.5;
    em.addSingletonComponent(GameStateDef);
    em.whenResources(OceanDef).then(async () => {
        // await awaitTimeout(1000); // TODO(@darzu): what is happening
        createPlayer(em);
    });
    em.registerSystem([], [], () => {
        // console.log("debugLoop");
        // em.whyIsntSystemBeingCalled("oceanGPUWork");
    }, "debugLoop");
    const grid = [[...shadowDepthTextures]];
    //   //
    //   [oceanJfa._inputMaskTex, oceanJfa._uvMaskTex],
    //   //
    //   [oceanJfa.voronoiTex, shadowDepthTexture],
    // ];
    // let grid = noiseGridFrame;
    // const grid = [[oceanJfa._voronoiTexs[0]], [oceanJfa._voronoiTexs[1]]];
    let gridCompose = createGridComposePipelines(grid);
    em.registerSystem(null, [RendererDef, DevConsoleDef], (_, res) => {
        res.renderer.pipelines = [
            ...shadowPipelines,
            stdRenderPipeline,
            renderOceanPipe,
            outlineRender,
            //renderStars,
            //...blurPipelines,
            postProcess,
            //...(res.dev.showConsole ? gridCompose : []),
        ];
    }, "hyperspaceGame");
    const res = await em.whenResources(AssetsDef, RendererDef);
    // const ghost = createGhost(em);
    // em.ensureComponentOn(ghost, RenderableConstructDef, res.assets.cube.proto);
    // ghost.controllable.speed *= 3;
    // ghost.controllable.sprintMul *= 3;
    {
        // // debug camera
        // vec3.copy(ghost.position, [-185.02, 66.25, -69.04]);
        // quat.copy(ghost.rotation, [0.0, -0.92, 0.0, 0.39]);
        // vec3.copy(ghost.cameraFollow.positionOffset, [0.0, 0.0, 0.0]);
        // ghost.cameraFollow.yawOffset = 0.0;
        // ghost.cameraFollow.pitchOffset = -0.465;
        // let g = ghost;
        // vec3.copy(g.position, [-208.43, 29.58, 80.05]);
        // quat.copy(g.rotation, [0.0, -0.61, 0.0, 0.79]);
        // vec3.copy(g.cameraFollow.positionOffset, [0.0, 0.0, 0.0]);
        // g.cameraFollow.yawOffset = 0.0;
        // g.cameraFollow.pitchOffset = -0.486;
    }
    // one-time GPU jobs
    res.renderer.renderer.submitPipelines([], [...noisePipes, initStars]);
    initOcean();
    // TODO(@darzu): dbg
    //await asyncTimeout(2000);
    const { me, ocean, woodAssets } = await em.whenResources(OceanDef, MeDef, WoodAssetsDef);
    if (me.host) {
        // experimental ship:
        const fangShip = em.newEntity();
        // TODO(@darzu): seperate mesh pool?
        em.ensureComponentOn(fangShip, RenderableConstructDef, res.assets.ship_fangs.proto);
        em.ensureComponentOn(fangShip, PositionDef);
        em.ensureComponentOn(fangShip, RotationDef);
        quat.fromEuler(fangShip.rotation, 0, Math.PI * 0.5, 0);
        em.ensureComponentOn(fangShip, UVPosDef, [0.1, 0.15]);
        em.ensureComponentOn(fangShip, WoodStateDef, woodAssets.ship_fangs);
        // TODO(@darzu): need a much finer grain collider
        em.ensureComponentOn(fangShip, ColliderDef, {
            shape: "AABB",
            solid: false,
            aabb: res.assets.ship_fangs.aabb,
        });
        const ship = createPlayerShip([0.1, 0.1]);
        const ship2 = await em.whenEntityHas(ship, UVPosDef);
        const NUM_ENEMY = 40;
        for (let i = 0; i < NUM_ENEMY; i++) {
            let enemyUVPos = [Math.random(), Math.random()];
            while (ocean.uvToEdgeDist(enemyUVPos) < 0.1) {
                enemyUVPos = [Math.random(), Math.random()];
            }
            // const enemyEndPos = ocean.uvToPos(vec3.create(), enemyUVPos);
            const enemyEndPos = vec3.create();
            ocean.uvToGerstnerDispAndNorm(enemyEndPos, tempVec3(), enemyUVPos);
            // vec3.add(enemyEndPos, enemyEndPos, [0, 10, 0]);
            const enemyStartPos = vec3.sub(vec3.create(), enemyEndPos, [0, 20, 0]);
            const towardsPlayerDir = vec2.sub(vec2.create(), ship2.uvPos, enemyUVPos);
            vec2.normalize(towardsPlayerDir, towardsPlayerDir);
            // console.log("creating spawner");
            const enemySpawner = createSpawner(enemyUVPos, towardsPlayerDir, {
                startPos: enemyStartPos,
                endPos: enemyEndPos,
                durationMs: 1000,
                easeFn: EASE_INQUAD,
            });
        }
        const orbitalAxis = vec3.fromValues(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        vec3.normalize(orbitalAxis, orbitalAxis);
        // TODO: this only works because the darkstar is orbiting the origin
        const approxPosition = vec3.fromValues(-1000, 2000, -1000);
        const perpendicular = vec3.cross(tempVec3(), approxPosition, orbitalAxis);
        const starPosition = vec3.cross(perpendicular, orbitalAxis, perpendicular);
        vec3.normalize(starPosition, starPosition);
        vec3.scale(starPosition, starPosition, vec3.length(approxPosition));
        const star1 = spawnRandomDarkStar(res, vec3.fromValues(-1000, 2000, -1000), STAR1_COLOR
        //vec3.fromValues(0, 0, 0)
        );
        const star2 = spawnRandomDarkStar(res, vec3.fromValues(0, 0, 2000), STAR2_COLOR);
    }
}
//# sourceMappingURL=game-hyperspace.js.map