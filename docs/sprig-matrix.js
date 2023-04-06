import * as GLM from "./gl-matrix.js";
let eg_vec3f = [0, 0, 0];
let eg_vec3r = [0, 0, 0];
let eg_vec3 = vec3.create();
function float32ArrayOfLength(n) {
    return new Float32Array(n);
}
const BUFFER_SIZE = 40000;
const buffer = new ArrayBuffer(BUFFER_SIZE);
let bufferIndex = 0;
function tmpArray(n) {
    if (bufferIndex + n * Float32Array.BYTES_PER_ELEMENT > BUFFER_SIZE) {
        throw `Too many temp Float32Arrays allocated--try increasing BUFFER_SIZE`;
    }
    const arr = new Float32Array(buffer, bufferIndex, n);
    bufferIndex += arr.byteLength;
    return arr;
}
export function resetTempMatrixBuffer() {
    bufferIndex = 0;
}
export var vec2;
(function (vec2) {
    const GL = GLM.vec2;
    function tmp() {
        return tmpArray(2);
    }
    function create() {
        return float32ArrayOfLength(2);
    }
    vec2.create = create;
    function clone(v) {
        return GL.clone(v);
    }
    vec2.clone = clone;
    function copy(out, v1) {
        return GL.copy(out, v1);
    }
    vec2.copy = copy;
    function set(n0, n1, out) {
        out = out !== null && out !== void 0 ? out : tmp();
        out[0] = n0;
        out[1] = n1;
        return out;
    }
    vec2.set = set;
    function fromValues(n0, n1) {
        return set(n0, n1, create());
    }
    vec2.fromValues = fromValues;
    vec2.ZEROS = fromValues(0, 0);
    function equals(v1, v2) {
        return GL.equals(v1, v2);
    }
    vec2.equals = equals;
    function exactEquals(v1, v2) {
        return GL.exactEquals(v1, v2);
    }
    vec2.exactEquals = exactEquals;
    function add(v1, v2, out) {
        return GL.add(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec2.add = add;
    function sub(v1, v2, out) {
        return GL.sub(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec2.sub = sub;
    function mul(v1, v2, out) {
        return GL.mul(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec2.mul = mul;
    function div(v1, v2, out) {
        return GL.div(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec2.div = div;
    function normalize(v1, out) {
        return GL.normalize(out !== null && out !== void 0 ? out : tmp(), v1);
    }
    vec2.normalize = normalize;
    function length(v1) {
        return GL.length(v1);
    }
    vec2.length = length;
    function dot(v1, v2) {
        return GL.dot(v1, v2);
    }
    vec2.dot = dot;
    function cross(v1, v2, out) {
        return GL.cross(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec2.cross = cross;
    function scale(v1, n, out) {
        return GL.scale(out !== null && out !== void 0 ? out : tmp(), v1, n);
    }
    vec2.scale = scale;
    function negate(v1, out) {
        return GL.negate(out !== null && out !== void 0 ? out : tmp(), v1);
    }
    vec2.negate = negate;
    function dist(v1, v2) {
        return GL.dist(v1, v2);
    }
    vec2.dist = dist;
    function sqrDist(v1, v2) {
        return GL.dist(v1, v2);
    }
    vec2.sqrDist = sqrDist;
    function rotate(v1, v2, rad, out) {
        return GL.rotate(out !== null && out !== void 0 ? out : tmp(), v1, v2, rad);
    }
    vec2.rotate = rotate;
})(vec2 || (vec2 = {}));
export var vec3;
(function (vec3) {
    const GL = GLM.vec3;
    function tmp() {
        return tmpArray(3);
    }
    vec3.tmp = tmp;
    function create() {
        return float32ArrayOfLength(3);
    }
    vec3.create = create;
    function clone(v) {
        return GL.clone(v);
    }
    vec3.clone = clone;
    function copy(out, v1) {
        return GL.copy(out, v1);
    }
    vec3.copy = copy;
    function set(n0, n1, n2, out) {
        out = out !== null && out !== void 0 ? out : tmp();
        out[0] = n0;
        out[1] = n1;
        out[2] = n2;
        return out;
    }
    vec3.set = set;
    function fromValues(n0, n1, n2) {
        return set(n0, n1, n2, create());
    }
    vec3.fromValues = fromValues;
    vec3.ZEROS = fromValues(0, 0, 0);
    vec3.ONES = fromValues(1, 1, 1);
    function equals(v1, v2) {
        return GL.equals(v1, v2);
    }
    vec3.equals = equals;
    function exactEquals(v1, v2) {
        return GL.exactEquals(v1, v2);
    }
    vec3.exactEquals = exactEquals;
    function add(v1, v2, out) {
        return GL.add(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec3.add = add;
    function sub(v1, v2, out) {
        return GL.sub(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec3.sub = sub;
    function mul(v1, v2, out) {
        return GL.mul(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec3.mul = mul;
    function div(v1, v2, out) {
        return GL.div(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec3.div = div;
    function normalize(v1, out) {
        return GL.normalize(out !== null && out !== void 0 ? out : tmp(), v1);
    }
    vec3.normalize = normalize;
    function length(v1) {
        return GL.length(v1);
    }
    vec3.length = length;
    function dot(v1, v2) {
        return GL.dot(v1, v2);
    }
    vec3.dot = dot;
    function cross(v1, v2, out) {
        return GL.cross(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec3.cross = cross;
    function scale(v1, n, out) {
        return GL.scale(out !== null && out !== void 0 ? out : tmp(), v1, n);
    }
    vec3.scale = scale;
    function negate(v1, out) {
        return GL.negate(out !== null && out !== void 0 ? out : tmp(), v1);
    }
    vec3.negate = negate;
    function dist(v1, v2) {
        return GL.dist(v1, v2);
    }
    vec3.dist = dist;
    function sqrDist(v1, v2) {
        return GL.dist(v1, v2);
    }
    vec3.sqrDist = sqrDist;
    function lerp(v1, v2, n, out) {
        return GL.lerp(out !== null && out !== void 0 ? out : tmp(), v1, v2, n);
    }
    vec3.lerp = lerp;
    function transformQuat(v1, v2, out) {
        return GL.transformQuat(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec3.transformQuat = transformQuat;
    function transformMat4(v1, v2, out) {
        return GL.transformMat4(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec3.transformMat4 = transformMat4;
    function zero(out) {
        return GL.zero(out !== null && out !== void 0 ? out : tmp());
    }
    vec3.zero = zero;
})(vec3 || (vec3 = {}));
export var vec4;
(function (vec4) {
    const GL = GLM.vec4;
    function tmp() {
        return tmpArray(4);
    }
    vec4.tmp = tmp;
    function create() {
        return float32ArrayOfLength(4);
    }
    vec4.create = create;
    function clone(v) {
        return GL.clone(v);
    }
    vec4.clone = clone;
    function copy(out, v1) {
        return GL.copy(out, v1);
    }
    vec4.copy = copy;
    function set(n0, n1, n2, n3, out) {
        out = out !== null && out !== void 0 ? out : tmp();
        out[0] = n0;
        out[1] = n1;
        out[2] = n2;
        out[3] = n3;
        return out;
    }
    vec4.set = set;
    function fromValues(n0, n1, n2, n3) {
        return set(n0, n1, n2, n3, create());
    }
    vec4.fromValues = fromValues;
    vec4.ZEROS = fromValues(0, 0, 0, 0);
    vec4.ONES = fromValues(1, 1, 1, 0);
    function equals(v1, v2) {
        return GL.equals(v1, v2);
    }
    vec4.equals = equals;
    function exactEquals(v1, v2) {
        return GL.exactEquals(v1, v2);
    }
    vec4.exactEquals = exactEquals;
    function add(v1, v2, out) {
        return GL.add(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec4.add = add;
    function sub(v1, v2, out) {
        return GL.sub(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec4.sub = sub;
    function mul(v1, v2, out) {
        return GL.mul(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec4.mul = mul;
    function div(v1, v2, out) {
        return GL.div(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec4.div = div;
    function normalize(v1, out) {
        return GL.normalize(out !== null && out !== void 0 ? out : tmp(), v1);
    }
    vec4.normalize = normalize;
    function length(v1) {
        return GL.length(v1);
    }
    vec4.length = length;
    function dot(v1, v2) {
        return GL.dot(v1, v2);
    }
    vec4.dot = dot;
    function scale(v1, n, out) {
        return GL.scale(out !== null && out !== void 0 ? out : tmp(), v1, n);
    }
    vec4.scale = scale;
    function negate(v1, out) {
        return GL.negate(out !== null && out !== void 0 ? out : tmp(), v1);
    }
    vec4.negate = negate;
    function dist(v1, v2) {
        return GL.dist(v1, v2);
    }
    vec4.dist = dist;
    function sqrDist(v1, v2) {
        return GL.dist(v1, v2);
    }
    vec4.sqrDist = sqrDist;
    function lerp(v1, v2, n, out) {
        return GL.lerp(out !== null && out !== void 0 ? out : tmp(), v1, v2, n);
    }
    vec4.lerp = lerp;
    function transformQuat(v1, v2, out) {
        return GL.transformQuat(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec4.transformQuat = transformQuat;
    function transformMat4(v1, v2, out) {
        return GL.transformMat4(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    vec4.transformMat4 = transformMat4;
    function zero(out) {
        return GL.zero(out !== null && out !== void 0 ? out : tmp());
    }
    vec4.zero = zero;
})(vec4 || (vec4 = {}));
export var quat;
(function (quat) {
    const GL = GLM.quat;
    function tmp() {
        return tmpArray(4);
    }
    quat.tmp = tmp;
    function create() {
        return float32ArrayOfLength(4);
    }
    quat.create = create;
    function clone(v) {
        return GL.clone(v);
    }
    quat.clone = clone;
    function copy(out, v1) {
        return GL.copy(out, v1);
    }
    quat.copy = copy;
    quat.IDENTITY = identity(create());
    function equals(v1, v2) {
        return GL.equals(v1, v2);
    }
    quat.equals = equals;
    function exactEquals(v1, v2) {
        return GL.exactEquals(v1, v2);
    }
    quat.exactEquals = exactEquals;
    function add(v1, v2, out) {
        return GL.add(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    quat.add = add;
    function mul(v1, v2, out) {
        return GL.mul(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    quat.mul = mul;
    function slerp(v1, v2, n, out) {
        return GL.slerp(out !== null && out !== void 0 ? out : tmp(), v1, v2, n);
    }
    quat.slerp = slerp;
    function normalize(v1, out) {
        return GL.normalize(out !== null && out !== void 0 ? out : tmp(), v1);
    }
    quat.normalize = normalize;
    function identity(out) {
        return GL.identity(out !== null && out !== void 0 ? out : tmp());
    }
    quat.identity = identity;
    function conjugate(v1, out) {
        return GL.conjugate(out !== null && out !== void 0 ? out : tmp(), v1);
    }
    quat.conjugate = conjugate;
    function invert(v1, out) {
        return GL.invert(out !== null && out !== void 0 ? out : tmp(), v1);
    }
    quat.invert = invert;
    function setAxisAngle(axis, rad, out) {
        return GL.setAxisAngle(out !== null && out !== void 0 ? out : tmp(), axis, rad);
    }
    quat.setAxisAngle = setAxisAngle;
    function getAxisAngle(q, out) {
        return GL.getAxisAngle(out !== null && out !== void 0 ? out : tmp(), q);
    }
    quat.getAxisAngle = getAxisAngle;
    function getAngle(q1, q2) {
        return GL.getAngle(q1, q2);
    }
    quat.getAngle = getAngle;
    function rotateX(v1, n, out) {
        return GL.rotateX(out !== null && out !== void 0 ? out : tmp(), v1, n);
    }
    quat.rotateX = rotateX;
    function rotateY(v1, n, out) {
        return GL.rotateY(out !== null && out !== void 0 ? out : tmp(), v1, n);
    }
    quat.rotateY = rotateY;
    function rotateZ(v1, n, out) {
        return GL.rotateZ(out !== null && out !== void 0 ? out : tmp(), v1, n);
    }
    quat.rotateZ = rotateZ;
    function fromEuler(x, y, z, out) {
        return GL.fromEuler(out !== null && out !== void 0 ? out : tmp(), x, y, z);
    }
    quat.fromEuler = fromEuler;
})(quat || (quat = {}));
export var mat4;
(function (mat4) {
    const GL = GLM.mat4;
    function tmp() {
        return tmpArray(16);
    }
    mat4.tmp = tmp;
    function create() {
        return float32ArrayOfLength(16);
    }
    mat4.create = create;
    function clone(v) {
        return GL.clone(v);
    }
    mat4.clone = clone;
    function copy(out, v1) {
        return GL.copy(out, v1);
    }
    mat4.copy = copy;
    mat4.IDENTITY = identity(create());
    function equals(v1, v2) {
        return GL.equals(v1, v2);
    }
    mat4.equals = equals;
    function exactEquals(v1, v2) {
        return GL.exactEquals(v1, v2);
    }
    mat4.exactEquals = exactEquals;
    function add(v1, v2, out) {
        return GL.add(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    mat4.add = add;
    function mul(v1, v2, out) {
        return GL.mul(out !== null && out !== void 0 ? out : tmp(), v1, v2);
    }
    mat4.mul = mul;
    function identity(out) {
        return GL.identity(out !== null && out !== void 0 ? out : tmp());
    }
    mat4.identity = identity;
    function invert(v1, out) {
        return GL.invert(out !== null && out !== void 0 ? out : tmp(), v1);
    }
    mat4.invert = invert;
    function fromRotationTranslation(q, v, out) {
        return GL.fromRotationTranslation(out !== null && out !== void 0 ? out : tmp(), q, v);
    }
    mat4.fromRotationTranslation = fromRotationTranslation;
    function fromRotationTranslationScale(q, v, s, out) {
        return GL.fromRotationTranslationScale(out !== null && out !== void 0 ? out : tmp(), q, v, s);
    }
    mat4.fromRotationTranslationScale = fromRotationTranslationScale;
    function fromRotationTranslationScaleOrigin(q, v, s, o, out) {
        return GL.fromRotationTranslationScaleOrigin(out !== null && out !== void 0 ? out : tmp(), q, v, s, o);
    }
    mat4.fromRotationTranslationScaleOrigin = fromRotationTranslationScaleOrigin;
    function fromScaling(v, out) {
        return GL.fromScaling(out !== null && out !== void 0 ? out : tmp(), v);
    }
    mat4.fromScaling = fromScaling;
    function fromXRotation(rad, out) {
        return GL.fromXRotation(out !== null && out !== void 0 ? out : tmp(), rad);
    }
    mat4.fromXRotation = fromXRotation;
    function fromYRotation(rad, out) {
        return GL.fromYRotation(out !== null && out !== void 0 ? out : tmp(), rad);
    }
    mat4.fromYRotation = fromYRotation;
    function fromZRotation(rad, out) {
        return GL.fromZRotation(out !== null && out !== void 0 ? out : tmp(), rad);
    }
    mat4.fromZRotation = fromZRotation;
    function fromQuat(q, out) {
        return GL.fromQuat(out !== null && out !== void 0 ? out : tmp(), q);
    }
    mat4.fromQuat = fromQuat;
    function getRotation(m, out) {
        return GL.getRotation(out !== null && out !== void 0 ? out : quat.tmp(), m);
    }
    mat4.getRotation = getRotation;
    function getTranslation(m, out) {
        return GL.getTranslation(out !== null && out !== void 0 ? out : vec3.tmp(), m);
    }
    mat4.getTranslation = getTranslation;
    function getScaling(m, out) {
        return GL.getScaling(out !== null && out !== void 0 ? out : vec3.tmp(), m);
    }
    mat4.getScaling = getScaling;
    function rotateX(v1, n, out) {
        return GL.rotateX(out !== null && out !== void 0 ? out : tmp(), v1, n);
    }
    mat4.rotateX = rotateX;
    function rotateY(v1, n, out) {
        return GL.rotateY(out !== null && out !== void 0 ? out : tmp(), v1, n);
    }
    mat4.rotateY = rotateY;
    function rotateZ(v1, n, out) {
        return GL.rotateZ(out !== null && out !== void 0 ? out : tmp(), v1, n);
    }
    mat4.rotateZ = rotateZ;
    function ortho(left, right, bottom, top, near, far, out) {
        return GL.ortho(out !== null && out !== void 0 ? out : tmp(), left, right, bottom, top, near, far);
    }
    mat4.ortho = ortho;
    function perspective(fovy, aspect, near, far, out) {
        return GL.perspective(out !== null && out !== void 0 ? out : tmp(), fovy, aspect, near, far);
    }
    mat4.perspective = perspective;
    function lookAt(v1, v2, v3, out) {
        return GL.lookAt(out !== null && out !== void 0 ? out : tmp(), v1, v2, v3);
    }
    mat4.lookAt = lookAt;
    function translate(m, v, out) {
        return GL.translate(out !== null && out !== void 0 ? out : tmp(), m, v);
    }
    mat4.translate = translate;
})(mat4 || (mat4 = {}));
//# sourceMappingURL=sprig-matrix.js.map