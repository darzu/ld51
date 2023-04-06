import { EM } from "./entity-manager.js";
import { mat4, quat, vec3 } from "./gl-matrix.js";
import { tempVec, tempQuat } from "./temp-pool.js";
// TODO(@darzu): implement local transform instead of Motion's position & rotation?
//  one problem is that the order in which you interleave rotation/translations matters if it
//  is all in one matrix
// transforms we might care about:
//  on mesh load, one time transform it
//  object placement in "local" space (what motion did)
//  final object placement in "global" space for the renderer
//  final object placement in "global" space for physics
// const TransformLocalDef = EM.defineComponent("transformLocal", () => {
//   return mat4.create();
// });
// type TransformLocal = mat4;
// WORLD TRANSFORM
export const WorldTransformDef = EM.defineComponent("worldTransform", (t) => {
    return t !== null && t !== void 0 ? t : mat4.create();
});
// POSITION
export const PositionDef = EM.defineComponent("position", (p) => p || vec3.fromValues(0, 0, 0));
EM.registerSerializerPair(PositionDef, (o, buf) => buf.writeVec3(o), (o, buf) => buf.readVec3(o));
// ROTATION
export const RotationDef = EM.defineComponent("rotation", (r) => r || quat.create());
EM.registerSerializerPair(RotationDef, (o, buf) => buf.writeQuat(o), (o, buf) => buf.readQuat(o));
// SCALE
export const ScaleDef = EM.defineComponent("scale", (by) => by || vec3.fromValues(1, 1, 1));
EM.registerSerializerPair(ScaleDef, (o, buf) => buf.writeVec3(o), (o, buf) => buf.readVec3(o));
// PARENT
export const PhysicsParentDef = EM.defineComponent("physicsParent", (p) => {
    return { id: p || 0 };
});
// PARENT TRANSFORM
export const ParentTransformDef = EM.defineComponent("parentTransform", () => {
    return mat4.create();
});
const _transformables = new Map();
const _hasTransformed = new Set();
function updateWorldTransform(o) {
    if (_hasTransformed.has(o.id))
        return;
    // first, update from motion (optionally)
    if (PositionDef.isOn(o)) {
        mat4.fromRotationTranslationScale(o.worldTransform, RotationDef.isOn(o) ? o.rotation : quat.identity(tempQuat()), o.position, ScaleDef.isOn(o) ? o.scale : vec3.set(tempVec(), 1, 1, 1));
    }
    if (PhysicsParentDef.isOn(o) && o.physicsParent.id > 0 && ParentTransformDef.isOn(o)) {
        const parent = _transformables.get(o.physicsParent.id);
        if (!parent)
            throw `physicsParent ${o.physicsParent.id} doesn't have a worldTransform!`;
        // update relative to parent
        if (!_hasTransformed.has(o.physicsParent.id)) {
            updateWorldTransform(parent);
            o.parentTransform = parent.worldTransform;
        }
        mat4.mul(o.worldTransform, parent.worldTransform, o.worldTransform);
    }
    _hasTransformed.add(o.id);
}
export function registerInitTransforms(em) {
    // ensure we have a world transform if we're using the physics system
    // TODO(@darzu): have some sort of "usePhysics" marker component instead of pos?
    em.registerSystem([PositionDef], [], (objs) => {
        for (let o of objs)
            em.ensureComponent(o.id, WorldTransformDef);
    }, "ensureWorldTransform");
    // ensure we have a parent world transform if we have a physics parent
    em.registerSystem([PhysicsParentDef], [], (objs) => {
        for (let o of objs)
            em.ensureComponent(o.id, ParentTransformDef);
    }, "ensureParentTransform");
}
export function registerUpdateTransforms(em, suffix) {
    // calculate the world transform
    em.registerSystem([
        WorldTransformDef,
        // TODO(@darzu): USE transformLocal
        // TransformLocalDef,
    ], [], (objs) => {
        _transformables.clear();
        _hasTransformed.clear();
        for (let o of objs) {
            _transformables.set(o.id, o);
        }
        for (let o of objs) {
            updateWorldTransform(o);
        }
    }, "updateWorldTransforms" + suffix);
}
//# sourceMappingURL=transform.js.map