import { CanvasDef } from "./canvas.js";
import {
  Component,
  EM,
  EntityManager,
  EntityW,
  WithComponent,
} from "./entity-manager.js";
import { mat4, quat, vec3 } from "./gl-matrix.js";
import { max } from "./math.js";
import { AuthorityDef, MeDef } from "./net/components.js";
import { WorldFrameDef } from "./physics/nonintersection.js";
import { PositionDef, RotationDef } from "./physics/transform.js";
import { RendererWorldFrameDef } from "./render/renderer-ecs.js";
import { computeNewError, reduceError } from "./smoothing.js";
import { tempQuat, tempVec3 } from "./temp-pool.js";
import { TimeDef } from "./time.js";
import { yawpitchToQuat } from "./yawpitch.js";

export type PerspectiveMode = "perspective" | "ortho";
export type CameraMode = "thirdPerson" | "thirdPersonOverShoulder";

export const CameraDef = EM.defineComponent("camera", () => {
  return {
    perspectiveMode: "perspective" as PerspectiveMode,
    fov: (2 * Math.PI) / 5,
    targetId: 0,
    positionOffset: vec3.create(),
    rotationOffset: quat.create(),
    // smoothing:
    prevTargetId: 0,
    lastRotation: quat.create(),
    lastPosition: vec3.create(),
    rotationError: quat.identity(quat.create()),
    targetPositionError: vec3.create(),
    cameraPositionError: vec3.create(),
  };
});
export type CameraProps = Component<typeof CameraDef>;

export const CameraViewDef = EM.defineComponent("cameraView", () => {
  return {
    aspectRatio: 1,
    width: 100,
    height: 100,
    viewProjMat: mat4.create(),
    location: vec3.create(),
  };
});
export type CameraView = Component<typeof CameraViewDef>;

export const CameraFollowDef = EM.defineComponent(
  "cameraFollow",
  (priority = 0) => ({
    positionOffset: vec3.create(),
    yawOffset: 0,
    pitchOffset: 0,
    priority,
  })
);

export const CAMERA_OFFSETS = {
  thirdPerson: [0, 0, 10],
  // thirdPersonOverShoulder: [1, 3, 2],
  thirdPersonOverShoulder: [2, 2, 4],
  firstPerson: [0, 0, 0],
} as const;

export function setCameraFollowPosition(
  c: EntityW<[typeof CameraFollowDef]>,
  mode: keyof typeof CAMERA_OFFSETS
) {
  vec3.copy(c.cameraFollow.positionOffset, CAMERA_OFFSETS[mode]);
}

export function registerCameraSystems(em: EntityManager) {
  em.registerSystem(
    null,
    [CameraDef, TimeDef],
    function (_, res) {
      reduceError(res.camera.rotationError, res.time.dt);
      reduceError(res.camera.targetPositionError, res.time.dt);
      reduceError(res.camera.cameraPositionError, res.time.dt);
    },
    "smoothCamera"
  );

  em.registerSystem(
    [CameraFollowDef],
    [CameraDef],
    (cs, res) => {
      const target = cs.reduce(
        (p, n) =>
          !p || n.cameraFollow.priority > p.cameraFollow.priority ? n : p,
        null as EntityW<[typeof CameraFollowDef]> | null
      );
      if (target) {
        res.camera.targetId = target.id;
        vec3.copy(
          res.camera.positionOffset,
          target.cameraFollow.positionOffset
        );
        yawpitchToQuat(res.camera.rotationOffset, {
          yaw: target.cameraFollow.yawOffset,
          pitch: target.cameraFollow.pitchOffset,
        });
      } else {
        res.camera.targetId = 0;
        vec3.zero(res.camera.positionOffset);
        quat.identity(res.camera.rotationOffset);
      }
    },
    "cameraFollowTarget"
  );

  em.registerSystem(
    null,
    [CameraDef],
    function ([], res) {
      if (res.camera.prevTargetId === res.camera.targetId) {
        quat.copy(res.camera.lastRotation, res.camera.rotationOffset);
        vec3.copy(res.camera.lastPosition, res.camera.positionOffset);
        return;
      }
      const prevTarget = em.findEntity(res.camera.prevTargetId, [
        WorldFrameDef,
      ]);
      const newTarget = em.findEntity(res.camera.targetId, [WorldFrameDef])!;
      if (prevTarget && newTarget) {
        computeNewError(
          prevTarget.world.position,
          newTarget.world.position,
          res.camera.targetPositionError
        );
        computeNewError(
          res.camera.lastPosition,
          res.camera.positionOffset,
          res.camera.cameraPositionError
        );

        const computedRotation = quat.mul(
          tempQuat(),
          prevTarget.world.rotation,
          res.camera.lastRotation
        );
        const newComputedRotation = quat.mul(
          tempQuat(),
          newTarget.world.rotation,
          res.camera.rotationOffset
        );

        computeNewError(
          computedRotation,
          newComputedRotation,
          res.camera.rotationError
        );
      }

      res.camera.prevTargetId = res.camera.targetId;
    },
    "retargetCamera"
  );

  em.addSingletonComponent(CameraViewDef);
  em.registerSystem(
    null,
    [CameraViewDef, CameraDef, MeDef, CanvasDef],
    (_, resources) => {
      const { cameraView, camera, me, htmlCanvas } = resources;

      let targetEnt = em.findEntity(camera.targetId, [RendererWorldFrameDef]);

      if (!targetEnt) return;

      const frame = targetEnt.rendererWorldFrame;

      // update aspect ratio and size
      cameraView.aspectRatio = Math.abs(
        htmlCanvas.canvas.width / htmlCanvas.canvas.height
      );
      cameraView.width = htmlCanvas.canvas.width;
      cameraView.height = htmlCanvas.canvas.height;

      let viewMatrix = mat4.create();
      if (targetEnt) {
        const computedTranslation = vec3.add(
          tempVec3(),
          frame.position,
          camera.targetPositionError
        );
        mat4.fromRotationTranslationScale(
          viewMatrix,
          frame.rotation,
          computedTranslation,
          frame.scale
        );
        vec3.copy(cameraView.location, computedTranslation);
      }

      const computedCameraRotation = quat.mul(
        tempQuat(),
        camera.rotationOffset,
        camera.rotationError
      );

      mat4.multiply(
        viewMatrix,
        viewMatrix,
        mat4.fromQuat(mat4.create(), computedCameraRotation)
      );

      const computedCameraTranslation = vec3.add(
        tempVec3(),
        camera.positionOffset,
        camera.cameraPositionError
      );

      mat4.translate(viewMatrix, viewMatrix, computedCameraTranslation);
      mat4.invert(viewMatrix, viewMatrix);

      const projectionMatrix = mat4.create();
      if (camera.perspectiveMode === "ortho") {
        const ORTHO_SIZE = 10;
        mat4.ortho(
          projectionMatrix,
          -ORTHO_SIZE,
          ORTHO_SIZE,
          -ORTHO_SIZE,
          ORTHO_SIZE,
          -400,
          100
        );
      } else {
        mat4.perspective(
          projectionMatrix,
          camera.fov,
          cameraView.aspectRatio,
          1,
          100000.0 /*view distance*/
        );
      }
      const viewProj = mat4.multiply(
        mat4.create(),
        projectionMatrix,
        viewMatrix
      ) as Float32Array;

      cameraView.viewProjMat = viewProj;
    },
    "updateCameraView"
  );
}
