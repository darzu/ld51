import { quat, vec3 } from "./gl-matrix.js";
import { tempQuat } from "./temp-pool.js";
const ERROR_SMOOTHING_FACTOR = 0.9 ** (60 / 1000);
const EPSILON = 0.0001;
const QUAT_EPSILON = 0.001;
const identityQuat = quat.identity(quat.create());
function isVec3(v) {
    return v.length === 3;
}
export function reduceError(v, dt, smoothing_factor = ERROR_SMOOTHING_FACTOR) {
    if (isVec3(v)) {
        const magnitude = vec3.length(v);
        if (magnitude > EPSILON) {
            vec3.scale(v, v, smoothing_factor ** dt);
        }
        else if (magnitude > 0) {
            vec3.set(v, 0, 0, 0);
        }
    }
    else {
        const magnitude = Math.abs(quat.getAngle(v, identityQuat));
        if (magnitude > QUAT_EPSILON) {
            quat.slerp(v, v, identityQuat, 1 - smoothing_factor ** dt);
            quat.normalize(v, v);
        }
        else if (magnitude > 0) {
            quat.copy(v, identityQuat);
        }
    }
}
export function computeNewError(old, curr, error) {
    if (isVec3(old)) {
        vec3.add(error, error, old);
        vec3.sub(error, error, curr);
    }
    else {
        const prevComputed = quat.mul(tempQuat(), old, error);
        quat.invert(error, curr);
        quat.mul(prevComputed, error, prevComputed);
        quat.copy(error, prevComputed);
        quat.normalize(error, error);
    }
}
