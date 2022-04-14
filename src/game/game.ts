import { Component, EM, EntityManager } from "../entity-manager.js";
import { mat4, quat, vec3 } from "../gl-matrix.js";
import { InputsDef } from "../inputs.js";
import { jitter } from "../math.js";
import {
  registerConstructRenderablesSystem,
  registerRenderer,
  registerUpdateRendererWorldFrames,
  RenderableConstructDef,
  RenderableDef,
} from "../render/renderer.js";
import {
  PositionDef,
  registerInitTransforms,
  TransformDef,
} from "../physics/transform.js";
import {
  BoatPropsDef,
  registerBoatSpawnerSystem,
  registerBoatSystems,
} from "./boat.js";
import {
  createPlayer,
  LocalPlayerDef,
  PlayerPropsDef,
  registerPlayerSystems,
} from "./player.js";
import {
  CameraDef,
  CameraFollowDef,
  registerCameraSystems,
  setCameraFollowPosition,
} from "../camera.js";
import { registerNetSystems } from "../net/net.js";
import {
  registerHandleNetworkEvents,
  registerSendOutboxes,
} from "../net/network-event-handler.js";
import { registerJoinSystems } from "../net/join.js";
import {
  registerSyncSystem,
  registerUpdateSystem,
  registerAckUpdateSystem,
} from "../net/sync.js";
import { registerPredictSystem } from "../net/predict.js";
import { registerEventSystems } from "../net/events.js";
import { PhysicsTimerDef, registerTimeSystem } from "../time.js";
import {
  GroundPropsDef,
  GroundSystemDef,
  initGroundSystem,
  registerGroundSystems,
} from "./ground.js";
import { registerBulletCollisionSystem } from "./bullet-collision.js";
import { createShip, registerShipSystems, ShipLocalDef } from "./ship.js";
import { registerBuildBulletsSystem, registerBulletUpdate } from "./bullet.js";
import {
  AssetsDef,
  GROUNDSIZE,
  LIGHT_BLUE,
  registerAssetLoader,
} from "./assets.js";
import { registerInitCanvasSystem } from "../canvas.js";
import {
  registerRenderInitSystem,
  RendererDef,
} from "../render/render_init.js";
import { registerDeleteEntitiesSystem } from "../delete.js";
import { registerCannonSystems } from "./cannon.js";
import { registerInteractionSystem } from "./interact.js";
import { registerModeler } from "./modeler.js";
import { registerToolSystems } from "./tool.js";
import {
  registerMotionSmoothingRecordLocationsSystem,
  registerMotionSmoothingSystems,
} from "../motion-smoothing.js";
import { GlobalCursor3dDef, registerCursorSystems } from "./cursor.js";
import { ColliderDef } from "../physics/collider.js";
import { AuthorityDef, MeDef, SyncDef } from "../net/components.js";
import { FinishedDef } from "../build.js";
import { registerPhysicsSystems } from "../physics/phys.js";
import { registerNoodleSystem } from "./noodles.js";
import { registerUpdateLifetimes } from "./lifetime.js";
import { registerMusicSystems } from "../music.js";
import { GameState, GameStateDef } from "./gamestate.js";
import { registerRestartSystem } from "./restart.js";
import { registerNetDebugSystem } from "../net/net-debug.js";
import { assert } from "../test.js";
import { callInitFns } from "../init.js";
import { registerGrappleDbgSystems } from "./grapple.js";
import { registerTurretSystems } from "./turret.js";
import { registerUISystems, TextDef } from "./ui.js";
import { DevConsoleDef, registerDevSystems } from "../console.js";
import { registerControllableSystems } from "./controllable.js";
import { createGhost } from "./ghost.js";
import { ColorDef } from "../color.js";

export const ScoreDef = EM.defineComponent("score", () => {
  return {
    maxScore: 0,
    currentScore: 0,
  };
});

function registerScoreSystems(em: EntityManager) {
  em.addSingletonComponent(ScoreDef);

  em.registerSystem(
    [ShipLocalDef, PositionDef],
    [ScoreDef],
    (ships, res) => {
      if (ships.length) {
        const ship = ships.reduce(
          (p, n) => (n.position[2] > p.position[2] ? n : p),
          ships[0]
        );
        const currentScore = Math.round(ship.position[2] / 10);
        res.score.maxScore = Math.max(currentScore, res.score.maxScore);
        res.score.currentScore = currentScore;
      }
    },
    "updateScore"
  );
}

