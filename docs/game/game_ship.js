import { EM } from "../entity-manager.js";
import { InputsDef } from "../inputs.js";
import { registerConstructRenderablesSystem, registerRenderer, registerUpdateRendererWorldFrames, } from "../render/renderer.js";
import { PositionDef, registerInitTransforms } from "../physics/transform.js";
import { registerBoatSpawnerSystem, registerBoatSystems } from "./boat.js";
import { createPlayer, LocalPlayerDef, registerPlayerSystems, } from "./player.js";
import { CameraDef, CameraFollowDef, registerCameraSystems, setCameraFollowPosition, } from "../camera.js";
import { registerNetSystems } from "../net/net.js";
import { registerHandleNetworkEvents, registerSendOutboxes, } from "../net/network-event-handler.js";
import { registerJoinSystems } from "../net/join.js";
import { registerSyncSystem, registerUpdateSystem, registerAckUpdateSystem, } from "../net/sync.js";
import { registerPredictSystem } from "../net/predict.js";
import { registerEventSystems } from "../net/events.js";
import { registerTimeSystem } from "../time.js";
import { initGroundSystem, registerGroundSystems } from "./ground.js";
import { registerBulletCollisionSystem } from "./bullet-collision.js";
import { createShip, registerShipSystems, ShipLocalDef } from "./ship.js";
import { registerBuildBulletsSystem, registerBulletUpdate } from "./bullet.js";
import { AssetsDef, registerAssetLoader } from "./assets.js";
import { registerInitCanvasSystem } from "../canvas.js";
import { registerRenderInitSystem, RendererDef, } from "../render/render_init.js";
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
import { registerUISystems, TextDef } from "./ui.js";
import { DevConsoleDef, registerDevSystems } from "../console.js";
import { registerControllableSystems } from "./controllable.js";
import { GameStateDef, GameState, registerGameStateSystems, } from "./gamestate.js";
export const ScoreDef = EM.defineComponent("score", () => {
    return {
        maxScore: 0,
        currentScore: 0,
    };
});
function registerScoreSystems(em) {
    em.addSingletonComponent(ScoreDef);
    em.registerSystem([ShipLocalDef, PositionDef], [ScoreDef, GameStateDef], (ships, res) => {
        if (res.gameState.state !== GameState.PLAYING)
            return;
        if (ships.length) {
            const ship = ships.reduce((p, n) => (n.position[2] > p.position[2] ? n : p), ships[0]);
            const currentScore = Math.round(ship.position[2] / 10);
            res.score.maxScore = Math.max(currentScore, res.score.maxScore);
            res.score.currentScore = currentScore;
        }
    }, "updateScore");
}
export function callAllSystems(em) {
    EM.callSystem("time");
    EM.callSystem("getStatsFromNet");
    EM.callSystem("getEventsFromNet");
    EM.callSystem("sendEventsToNet");
    EM.callSystem("canvas");
    EM.callSystem("uiText");
    EM.callSystem("devConsoleToggle");
    EM.callSystem("devConsole");
    EM.callSystem("restartTimer");
    EM.callSystem("updateScore");
    EM.callSystem("renderInit");
    EM.callSystem("musicStart");
    EM.callSystem("handleNetworkEvents");
    EM.callSystem("recordPreviousLocations");
    EM.callSystem("clearRemoteUpdatesMarker");
    EM.callSystem("netUpdate");
    EM.callSystem("predict");
    EM.callSystem("connectToServer");
    EM.callSystem("handleJoin");
    EM.callSystem("handleJoinResponse");
    EM.callSystem("assetLoader");
    EM.callSystem("groundSystem");
    EM.callSystem("startGame");
    EM.callSystem("shipHealthCheck");
    EM.callSystem("shipMove");
    EM.callSystem("shipScore");
    EM.callSystem("groundPropsBuild");
    EM.callSystem("boatPropsBuild");
    EM.callSystem("cannonPropsBuild");
    EM.callSystem("gemPropsBuild");
    EM.callSystem("shipPropsBuild");
    EM.callSystem("buildBullets");
    EM.callSystem("buildCursor");
    EM.callSystem("placeCursorAtScreenCenter");
    EM.callSystem("ensureTransform");
    EM.callSystem("ensureWorldFrame");
    EM.callSystem("stepBoats");
    EM.callSystem("boatsFire");
    EM.callSystem("breakBoats");
    EM.callSystem("controllableInput");
    EM.callSystem("controllableCameraFollow");
    EM.callSystem("buildPlayers");
    EM.callSystem("playerFacingDir");
    EM.callSystem("stepPlayers");
    EM.callSystem("playerOnShip");
    EM.callSystem("updateBullets");
    EM.callSystem("updateNoodles");
    EM.callSystem("updateLifetimes");
    EM.callSystem("interaction");
    EM.callSystem("turretYawPitch");
    EM.callSystem("turretAim");
    EM.callSystem("turretManUnman");
    EM.callSystem("reloadCannon");
    EM.callSystem("playerControlCannon");
    EM.callSystem("playerManCanon");
    EM.callSystem("physicsInit");
    EM.callSystem("clampVelocityByContact");
    EM.callSystem("registerPhysicsClampVelocityBySize");
    EM.callSystem("registerPhysicsApplyLinearVelocity");
    EM.callSystem("physicsApplyAngularVelocity");
    EM.callSystem("updateLocalFromPosRotScale");
    EM.callSystem("updateWorldFromLocalAndParent");
    EM.callSystem("registerUpdateWorldAABBs");
    EM.callSystem("physicsStepContact");
    EM.callSystem("registerUpdateLocalPhysicsAfterRebound");
    EM.callSystem("updateWorldFromLocalAndParent2");
    EM.callSystem("colliderMeshes");
    EM.callSystem("debugMeshes");
    EM.callSystem("debugMeshTransform");
    EM.callSystem("bulletCollision");
    EM.callSystem("modelerOnOff");
    EM.callSystem("modelerClicks");
    EM.callSystem("aabbBuilder");
    EM.callSystem("toolPickup");
    EM.callSystem("toolDrop");
    EM.callSystem("netDebugSystem");
    EM.callSystem("netAck");
    EM.callSystem("netSync");
    EM.callSystem("sendOutboxes");
    EM.callSystem("detectedEventsToHost");
    EM.callSystem("handleEventRequests");
    EM.callSystem("handleEventRequestAcks");
    EM.callSystem("detectedEventsToRequestedEvents");
    EM.callSystem("requestedEventsToEvents");
    EM.callSystem("sendEvents");
    EM.callSystem("handleEvents");
    EM.callSystem("handleEventAcks");
    EM.callSystem("runEvents");
    EM.callSystem("delete");
    EM.callSystem("smoothMotion");
    EM.callSystem("updateMotionSmoothing");
    EM.callSystem("updateRendererWorldFrames");
    EM.callSystem("smoothCamera");
    EM.callSystem("cameraFollowTarget");
    EM.callSystem("retargetCamera");
    EM.callSystem("updateCameraView");
    EM.callSystem("renderView");
    EM.callSystem("constructRenderables");
    EM.callSystem("stepRenderer");
    EM.callSystem("inputs");
    EM.callSystem("shipUI");
    EM.callSystem("spawnBoats");
    EM.callOneShotSystems();
}
export function registerAllSystems(em) {
    registerTimeSystem(em);
    registerNetSystems(em);
    registerInitCanvasSystem(em);
    registerUISystems(em);
    registerDevSystems(em);
    registerGameStateSystems(em);
    registerScoreSystems(em);
    registerRenderInitSystem(em);
    registerMusicSystems(em);
    registerHandleNetworkEvents(em);
    registerMotionSmoothingRecordLocationsSystem(em);
    registerUpdateSystem(em);
    registerPredictSystem(em);
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
    registerDeleteEntitiesSystem(em);
    registerMotionSmoothingSystems(em);
    registerUpdateRendererWorldFrames(em);
    registerCameraSystems(em);
    registerRenderViewController(em);
    registerConstructRenderablesSystem(em);
    registerRenderer(em);
    callInitFns(em);
}
function registerShipGameUI(em) {
    em.registerSystem(null, [TextDef, DevConsoleDef], (_, res) => {
        const avgFPS = 1000 / res.dev.avgFrameTime;
        const lowerTxt = `Belgus, you are the last hope of the Squindles, keep the gemheart alive! Failure is inevitable. move: WASD, mouse; cannon: e, left-click; fps:${avgFPS.toFixed(1)}`;
        res.text.lowerText = lowerTxt;
    }, "shipUI");
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
export function initShipGame(em, hosting) {
    registerShipGameUI(em);
    registerBoatSpawnerSystem(em);
    EM.addSingletonComponent(CameraDef);
    EM.addSingletonComponent(GameStateDef);
    if (hosting) {
        createShip();
        initGroundSystem(em);
    }
    createPlayer(em);
}
function debugBoatParts(em) {
    let once = false;
    em.registerSystem([], [AssetsDef], (_, res) => {
        if (once)
            return;
        once = true;
        // TODO(@darzu): this works!
        // const bigM = res.assets.boat_broken;
        // for (let i = 0; i < bigM.length; i++) {
        //   const e = em.newEntity();
        //   em.ensureComponentOn(e, RenderableConstructDef, bigM[i].mesh);
        //   em.ensureComponentOn(e, PositionDef, [0, 0, 0]);
        // }
    }, "debugBoatParts");
}
//# sourceMappingURL=game_ship.js.map