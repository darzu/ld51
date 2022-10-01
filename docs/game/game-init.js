import { InputsDef } from "../inputs.js";
import { registerInitTransforms } from "../physics/transform.js";
import { registerEnemyShipSystems } from "./enemy-ship.js";
import { LocalPlayerDef, registerPlayerSystems, } from "./player.js";
import { CameraDef, CameraFollowDef, registerCameraSystems, setCameraFollowPosition, } from "../camera.js";
import { registerNetSystems } from "../net/net.js";
import { registerHandleNetworkEvents, registerSendOutboxes, } from "../net/network-event-handler.js";
import { registerJoinSystems } from "../net/join.js";
import { registerSyncSystem, registerUpdateSystem, registerAckUpdateSystem, } from "../net/sync.js";
import { registerPredictSystem } from "../net/predict.js";
import { registerEventSystems } from "../net/events.js";
import { registerBulletCollisionSystem } from "./bullet-collision.js";
import { registerShipSystems } from "./player-ship.js";
import { registerBuildBulletsSystem, registerBulletUpdate } from "./bullet.js";
import { registerInitCanvasSystem } from "../canvas.js";
import { registerConstructRenderablesSystem, registerRenderer, registerRenderInitSystem, registerUpdateRendererWorldFrames, registerUpdateSmoothedWorldFrames, RendererDef, } from "../render/renderer-ecs.js";
import { registerDeleteEntitiesSystem } from "../delete.js";
import { registerCannonSystems } from "./cannon.js";
import { registerInteractionSystem } from "./interact.js";
import { registerModeler } from "./modeler.js";
import { registerToolSystems } from "./tool.js";
import { registerMotionSmoothingRecordLocationsSystem, registerMotionSmoothingSystems, } from "../motion-smoothing.js";
import { registerCursorSystems } from "./cursor.js";
import { registerPhysicsSystems } from "../physics/phys.js";
import { registerNoodleSystem } from "./noodles.js";
import { registerUpdateLifetimes } from "./lifetime.js";
import { registerMusicSystems } from "../music.js";
import { registerNetDebugSystem } from "../net/net-debug.js";
import { callInitFns } from "../init.js";
import { registerGrappleDbgSystems } from "./grapple.js";
import { registerTurretSystems } from "./turret.js";
import { registerUISystems } from "./ui.js";
import { registerDevSystems } from "../console.js";
import { registerControllableSystems } from "./controllable.js";
import { registerGameStateSystems, } from "./gamestate.js";
export function registerCommonSystems(em) {
    registerNetSystems(em);
    registerInitCanvasSystem(em);
    registerUISystems(em);
    registerDevSystems(em);
    registerGameStateSystems(em);
    registerRenderInitSystem(em);
    registerMusicSystems(em);
    registerHandleNetworkEvents(em);
    registerMotionSmoothingRecordLocationsSystem(em);
    registerUpdateSystem(em);
    registerPredictSystem(em);
    registerJoinSystems(em);
    // registerGroundSystems(em);
    registerShipSystems(em);
    registerBuildBulletsSystem(em);
    registerCursorSystems(em);
    registerGrappleDbgSystems(em);
    registerInitTransforms(em);
    registerEnemyShipSystems(em);
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
    registerDeleteEntitiesSystem(em);
    registerMotionSmoothingSystems(em);
    registerUpdateSmoothedWorldFrames(em);
    registerUpdateRendererWorldFrames(em);
    registerCameraSystems(em);
    registerRenderViewController(em);
    registerConstructRenderablesSystem(em);
    registerRenderer(em);
    callInitFns(em);
}
function registerRenderViewController(em) {
    em.registerSystem([], [InputsDef, RendererDef, CameraDef], (_, { inputs, renderer, camera }) => {
        var _a;
        // check render mode
        if (inputs.keyClicks["1"]) {
            // both lines and tris
            renderer.renderer.drawLines = true;
            renderer.renderer.drawTris = true;
        }
        else if (inputs.keyClicks["2"]) {
            // "wireframe", lines only
            renderer.renderer.drawLines = true;
            renderer.renderer.drawTris = false;
        }
        // check perspective mode
        if (inputs.keyClicks["3"]) {
            if (camera.perspectiveMode === "ortho")
                camera.perspectiveMode = "perspective";
            else
                camera.perspectiveMode = "ortho";
        }
        // check camera mode
        if (inputs.keyClicks["4"]) {
            const localPlayer = em.getResource(LocalPlayerDef);
            const p = em.findEntity((_a = localPlayer === null || localPlayer === void 0 ? void 0 : localPlayer.playerId) !== null && _a !== void 0 ? _a : -1, [CameraFollowDef]);
            if (p) {
                const overShoulder = p.cameraFollow.positionOffset[0] !== 0;
                if (overShoulder)
                    setCameraFollowPosition(p, "thirdPerson");
                else
                    setCameraFollowPosition(p, "thirdPersonOverShoulder");
            }
        }
    }, "renderView");
}
//# sourceMappingURL=game-init.js.map