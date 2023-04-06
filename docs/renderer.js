import { CanvasDef } from "./canvas.js";
import { EM } from "./entity-manager.js";
import { ColorDef } from "./game/game.js";
import { CameraDef, PlayerEntDef, } from "./game/player.js";
import { mat4, vec3 } from "./gl-matrix.js";
import { isMeshHandle, MeshHandleDef } from "./mesh-pool.js";
import { AuthorityDef, MeDef } from "./net/components.js";
import { WorldFrameDef } from "./physics/nonintersection.js";
import { RendererDef } from "./render_init.js";
import { PhysicsTimerDef } from "./time.js";
import { PositionDef, RotationDef, } from "./physics/transform.js";
export const RenderableDef = EM.defineComponent("renderable", (meshOrProto, enabled = true, layer = 0) => {
    return {
        enabled,
        layer,
        meshOrProto: meshOrProto !== null && meshOrProto !== void 0 ? meshOrProto : {
            pos: [],
            tri: [],
            colors: [],
        },
    };
});
export const CameraViewDef = EM.defineComponent("cameraView", () => {
    return {
        aspectRatio: 1,
        width: 100,
        height: 100,
        viewProjMat: mat4.create(),
    };
});
function stepRenderer(renderer, objs, cameraView) {
    // ensure our mesh handle is up to date
    for (let o of objs) {
        // TODO(@darzu): color:
        if (ColorDef.isOn(o)) {
            vec3.copy(o.meshHandle.tint, o.color);
        }
        mat4.copy(o.meshHandle.transform, o.world.transform);
    }
    // filter
    objs = objs.filter((o) => o.renderable.enabled);
    // sort
    objs.sort((a, b) => b.renderable.layer - a.renderable.layer);
    // render
    renderer.renderFrame(cameraView.viewProjMat, objs.map((o) => o.meshHandle));
}
function updateCameraView(players, resources) {
    const { cameraView, camera, me, htmlCanvas } = resources;
    const mePlayer = players.filter((p) => p.authority.pid === me.pid)[0];
    if (!mePlayer)
        return;
    // update aspect ratio and size
    cameraView.aspectRatio = Math.abs(htmlCanvas.canvas.width / htmlCanvas.canvas.height);
    cameraView.width = htmlCanvas.canvas.width;
    cameraView.height = htmlCanvas.canvas.height;
    if (camera.cameraMode === "thirdPerson") {
        vec3.copy(camera.offset, [0, 0, 10]);
    }
    else if (camera.cameraMode === "thirdPersonOverShoulder") {
        vec3.copy(camera.offset, [2, 2, 8]);
    }
    let viewMatrix = mat4.create();
    if (mePlayer) {
        mat4.copy(viewMatrix, mePlayer.world.transform);
    }
    mat4.multiply(viewMatrix, viewMatrix, mat4.fromQuat(mat4.create(), camera.rotation));
    mat4.translate(viewMatrix, viewMatrix, camera.offset);
    mat4.invert(viewMatrix, viewMatrix);
    const projectionMatrix = mat4.create();
    if (camera.perspectiveMode === "ortho") {
        const ORTHO_SIZE = 40;
        mat4.ortho(projectionMatrix, -ORTHO_SIZE, ORTHO_SIZE, -ORTHO_SIZE, ORTHO_SIZE, -400, 200);
    }
    else {
        mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, cameraView.aspectRatio, 1, 10000.0 /*view distance*/);
    }
    const viewProj = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix);
    cameraView.viewProjMat = viewProj;
}
export function registerUpdateCameraView(em) {
    em.addSingletonComponent(CameraViewDef);
    em.registerSystem([PlayerEntDef, PositionDef, RotationDef, AuthorityDef, WorldFrameDef], [CameraViewDef, CameraDef, MeDef, CanvasDef], updateCameraView);
}
export function registerRenderer(em) {
    em.registerSystem([RenderableDef, WorldFrameDef, MeshHandleDef], [CameraViewDef, PhysicsTimerDef, RendererDef], (objs, res) => {
        if (res.physicsTimer.steps > 0)
            stepRenderer(res.renderer.renderer, objs, res.cameraView);
    }, "stepRenderer");
}
export function registerAddMeshHandleSystem(em) {
    em.registerSystem([RenderableDef], [RendererDef], (es, res) => {
        for (let e of es) {
            if (!MeshHandleDef.isOn(e)) {
                // TODO(@darzu): how should we handle instancing?
                // TODO(@darzu): this seems somewhat inefficient to look for this every frame
                let meshHandle;
                if (isMeshHandle(e.renderable.meshOrProto))
                    meshHandle = res.renderer.renderer.addMeshInstance(e.renderable.meshOrProto);
                else
                    meshHandle = res.renderer.renderer.addMesh(e.renderable.meshOrProto);
                em.addComponent(e.id, MeshHandleDef, meshHandle);
            }
        }
    }, "addMeshHandle");
}
//# sourceMappingURL=renderer.js.map