import { EM } from "../entity-manager.js";
import { TimeDef } from "../time.js";
import { quat, vec3 } from "../gl-matrix.js";
import { MotionDef } from "../phys_motion.js";
import { FinishedDef } from "../build.js";
import { ColorDef, CUBE_MESH } from "./game.js";
import { MotionSmoothingDef, RenderableDef, TransformDef, } from "../renderer.js";
import { PhysicsStateDef } from "../phys_esc.js";
import { ColliderDef } from "../collider.js";
import { AuthorityDef, MeDef, SyncDef, } from "../net/components.js";
import { getAABBFromMesh, scaleMesh3 } from "../mesh-pool.js";
export const BoatDef = EM.defineComponent("boat", () => {
    return {
        speed: 0,
        wheelSpeed: 0,
        wheelDir: 0,
    };
});
function stepBoats(boats, { time, me }) {
    for (let o of boats) {
        if (o.authority.pid !== me.pid)
            continue;
        const rad = o.boat.wheelSpeed * time.dt;
        o.boat.wheelDir += rad;
        // rotate
        quat.rotateY(o.motion.rotation, o.motion.rotation, rad);
        // rotate velocity
        vec3.rotateY(o.motion.linearVelocity, [o.boat.speed, 0, 0], [0, 0, 0], o.boat.wheelDir);
    }
}
export function registerStepBoats(em) {
    EM.registerSystem([BoatDef, MotionDef, AuthorityDef], [TimeDef, MeDef], stepBoats);
}
export const BoatConstructDef = EM.defineComponent("boatConstruct", (loc, speed, wheelSpeed, wheelDir) => {
    return {
        location: loc !== null && loc !== void 0 ? loc : vec3.fromValues(0, 0, 0),
        speed: speed !== null && speed !== void 0 ? speed : 0.01,
        wheelSpeed: wheelSpeed !== null && wheelSpeed !== void 0 ? wheelSpeed : 0.0,
        wheelDir: wheelDir !== null && wheelDir !== void 0 ? wheelDir : 0.0,
    };
});
function serializeBoatConstruct(c, buf) {
    buf.writeVec3(c.location);
    buf.writeFloat32(c.speed);
    buf.writeFloat32(c.wheelSpeed);
    buf.writeFloat32(c.wheelDir);
}
function deserializeBoatConstruct(c, buf) {
    buf.readVec3(c.location);
    c.speed = buf.readFloat32();
    c.wheelSpeed = buf.readFloat32();
    c.wheelDir = buf.readFloat32();
}
EM.registerSerializerPair(BoatConstructDef, serializeBoatConstruct, deserializeBoatConstruct);
// TODO(@darzu): move these to the asset system
let _boatMesh = undefined;
let _boatAABB = undefined;
function getBoatMesh() {
    if (!_boatMesh)
        _boatMesh = scaleMesh3(CUBE_MESH, [5, 0.3, 2.5]);
    return _boatMesh;
}
function getBoatAABB() {
    if (!_boatAABB)
        _boatAABB = getAABBFromMesh(getBoatMesh());
    return _boatAABB;
}
function createBoat(em, e, pid) {
    if (FinishedDef.isOn(e))
        return;
    const props = e.boatConstruct;
    if (!MotionDef.isOn(e))
        em.addComponent(e.id, MotionDef, props.location);
    if (!ColorDef.isOn(e))
        em.addComponent(e.id, ColorDef, [0.2, 0.1, 0.05]);
    if (!TransformDef.isOn(e))
        em.addComponent(e.id, TransformDef);
    if (!MotionSmoothingDef.isOn(e))
        em.addComponent(e.id, MotionSmoothingDef);
    if (!RenderableDef.isOn(e))
        em.addComponent(e.id, RenderableDef, getBoatMesh());
    if (!PhysicsStateDef.isOn(e))
        em.addComponent(e.id, PhysicsStateDef);
    if (!AuthorityDef.isOn(e)) {
        // TODO(@darzu): debug why boats have jerky movement
        console.log(`claiming authority of boat ${e.id}`);
        em.addComponent(e.id, AuthorityDef, pid, pid);
    }
    if (!BoatDef.isOn(e)) {
        const boat = em.addComponent(e.id, BoatDef);
        boat.speed = props.speed;
        boat.wheelDir = props.wheelDir;
        boat.wheelSpeed = props.wheelSpeed;
    }
    if (!ColliderDef.isOn(e)) {
        const collider = em.addComponent(e.id, ColliderDef);
        collider.shape = "AABB";
        collider.solid = true;
        collider.aabb = getBoatAABB();
    }
    if (!SyncDef.isOn(e)) {
        const sync = em.addComponent(e.id, SyncDef);
        sync.fullComponents.push(BoatConstructDef.id);
        sync.dynamicComponents.push(MotionDef.id);
    }
    em.addComponent(e.id, FinishedDef);
}
export function registerCreateBoats(em) {
    em.registerSystem([BoatConstructDef], [MeDef], (boats, res) => {
        for (let b of boats)
            createBoat(em, b, res.me.pid);
    });
}
//# sourceMappingURL=boat%20copy.js.map