export function registerAllSystems(em: EntityManager) {
  registerTimeSystem(em);
  registerNetSystems(em);
  registerInitCanvasSystem(em);
  registerUISystems(em);
  registerDevSystems(em);
  registerScoreSystems(em);
  registerRenderInitSystem(em);
  registerMusicSystems(em);
  registerHandleNetworkEvents(em);
  registerMotionSmoothingRecordLocationsSystem(em);
  registerUpdateSystem(em);
  registerPredictSystem(em);
  registerMotionSmoothingSystems(em);
  registerJoinSystems(em);
  registerAssetLoader(em);
  registerGroundSystems(em);
  registerShipSystems(em);
  registerBuildBulletsSystem(em);
  registerCursorSystems(em);
  registerGrappleDbgSystems(em);
  registerInitTransforms(em);
  registerBoatSystems(em);
  registerControllableSystems(em);
  registerPlayerSystems(em);
  registerBulletUpdate(em);
  registerNoodleSystem(em);
  registerUpdateLifetimes(em);
  registerInteractionSystem(em);
  registerTurretSystems(em);
  registerCannonSystems(em);
  registerPhysicsSystems(em);
  registerBulletCollisionSystem(em);
  registerModeler(em);
  registerToolSystems(em);
  registerNetDebugSystem(em);
  registerAckUpdateSystem(em);
  registerSyncSystem(em);
  registerSendOutboxes(em);
  registerEventSystems(em);
  registerRestartSystem(em);
  registerDeleteEntitiesSystem(em);
  registerUpdateRendererWorldFrames(em);
  registerCameraSystems(em);
  registerRenderViewController(em);
  registerConstructRenderablesSystem(em);
  registerRenderer(em);

  callInitFns(em);
}

function registerShipGameUI(em: EntityManager) {
  em.registerSystem(
    null,
    [TextDef, DevConsoleDef],
    (_, res) => {
      const avgFPS = 1000 / res.dev.avgFrameTime;
      const lowerTxt = `Belgus, you are the last hope of the Squindles, keep the gemheart alive! Failure is inevitable. move: WASD, mouse; cannon: e, left-click; fps:${avgFPS.toFixed(
        1
      )}`;
      res.text.lowerText = lowerTxt;
    },
    "shipUI"
  );
}

function registerRenderViewController(em: EntityManager) {
  em.registerSystem(
    [],
    [InputsDef, RendererDef, CameraDef],
    (_, { inputs, renderer, camera }) => {
      // check render mode
      if (inputs.keyClicks["1"]) {
        // both lines and tris
        renderer.renderer.drawLines = true;
        renderer.renderer.drawTris = true;
      } else if (inputs.keyClicks["2"]) {
        // "wireframe", lines only
        renderer.renderer.drawLines = true;
        renderer.renderer.drawTris = false;
      }

      // check perspective mode
      if (inputs.keyClicks["3"]) {
        if (camera.perspectiveMode === "ortho")
          camera.perspectiveMode = "perspective";
        else camera.perspectiveMode = "ortho";
      }

      // check camera mode
      if (inputs.keyClicks["4"]) {
        const localPlayer = em.getResource(LocalPlayerDef);
        const p = em.findEntity(localPlayer?.playerId ?? -1, [CameraFollowDef]);
        if (p) {
          const overShoulder = p.cameraFollow.positionOffset[0] !== 0;
          if (overShoulder) setCameraFollowPosition(p, "thirdPerson");
          else setCameraFollowPosition(p, "thirdPersonOverShoulder");
        }
      }
    },
    "renderView"
  );
}

export function initShipGame(em: EntityManager, hosting: boolean) {
  registerShipGameUI(em);
  em.addSingletonComponent(CameraDef);

  if (hosting) {
    em.addSingletonComponent(GameStateDef);
    registerBoatSpawnerSystem(em);
    createShip();
    initGroundSystem(em);
  }

  createPlayer(em);
}

export function initDbgGame(em: EntityManager, hosting: boolean) {
  em.addSingletonComponent(CameraDef);

  em.registerOneShotSystem(
    null,
    [AssetsDef, GlobalCursor3dDef, RendererDef],
    (_, res) => {
      const g = createGhost(em);
      // em.ensureComponentOn(g, RenderableConstructDef, res.assets.cube.proto);
      // createPlayer(em);

      const c = res.globalCursor3d.cursor()!;
      if (RenderableDef.isOn(c)) c.renderable.enabled = false;

      vec3.copy(res.renderer.renderer.backgroundColor, [0.7, 0.8, 1.0]);

      const p = em.newEntity();
      em.ensureComponentOn(p, RenderableConstructDef, res.assets.plane.proto);
      em.ensureComponentOn(p, ColorDef, [0.2, 0.3, 0.2]);
      em.ensureComponentOn(p, PositionDef, [0, -5, 0]);
    }
  );
}

function debugBoatParts(em: EntityManager) {
  let once = false;
  em.registerSystem(
    [],
    [AssetsDef],
    (_, res) => {
      if (once) return;
      once = true;

      // TODO(@darzu): this works!
      // const bigM = res.assets.boat_broken;
      // for (let i = 0; i < bigM.length; i++) {
      //   const e = em.newEntity();
      //   em.ensureComponentOn(e, RenderableConstructDef, bigM[i].mesh);
      //   em.ensureComponentOn(e, PositionDef, [0, 0, 0]);
      // }
    },
    "debugBoatParts"
  );
}
