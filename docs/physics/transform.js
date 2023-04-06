import { EM } from "../entity-manager.js";
import { mat4, quat, vec3, } from "../gl-matrix.js";
import { WorldFrameDef } from "./nonintersection.js";
export const IDENTITY_FRAME = {
    transform: mat4.IDENTITY,
    position: vec3.ZEROS,
    rotation: quat.IDENTITY,
    scale: vec3.ONES,
};
export function updateFrameFromTransform(f) {
    f.position = mat4.getTranslation(f.position, f.transform);
    f.rotation = mat4.getRotation(f.rotation, f.transform);
    f.scale = mat4.getScaling(f.scale, f.transform);
}
export function updateFrameFromPosRotScale(f) {
    f.transform = mat4.fromRotationTranslationScale(f.transform, f.rotation, f.position, f.scale);
}
export function copyFrame(out, frame) {
    vec3.copy(out.position, frame.position);
    vec3.copy(out.scale, frame.scale);
    quat.copy(out.rotation, frame.rotation);
    mat4.copy(out.transform, frame.transform);
}
export function identityFrame(out) {
    vec3.zero(out.position);
    vec3.copy(out.scale, vec3.ONES);
    quat.identity(out.rotation);
    mat4.identity(out.transform);
}
// TRANSFORM
export const TransformDef = EM.defineComponent("transform", (t) => {
    return t ?? mat4.create();
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
// LOCAL FRAME HELPER
export const LocalFrameDefs = [
    PositionDef,
    RotationDef,
    ScaleDef,
    TransformDef,
];
// PARENT
export const PhysicsParentDef = EM.defineComponent("physicsParent", (p) => {
    return { id: p || 0 };
});
EM.registerSerializerPair(PhysicsParentDef, (o, buf) => buf.writeUint32(o.id), (o, buf) => (o.id = buf.readUint32()));
const _transformables = new Map();
const _hasTransformed = new Set();
function updateWorldFromLocalAndParent(o) {
    if (_hasTransformed.has(o.id))
        return;
    // logOnce(`first updateWorldFromLocalAndParent for ${o.id}`);
    if (PhysicsParentDef.isOn(o) && _transformables.has(o.physicsParent.id)) {
        const parent = _transformables.get(o.physicsParent.id);
        // update parent first
        if (!_hasTransformed.has(o.physicsParent.id)) {
            updateWorldFromLocalAndParent(parent);
        }
        // update relative to parent
        mat4.mul(o.world.transform, parent.world.transform, o.transform);
        updateFrameFromTransform(o.world);
    }
    else {
        // no parent
        copyFrame(o.world, o);
    }
    _hasTransformed.add(o.id);
}
export function registerInitTransforms(em) {
    // TODO(@darzu): WorldFrame should be optional, only needed
    //  for parented objs (which is maybe the uncommon case).
    em.registerSystem([...LocalFrameDefs], [], (objs) => {
        for (let o of objs) {
            if (!WorldFrameDef.isOn(o)) {
                em.ensureComponentOn(o, WorldFrameDef);
                copyFrame(o.world, o);
            }
        }
    }, "ensureWorldFrame");
}
export function registerUpdateLocalFromPosRotScale(em, suffix = "") {
    em.registerSystem(null, [], (objs) => {
        // TODO(@darzu): PERF. Hacky custom query! Not cached n stuff.
        for (let o of em.entities.values()) {
            if (!o.id)
                continue;
            // TODO(@darzu): do we really want these on every entity?
            if (PositionDef.isOn(o) ||
                RotationDef.isOn(o) ||
                ScaleDef.isOn(o) ||
                TransformDef.isOn(o)) {
                em.ensureComponentOn(o, PositionDef);
                em.ensureComponentOn(o, RotationDef);
                em.ensureComponentOn(o, ScaleDef);
                em.ensureComponentOn(o, TransformDef);
            }
        }
    }, "ensureFillOutLocalFrame");
    // calculate the world transform
    em.registerSystem([...LocalFrameDefs], [], (objs) => {
        for (let o of objs)
            updateFrameFromPosRotScale(o);
    }, "updateLocalFromPosRotScale" + suffix);
}
export function registerUpdateWorldFromLocalAndParent(em, suffix = "") {
    // calculate the world transform
    em.registerSystem([WorldFrameDef, ...LocalFrameDefs], [], (objs) => {
        _transformables.clear();
        _hasTransformed.clear();
        for (let o of objs) {
            _transformables.set(o.id, o);
        }
        for (let o of objs) {
            updateWorldFromLocalAndParent(o);
        }
    }, "updateWorldFromLocalAndParent" + suffix);
}
//# sourceMappingURL=transform.js.map