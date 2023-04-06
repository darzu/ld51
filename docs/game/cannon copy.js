import { EM } from "../entity-manager.js";
import { PhysicsTimerDef } from "../time.js";
import { quat, vec3 } from "../gl-matrix.js";
import { FinishedDef } from "../build.js";
import { ColorDef } from "./game.js";
import { RenderableConstructDef } from "../render/renderer.js";
import { PhysicsParentDef, PositionDef, RotationDef, } from "../physics/transform.js";
import { ColliderDef } from "../physics/collider.js";
import { AuthorityDef, MeDef, SyncDef } from "../net/components.js";
import { DetectedEventsDef, eventWizard, } from "../net/events.js";
import { fireBullet } from "./bullet.js";
import { ToolDef } from "./tool.js";
import { InRangeDef, InteractableDef } from "./interact.js";
import { LocalPlayerDef, PlayerEntDef } from "./player.js";
import { CameraDef } from "../camera.js";
import { AssetsDef } from "./assets.js";
import { copyAABB, createAABB } from "../physics/broadphase.js";
import { WorldFrameDef, } from "../physics/nonintersection.js";
import { MusicDef, randChordId } from "../music.js";
import { InputsDef } from "../inputs.js";
import { clamp } from "../math.js";
import { DeletedDef } from "../delete.js";
import { defineNetEntityHelper, defineSerializableComponent, } from "../em_helpers.js";
const CANNON_FRAMES = 180;
export const YawPitchDef = defineSerializableComponent(EM, "yawpitch", () => ({
    yaw: 0,
    pitch: 0,
}), (o, buf) => {
    buf.writeFloat32(o.yaw);
    buf.writeFloat32(o.pitch);
}, (o, buf) => {
    o.yaw = buf.readFloat32();
    o.pitch = buf.readFloat32();
});
export const { CannonPropsDef, CannonLocalDef, createCannon } = defineNetEntityHelper(EM, {
    name: "cannon",
    defaultProps: (loc, yaw, pitch, parentId) => {
        return {
            location: loc !== null && loc !== void 0 ? loc : vec3.fromValues(0, 0, 0),
            yaw: yaw !== null && yaw !== void 0 ? yaw : 0,
            pitch: pitch !== null && pitch !== void 0 ? pitch : 0,
            parentId: parentId !== null && parentId !== void 0 ? parentId : 0,
        };
    },
    serializeProps: (c, buf) => {
        buf.writeVec3(c.location);
        buf.writeFloat32(c.yaw);
        buf.writeUint32(c.parentId);
    },
    deserializeProps: (c, buf) => {
        buf.readVec3(c.location);
        c.yaw = buf.readFloat32();
        c.parentId = buf.readUint32();
    },
    defaultLocal: () => {
        return {
            loaded: true,
            mannedId: 0,
            minYaw: -Math.PI * 0.5,
            maxYaw: +Math.PI * 0.5,
            minPitch: -Math.PI * 0.3,
            maxPitch: Math.PI * 0.1,
            fireMs: 0,
            fireDelayMs: 1000,
            loadedId: 0,
        };
    },
    dynamicComponents: [YawPitchDef],
    buildResources: [AssetsDef, MeDef],
    build: (e, res) => {
        const em = EM;
        const props = e.cannonProps;
        em.ensureComponent(e.id, PositionDef, props.location);
        em.ensureComponent(e.id, RotationDef);
        em.ensureComponent(e.id, ColorDef, [0, 0, 0]);
        em.ensureComponent(e.id, RenderableConstructDef, res.assets.cannon.mesh);
        e.yawpitch.yaw = props.yaw;
        e.yawpitch.pitch = props.pitch;
        e.cannonLocal.minYaw += props.yaw;
        e.cannonLocal.maxYaw += props.yaw;
        em.ensureComponent(e.id, ColliderDef, {
            shape: "AABB",
            solid: true,
            aabb: res.assets.cannon.aabb,
        });
        em.ensureComponentOn(e, PhysicsParentDef, props.parentId);
        // create seperate hitbox for interacting with the cannon
        const interactBox = em.newEntity();
        const interactAABB = copyAABB(createAABB(), res.assets.cannon.aabb);
        vec3.scale(interactAABB.min, interactAABB.min, 2);
        vec3.scale(interactAABB.max, interactAABB.max, 2);
        em.ensureComponentOn(interactBox, PhysicsParentDef, e.id);
        em.ensureComponentOn(interactBox, PositionDef, [0, 0, 0]);
        em.ensureComponentOn(interactBox, ColliderDef, {
            shape: "AABB",
            solid: false,
            aabb: interactAABB,
        });
        em.ensureComponent(e.id, InteractableDef, interactBox.id);
    },
});
export const raiseManCannon = eventWizard("man-cannon", () => [
    [PlayerEntDef, AuthorityDef],
    [CannonLocalDef, AuthorityDef],
], ([player, cannon]) => {
    const localPlayer = EM.getResource(LocalPlayerDef);
    if ((localPlayer === null || localPlayer === void 0 ? void 0 : localPlayer.playerId) === player.id) {
        const camera = EM.getResource(CameraDef);
        quat.identity(camera.rotation);
        camera.targetId = cannon.id;
        cannon.authority.pid = player.authority.pid;
        cannon.authority.seq++;
        cannon.authority.updateSeq = 0;
    }
    player.player.manning = true;
    cannon.cannonLocal.mannedId = player.id;
}, {
    legalEvent: ([player, cannon]) => {
        return cannon.cannonLocal.mannedId === 0;
    },
});
export const raiseUnmanCannon = eventWizard("unman-cannon", () => [[PlayerEntDef], [CannonLocalDef]], ([player, cannon]) => {
    const camera = EM.getResource(CameraDef);
    if ((camera === null || camera === void 0 ? void 0 : camera.targetId) === cannon.id) {
        quat.identity(camera.rotation);
        camera.targetId = 0;
    }
    player.player.manning = false;
    cannon.cannonLocal.mannedId = 0;
}, {
    legalEvent: ([player, cannon]) => {
        return cannon.cannonLocal.mannedId === player.id;
    },
});
export function registerPlayerCannonSystem(em) {
    em.registerSystem([CannonLocalDef, RotationDef, YawPitchDef], [], (cannons, res) => {
        for (let c of cannons) {
            quat.copy(c.rotation, quat.IDENTITY);
            quat.rotateY(c.rotation, c.rotation, c.yawpitch.yaw);
            quat.rotateZ(c.rotation, c.rotation, c.yawpitch.pitch);
        }
    }, "applyCannonYawPitch");
    em.registerSystem([CannonLocalDef], [PhysicsTimerDef], (cannons, res) => {
        for (let c of cannons) {
            if (c.cannonLocal.fireMs > 0) {
                c.cannonLocal.fireMs -=
                    res.physicsTimer.period * res.physicsTimer.steps;
            }
        }
    }, "reloadCannon");
    const raiseFireCannon = eventWizard("fire-cannon", [[PlayerEntDef], [CannonLocalDef, WorldFrameDef]], ([player, cannon]) => {
        var _a;
        // only the firing player creates a bullet
        if (player.id === ((_a = EM.getResource(LocalPlayerDef)) === null || _a === void 0 ? void 0 : _a.playerId)) {
            const fireDir = quat.create();
            quat.rotateY(fireDir, cannon.world.rotation, Math.PI * 0.5);
            const firePos = vec3.create();
            vec3.transformQuat(firePos, firePos, fireDir);
            vec3.add(firePos, firePos, cannon.world.position);
            fireBullet(EM, 1, firePos, fireDir, 0.1);
        }
        // but everyone resets the cooldown and plays sound effects
        cannon.cannonLocal.fireMs = cannon.cannonLocal.fireDelayMs;
        const chord = randChordId();
        EM.getResource(MusicDef).playChords([chord], "major", 2.0, 3.0, -2);
    }, {
        legalEvent: ([player, cannon]) => {
            return cannon.cannonLocal.fireMs <= 0;
        },
    });
    em.registerSystem([CannonLocalDef, WorldFrameDef, YawPitchDef], [MusicDef, InputsDef, MeDef, CameraDef, LocalPlayerDef], (cannons, res) => {
        const player = em.findEntity(res.localPlayer.playerId, [PlayerEntDef]);
        if (!player)
            return;
        for (let c of cannons) {
            if (DeletedDef.isOn(c))
                continue;
            if (c.cannonLocal.mannedId !== player.id)
                continue;
            if (res.inputs.lclick && c.cannonLocal.fireMs <= 0) {
                raiseFireCannon(player, c);
            }
            c.yawpitch.yaw += -res.inputs.mouseMovX * 0.005;
            c.yawpitch.yaw = clamp(c.yawpitch.yaw, c.cannonLocal.minYaw, c.cannonLocal.maxYaw);
            c.yawpitch.pitch += res.inputs.mouseMovY * 0.002;
            c.yawpitch.pitch = clamp(c.yawpitch.pitch, c.cannonLocal.minPitch, c.cannonLocal.maxPitch);
            quat.rotateY(res.camera.rotation, quat.IDENTITY, +Math.PI / 2);
            quat.rotateX(res.camera.rotation, res.camera.rotation, -Math.PI * 0.15);
        }
    }, "playerControlCannon");
    em.registerSystem([CannonLocalDef, InRangeDef, AuthorityDef, WorldFrameDef], [DetectedEventsDef, InputsDef, LocalPlayerDef], (cannons, res) => {
        const player = em.findEntity(res.localPlayer.playerId, [
            PlayerEntDef,
            AuthorityDef,
        ]);
        if (!player)
            return;
        for (let c of cannons) {
            if (DeletedDef.isOn(c))
                continue;
            if (res.inputs.keyClicks["e"]) {
                if (c.cannonLocal.mannedId === player.id)
                    raiseUnmanCannon(player, c);
                if (c.cannonLocal.mannedId === 0)
                    raiseManCannon(player, c);
            }
            // allow firing un-manned cannons
            if (res.inputs.lclick &&
                c.cannonLocal.mannedId === 0 &&
                c.cannonLocal.fireMs <= 0) {
                raiseFireCannon(player, c);
            }
        }
    }, "playerManCanon");
}
export const AmmunitionDef = EM.defineComponent("ammunition", (amount) => {
    return {
        amount: amount || 0,
    };
});
export const AmmunitionConstructDef = EM.defineComponent("ammunitionConstruct", (loc, amount) => {
    return {
        location: loc !== null && loc !== void 0 ? loc : vec3.fromValues(0, 0, 0),
        amount: amount || 0,
    };
});
function serializeAmmunitionConstruct(c, buf) {
    buf.writeVec3(c.location);
    buf.writeUint16(c.amount);
}
function deserializeAmmunitionConstruct(c, buf) {
    buf.readVec3(c.location);
    c.amount = buf.readUint16();
}
EM.registerSerializerPair(AmmunitionConstructDef, serializeAmmunitionConstruct, deserializeAmmunitionConstruct);
export function registerBuildAmmunitionSystem(em) {
    em.registerSystem([AmmunitionConstructDef], [MeDef, AssetsDef], (boxes, res) => {
        for (let e of boxes) {
            if (FinishedDef.isOn(e))
                continue;
            const props = e.ammunitionConstruct;
            if (!PositionDef.isOn(e)) {
                em.addComponent(e.id, PositionDef, props.location);
            }
            if (!RotationDef.isOn(e)) {
                // TODO: the asset is upside down. should probably fix the asset
                const rotation = quat.create();
                quat.rotateX(rotation, rotation, Math.PI);
                quat.normalize(rotation, rotation);
                em.addComponent(e.id, RotationDef, rotation);
            }
            if (!ColorDef.isOn(e))
                em.addComponent(e.id, ColorDef, [0.2, 0.1, 0.05]);
            if (!PhysicsParentDef.isOn(e))
                em.addComponent(e.id, PhysicsParentDef);
            if (!RenderableConstructDef.isOn(e))
                em.addComponent(e.id, RenderableConstructDef, res.assets.ammunitionBox.mesh);
            if (!AuthorityDef.isOn(e))
                em.addComponent(e.id, AuthorityDef, res.me.pid);
            if (!AmmunitionDef.isOn(e))
                em.addComponent(e.id, AmmunitionDef, props.amount);
            if (!ColliderDef.isOn(e)) {
                const collider = em.addComponent(e.id, ColliderDef);
                collider.shape = "AABB";
                collider.solid = true;
                collider.aabb = res.assets.ammunitionBox.aabb;
            }
            if (!ToolDef.isOn(e)) {
                const tool = em.addComponent(e.id, ToolDef);
                tool.type = "ammunition";
            }
            // if (!InteractableDef.isOn(e)) em.addComponent(e.id, InteractableDef);
            if (!SyncDef.isOn(e)) {
                const sync = em.addComponent(e.id, SyncDef);
                sync.fullComponents.push(AmmunitionConstructDef.id);
            }
            em.addComponent(e.id, FinishedDef);
        }
    }, "buildAmmunition");
}
export const LinstockDef = EM.defineComponent("linstock", () => true);
export const LinstockConstructDef = EM.defineComponent("linstockConstruct", (loc) => {
    return {
        location: loc !== null && loc !== void 0 ? loc : vec3.fromValues(0, 0, 0),
    };
});
function serializeLinstockConstruct(c, buf) {
    buf.writeVec3(c.location);
}
function deserializeLinstockConstruct(c, buf) {
    buf.readVec3(c.location);
}
EM.registerSerializerPair(LinstockConstructDef, serializeLinstockConstruct, deserializeLinstockConstruct);
export function registerBuildLinstockSystem(em) {
    em.registerSystem([LinstockConstructDef], [MeDef, AssetsDef], (boxes, res) => {
        for (let e of boxes) {
            if (FinishedDef.isOn(e))
                continue;
            const props = e.linstockConstruct;
            if (!PositionDef.isOn(e))
                em.addComponent(e.id, PositionDef, props.location);
            if (!ColorDef.isOn(e))
                em.addComponent(e.id, ColorDef, [0.0, 0.0, 0.0]);
            if (!PhysicsParentDef.isOn(e))
                em.addComponent(e.id, PhysicsParentDef);
            // TODO(@darzu): allow scaling to be configured on the asset import
            if (!RenderableConstructDef.isOn(e))
                em.addComponent(e.id, RenderableConstructDef, res.assets.linstock.mesh);
            if (!AuthorityDef.isOn(e))
                em.addComponent(e.id, AuthorityDef, res.me.pid);
            if (!LinstockDef.isOn(e))
                em.addComponent(e.id, LinstockDef);
            if (!ColliderDef.isOn(e)) {
                const collider = em.addComponent(e.id, ColliderDef);
                collider.shape = "AABB";
                collider.solid = true;
                collider.aabb = res.assets.linstock.aabb;
            }
            if (!ToolDef.isOn(e)) {
                const tool = em.addComponent(e.id, ToolDef);
                tool.type = "linstock";
            }
            // if (!InteractableDef.isOn(e)) em.addComponent(e.id, InteractableDef);
            if (!SyncDef.isOn(e)) {
                const sync = em.addComponent(e.id, SyncDef);
                sync.fullComponents.push(LinstockConstructDef.id);
            }
            em.addComponent(e.id, FinishedDef);
        }
    }, "buildLinstock");
}
//# sourceMappingURL=cannon%20copy.js.map