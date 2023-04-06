import { FinishedDef } from "../build.js";
import { EM } from "../entity-manager.js";
import { vec3, quat } from "../gl-matrix.js";
import { MeDef, AuthorityDef, SyncDef } from "../net/components.js";
import { ColliderDef } from "../physics/collider.js";
import { PositionDef, RotationDef, PhysicsParentDef, } from "../physics/transform.js";
import { RenderableConstructDef } from "../render/renderer.js";
import { AssetsDef } from "./assets.js";
import { ColorDef } from "./game.js";
import { ToolDef } from "./tool.js";
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
//# sourceMappingURL=ammo.js.map