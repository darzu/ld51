import { EM, } from "../entity-manager.js";
import { vec3 } from "../gl-matrix.js";
import { PhysicsParentDef, PositionDef, RotationDef, } from "../physics/transform.js";
import { ColliderDef } from "../physics/collider.js";
import { AuthorityDef, SyncDef } from "../net/components.js";
import { eventWizard } from "../net/events.js";
import { InRangeDef, InteractableDef } from "./interact.js";
import { LocalPlayerDef, PlayerDef } from "./player.js";
import { CameraFollowDef, CAMERA_OFFSETS, } from "../camera.js";
import { copyAABB, createAABB } from "../physics/broadphase.js";
import { InputsDef } from "../inputs.js";
import { clamp } from "../math.js";
import { DeletedDef } from "../delete.js";
import { YawPitchDef, yawpitchToQuat } from "../yawpitch.js";
export const TurretDef = EM.defineComponent("turret", () => {
    return {
        mannedId: 0,
        minYaw: -Math.PI * 0.5,
        maxYaw: +Math.PI * 0.5,
        minPitch: -Math.PI * 0.1,
        maxPitch: Math.PI * 0.3,
        cameraYawOffset: 0,
        cameraPitchOffset: 0,
        invertYaw: false,
        cameraYawFactor: 0,
    };
});
export function constructNetTurret(e, startYaw, startPitch, aabbOrInteractionEntity, cameraYawOffset = 0, cameraPitchOffset = -Math.PI / 8, cameraYawFactor = 0, cameraFollowOffset = CAMERA_OFFSETS.thirdPersonOverShoulder) {
    EM.ensureComponentOn(e, YawPitchDef);
    e.yawpitch.yaw = startYaw;
    e.yawpitch.pitch = startPitch;
    EM.ensureComponentOn(e, TurretDef);
    e.turret.minYaw += startYaw;
    e.turret.maxYaw += startYaw;
    e.turret.cameraYawOffset = cameraYawOffset;
    e.turret.cameraPitchOffset = cameraPitchOffset;
    e.turret.cameraYawFactor = cameraYawFactor;
    EM.ensureComponentOn(e, RotationDef);
    EM.ensureComponentOn(e, SyncDef);
    e.sync.dynamicComponents.push(YawPitchDef.id);
    // setup camera params
    EM.ensureComponentOn(e, CameraFollowDef, 0);
    vec3.copy(e.cameraFollow.positionOffset, cameraFollowOffset);
    e.cameraFollow.yawOffset = cameraYawOffset;
    e.cameraFollow.pitchOffset = cameraPitchOffset;
    let interactBox;
    // create separate hitbox for interacting with the turret
    if ("min" in aabbOrInteractionEntity) {
        interactBox = EM.newEntity();
        const interactAABB = copyAABB(createAABB(), aabbOrInteractionEntity);
        vec3.scale(interactAABB.min, interactAABB.min, 2);
        vec3.scale(interactAABB.max, interactAABB.max, 2);
        EM.ensureComponentOn(interactBox, PhysicsParentDef, e.id);
        EM.ensureComponentOn(interactBox, PositionDef, [0, 0, 0]);
        EM.ensureComponentOn(interactBox, ColliderDef, {
            shape: "AABB",
            solid: false,
            aabb: interactAABB,
        });
    }
    else {
        interactBox = aabbOrInteractionEntity;
    }
    EM.ensureComponentOn(e, InteractableDef);
    e.interaction.colliderId = interactBox.id;
}
export const raiseManTurret = eventWizard("man-turret", () => [
    [PlayerDef, AuthorityDef],
    [TurretDef, CameraFollowDef, AuthorityDef],
], ([player, turret]) => {
    const localPlayer = EM.getResource(LocalPlayerDef);
    if ((localPlayer === null || localPlayer === void 0 ? void 0 : localPlayer.playerId) === player.id) {
        turret.cameraFollow.priority = 2;
        turret.authority.pid = player.authority.pid;
        turret.authority.seq++;
        turret.authority.updateSeq = 0;
    }
    player.player.manning = true;
    turret.turret.mannedId = player.id;
}, {
    legalEvent: ([player, turret]) => {
        return turret.turret.mannedId === 0;
    },
});
export const raiseUnmanTurret = eventWizard("unman-turret", () => [[PlayerDef], [TurretDef, CameraFollowDef]], ([player, turret]) => {
    turret.cameraFollow.priority = 0;
    player.player.manning = false;
    turret.turret.mannedId = 0;
}, {
    legalEvent: ([player, turret]) => {
        return turret.turret.mannedId === player.id;
    },
});
export function registerTurretSystems(em) {
    em.registerSystem([TurretDef, RotationDef, YawPitchDef], [], (turrets, res) => {
        for (let c of turrets) {
            if (c.turret.invertYaw)
                yawpitchToQuat(c.rotation, {
                    yaw: -c.yawpitch.yaw,
                    pitch: c.yawpitch.pitch,
                });
            else
                yawpitchToQuat(c.rotation, c.yawpitch);
        }
    }, "turretYawPitch");
    em.registerSystem([TurretDef, YawPitchDef, CameraFollowDef], [InputsDef, LocalPlayerDef], (turrets, res) => {
        const player = em.findEntity(res.localPlayer.playerId, [PlayerDef]);
        if (!player)
            return;
        for (let c of turrets) {
            if (DeletedDef.isOn(c))
                continue;
            if (c.turret.mannedId !== player.id)
                continue;
            c.yawpitch.yaw += -res.inputs.mouseMovX * 0.005;
            c.yawpitch.yaw = clamp(c.yawpitch.yaw, c.turret.minYaw, c.turret.maxYaw);
            c.yawpitch.pitch += -res.inputs.mouseMovY * 0.002;
            c.yawpitch.pitch = clamp(c.yawpitch.pitch, c.turret.minPitch, c.turret.maxPitch);
            c.cameraFollow.yawOffset =
                c.turret.cameraYawOffset + c.yawpitch.yaw * c.turret.cameraYawFactor;
        }
    }, "turretAim");
    em.registerSystem([TurretDef, InRangeDef, AuthorityDef, CameraFollowDef], [InputsDef, LocalPlayerDef], (turrets, res) => {
        const player = em.findEntity(res.localPlayer.playerId, [
            PlayerDef,
            AuthorityDef,
        ]);
        if (!player)
            return;
        for (let c of turrets) {
            if (DeletedDef.isOn(c))
                continue;
            if (res.inputs.keyClicks["e"]) {
                if (c.turret.mannedId === player.id)
                    raiseUnmanTurret(player, c);
                if (c.turret.mannedId === 0)
                    raiseManTurret(player, c);
            }
        }
    }, "turretManUnman");
}
//# sourceMappingURL=turret.js.map