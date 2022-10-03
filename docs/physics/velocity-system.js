import { ColliderDef } from "./collider.js";
import { quat, vec3 } from "../gl-matrix.js";
import { clamp } from "../math.js";
import { AngularVelocityDef, LinearVelocityDef, } from "./motion.js";
import { PhysicsBroadCollidersDef, PhysicsResultsDef, } from "./nonintersection.js";
import { tempVec3 } from "../temp-pool.js";
import { TimeDef } from "../time.js";
import { PhysicsParentDef, PositionDef, RotationDef, } from "./transform.js";
let linVelDelta = vec3.create();
let normalizedVelocity = vec3.create();
let deltaRotation = quat.create();
// TODO(@darzu): implement checkAtRest (deleted in this commit)
export function registerPhysicsClampVelocityByContact(em) {
    em.registerSystem(null, [PhysicsResultsDef, PhysicsBroadCollidersDef], (objs, res) => {
        const lastContactData = res.physicsResults.contactData;
        // check for collision constraints
        // TODO(@darzu): this is a velocity constraint and ideally should be nicely extracted
        for (let [_, data] of lastContactData) {
            const ac = res._physBColliders.colliders[data.aCId];
            const bc = res._physBColliders.colliders[data.bCId];
            const a = em.findEntity(ac.oId, [ColliderDef]);
            const b = em.findEntity(bc.oId, [ColliderDef]);
            // both objects must still exist and have colliders
            if (!a || !b)
                continue;
            // both objects must be solid
            if (!a.collider.solid || !b.collider.solid)
                continue;
            const aParentId = PhysicsParentDef.isOn(a) ? a.physicsParent.id : 0;
            const bParentId = PhysicsParentDef.isOn(b) ? b.physicsParent.id : 0;
            // maybe clamp "b"
            if (LinearVelocityDef.isOn(b) && bParentId === data.parentOId) {
                let bToAInBParent = data.bToANorm;
                const bInDirOfA = vec3.dot(b.linearVelocity, bToAInBParent);
                if (bInDirOfA > 0) {
                    vec3.sub(b.linearVelocity, b.linearVelocity, vec3.scale(tempVec3(), bToAInBParent, bInDirOfA));
                }
            }
            // maybe clamp "a"
            if (LinearVelocityDef.isOn(a) && aParentId === data.parentOId) {
                let bToAInAParent = data.bToANorm;
                const aInDirOfB = -vec3.dot(a.linearVelocity, bToAInAParent);
                if (aInDirOfB > 0) {
                    vec3.sub(a.linearVelocity, a.linearVelocity, vec3.scale(tempVec3(), bToAInAParent, -aInDirOfB));
                }
            }
        }
    }, "clampVelocityByContact");
}
export function registerPhysicsClampVelocityBySize(em) {
    em.registerSystem([LinearVelocityDef, ColliderDef], [TimeDef], (objs, res) => {
        for (let o of objs) {
            if (o.collider.shape === "AABB") {
                const aabb = o.collider.aabb;
                const vxMax = (aabb.max[0] - aabb.min[0]) / res.time.dt;
                const vyMax = (aabb.max[1] - aabb.min[1]) / res.time.dt;
                const vzMax = (aabb.max[2] - aabb.min[2]) / res.time.dt;
                o.linearVelocity[0] = clamp(o.linearVelocity[0], -vxMax, vxMax);
                o.linearVelocity[1] = clamp(o.linearVelocity[1], -vyMax, vyMax);
                o.linearVelocity[2] = clamp(o.linearVelocity[2], -vzMax, vzMax);
            }
        }
    }, "registerPhysicsClampVelocityBySize");
}
export function registerPhysicsApplyLinearVelocity(em) {
    em.registerSystem([LinearVelocityDef, PositionDef], [TimeDef], (objs, res) => {
        for (let o of objs) {
            // translate position and AABB according to linear velocity
            linVelDelta = vec3.scale(linVelDelta, o.linearVelocity, res.time.dt);
            vec3.add(o.position, o.position, linVelDelta);
        }
    }, "registerPhysicsApplyLinearVelocity");
}
export function registerPhysicsApplyAngularVelocity(em) {
    em.registerSystem([AngularVelocityDef, RotationDef], [TimeDef], (objs, res) => {
        for (let o of objs) {
            // change rotation according to angular velocity
            vec3.normalize(normalizedVelocity, o.angularVelocity);
            let angle = vec3.length(o.angularVelocity) * res.time.dt;
            deltaRotation = quat.setAxisAngle(deltaRotation, normalizedVelocity, angle);
            quat.normalize(deltaRotation, deltaRotation);
            // note--quat multiplication is not commutative, need to multiply on the left
            quat.multiply(o.rotation, deltaRotation, o.rotation);
        }
    }, "physicsApplyAngularVelocity");
}
