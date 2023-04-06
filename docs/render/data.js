// cytochrome's data helpers
import { mat4, quat, vec2, vec3 } from "../gl-matrix.js";
import { align, max, sum } from "../math.js";
import { assert } from "../test.js";
import { objMap } from "../util.js";
const WGSLScalars = ["bool", "i32", "u32", "f32", "f16"];
const WGSLMats = [
    "mat2x2<f32>",
    "mat3x3<f32>",
    "mat4x4<f32>",
    "mat2x3<f32>",
    "mat2x4<f32>",
    "mat3x4<f32>",
    "mat3x2<f32>",
    "mat4x2<f32>",
    "mat4x4<f32>",
];
export const texTypeToBytes = {
    rgba32float: 4 * 4,
    // TODO(@darzu): is this size right?
    rgba8unorm: 4,
    "depth24plus-stencil8": 3 + 1,
    depth32float: 4,
};
export const texTypeIsDepthNoStencil = {
    depth16unorm: true,
    depth24plus: true,
    depth32float: true,
};
export const texTypeIsDepthAndStencil = {
    "depth24plus-stencil8": true,
    "depth24unorm-stencil8": true,
    "depth32float-stencil8": true,
};
export const texTypeIsStencil = {
    stencil8: true,
    ...texTypeIsDepthAndStencil,
};
export const texTypeIsDepth = {
    ...texTypeIsDepthNoStencil,
    ...texTypeIsDepthAndStencil,
};
export const GPUBufferBindingTypeToWgslVar = {
    uniform: "var<uniform>",
    "read-only-storage": "var<storage, read>",
    storage: "var<storage, read_write>",
};
function wgslTypeToDummyVal(wgsl) {
    return _wgslTypeToDummyVal(wgsl);
    function _wgslTypeToDummyVal(wgsl) {
        if (wgsl === "f32")
            return Math.random() * 100.0;
        if (wgsl === "vec2<f32>")
            return vec2.fromValues(Math.random(), Math.random());
        const randVec3 = () => vec3.fromValues(Math.random(), Math.random(), Math.random());
        if (wgsl === "vec3<f32>")
            return randVec3();
        if (wgsl === "u32")
            return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        const randAngle = () => Math.random() * 2 * Math.PI;
        const randQuat = () => quat.fromEuler(quat.create(), randAngle(), randAngle(), randAngle());
        if (wgsl === "mat4x4<f32>")
            return mat4.fromRotationTranslationScaleOrigin(mat4.create(), randQuat(), randVec3(), randVec3(), randVec3());
        throw `wgslTypeToDummyVal is missing ${wgsl}`;
    }
}
function cloneValue(type, val) {
    return _cloneValue(type, val);
    function _cloneValue(wgsl, val) {
        if (wgsl === "f32")
            return val;
        if (wgsl === "vec2<f32>")
            return vec2.clone(val);
        if (wgsl === "vec3<f32>")
            return vec3.clone(val);
        if (wgsl === "u32")
            return val;
        if (wgsl === "mat4x4<f32>")
            return mat4.clone(val);
        throw `cloneValue is missing ${wgsl}`;
    }
}
function cloneStruct(desc, data) {
    let res = {};
    for (let name of Object.keys(desc)) {
        res[name] = cloneValue(desc[name], data[name]);
    }
    return res;
}
function createDummyStruct(desc) {
    let res = {};
    for (let name of Object.keys(desc)) {
        const type = desc[name];
        const val = wgslTypeToDummyVal(type);
        res[name] = val;
    }
    return res;
}
const wgslTypeToVertType = {
    "vec2<f16>": "float16x2",
    "vec4<f16>": "float16x4",
    f32: "float32",
    "vec2<f32>": "float32x2",
    "vec3<f32>": "float32x3",
    "vec4<f32>": "float32x4",
    u32: "uint32",
    i32: "sint32",
};
// https://www.w3.org/TR/WGSL/#alignment-and-size
const wgslTypeToSize = {
    i32: 4,
    u32: 4,
    f32: 4,
    "vec2<f32>": 8,
    "vec3<f32>": 12,
    "mat4x4<f32>": 64,
};
const alignUp = (n) => {
    // TODO(@darzu): i know there is a smarter way to write this...
    //  ... something something bit shifting
    if (n <= 4)
        return 4;
    if (n <= 8)
        return 8;
    if (n <= 16)
        return 16;
    if (n <= 32)
        return 32;
    if (n <= 64)
        return 64;
    if (n <= 128)
        return 128;
    if (n <= 256)
        return 256;
    throw `${n} too big to align`;
};
// TODO(@darzu): this isn't quite right, a mat3x4<f32> is size 48 but aligns to 16
const wgslTypeToAlign = objMap(wgslTypeToSize, alignUp);
export function createCyStruct(desc, opts) {
    // TODO(@darzu): handle non-aligned for v-bufs
    // TODO(@darzu): emit @group(0) @binding(0) var<uniform> scene : Scene;
    // TODO(@darzu): a lot of this doesn't need the device, all that should move
    //    into cyStruct fn probably
    const sizes = Object.values(desc).map((v) => {
        const s = wgslTypeToSize[v];
        if (!s)
            throw `missing size for ${v}`;
        return s;
    });
    const alignments = sizes.map(alignUp);
    // check for out of size order elements
    sizes.reduce((p, n, i) => {
        if (p < n)
            throw `CyStruct must have members in descending size order.\n${JSON.stringify(desc)} @ ${i}`;
        return n;
    }, Infinity);
    let offsets;
    if (opts === null || opts === void 0 ? void 0 : opts.isCompact) {
        offsets = sizes.reduce((p, n, i) => [...p, p[p.length - 1] + n], [0]);
        offsets.pop();
    }
    else {
        offsets = sizes.reduce((p, n, i) => [...p, align(p[p.length - 1] + n, alignments[i + 1])], [0]);
        offsets.pop();
    }
    assert(offsets && sizes.length === offsets.length, "sizes.length === offsets.length");
    const offsets_32 = offsets.map((o) => o >> 2);
    const structAlign = (opts === null || opts === void 0 ? void 0 : opts.isUniform)
        ? 256
        : (opts === null || opts === void 0 ? void 0 : opts.isCompact)
            ? 4 // https://gpuweb.github.io/gpuweb/#vertex-formats
            : max(alignments);
    const structSize = align(offsets[offsets.length - 1] + sizes[sizes.length - 1], structAlign);
    const names = Object.keys(desc);
    const types = Object.values(desc);
    // TODO(@darzu): support registering a custom serializer for perf reasons
    // TODO(@darzu): emit serialization code
    const scratch_u8 = new Uint8Array(structSize);
    const views = {
        u8: scratch_u8,
        f32: new Float32Array(scratch_u8.buffer),
        u32: new Uint32Array(scratch_u8.buffer),
    };
    function serializeSlow(data) {
        // TODO(@darzu): disable this check for perf
        Object.keys(data).forEach((n, i) => {
            if (n !== names[i])
                throw `data values must be in the same order as the declaring struct.\n${JSON.stringify(desc)}\n"${n}" #${i}`;
        });
        // NOTE >>2 vs /4:
        // using some really janky dev console tests, it looks like there's no difference
        //  between X >> 2 and X / 4 (tried -12.5, 64, and Math.random()). Perf was identical.
        //  b = performance.now(); for (let i = 0; i < 10000000000; i++) -12.5 >> 2; a = performance.now(); a - b
        //  b = performance.now(); for (let i = 0; i < 10000000000; i++) -12.5 / 4; a = performance.now(); a - b
        Object.values(data).forEach((v, i) => {
            const t = types[i];
            const o = offsets[i];
            const o32 = offsets_32[i];
            if (t === "f32")
                views.f32[o32] = v;
            else if (t === "u32")
                views.u32[o32] = v;
            else if (t === "vec2<f32>")
                views.f32.set(v, o32);
            else if (t === "vec3<f32>")
                views.f32.set(v, o32);
            else if (t === "mat4x4<f32>")
                views.f32.set(v, o32);
            else
                throw `Unimplemented type in serializer: ${t}`;
        });
        return scratch_u8;
    }
    // check custom serializer correctness
    // TODO(@darzu): option to disable this
    let serialize = serializeSlow;
    if (opts === null || opts === void 0 ? void 0 : opts.serializer) {
        const dummy = createDummyStruct(desc);
        // run the baseline
        const slowRes = new Uint8Array(structSize);
        scratch_u8.fill(0);
        serializeSlow(dummy);
        slowRes.set(scratch_u8, 0);
        // run the passed in one
        const fastRes = new Uint8Array(structSize);
        scratch_u8.fill(0);
        opts.serializer(dummy, offsets, offsets_32, views);
        fastRes.set(scratch_u8, 0);
        // compare
        for (let i = 0; i < slowRes.length; i++)
            assert(slowRes[i] === fastRes[i], `Custom serializer for ${JSON.stringify(desc)} is probably incorrect at byte ${i}`);
        // use it
        serialize = (d) => {
            opts.serializer(d, offsets, offsets_32, views);
            return scratch_u8;
        };
    }
    const struct = {
        desc,
        memberCount: Object.keys(desc).length,
        size: structSize,
        compactSize: sum(sizes),
        offsets,
        serialize,
        layout,
        wgsl,
        vertexLayout,
        clone,
        opts,
    };
    function clone(orig) {
        return cloneStruct(desc, orig);
    }
    function wgsl(doAlign, locationStart) {
        assert((opts === null || opts === void 0 ? void 0 : opts.isCompact) ? !doAlign : true, "Cannot use aligned WGSL struct w/ compact layout");
        // Example output:
        // `
        // @location(0) position : vec3<f32>,
        // @location(1) color : vec3<f32>,
        // @location(2) normal : vec3<f32>,
        // @location(3) uv : vec2<f32>,
        // `
        // TODO(@darzu): support location and alignment
        let res = ``;
        let i = 0;
        for (let name of Object.keys(desc)) {
            const type = desc[name];
            // TODO(@darzu): remove eventually for perf
            if (doAlign && !wgslTypeToAlign[type])
                throw `Missing alignment info for ${type}`;
            if (doAlign)
                res += `@align(${wgslTypeToAlign[type]}) `;
            if (locationStart !== undefined)
                res += `@location(${locationStart + i}) `;
            res += `${name} : ${type},\n`;
            i++;
        }
        return res;
    }
    // TODO(@darzu): is this really worth while?
    function layout(idx, stage, type, hasDynamicOffset) {
        return {
            binding: idx,
            visibility: stage,
            buffer: { type, hasDynamicOffset },
        };
    }
    function vertexLayout(stepMode, startLocation) {
        const attributes = [];
        for (let i = 0; i < offsets.length; i++) {
            const format = wgslTypeToVertType[types[i]];
            if (!format)
                throw `Unsupported type in vertex buffer: ${types[i]}`;
            attributes.push({
                shaderLocation: startLocation + i,
                offset: offsets[i],
                format,
            });
        }
        return {
            stepMode,
            arrayStride: structSize,
            attributes,
        };
    }
    return struct;
}
//# sourceMappingURL=data.js.map