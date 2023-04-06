import { align } from "../math.js";
import { assert } from "../test.js";
import { isNumber } from "../util.js";
import { texTypeIsStencil, texTypeToBytes, } from "./gpu-struct.js";
export function createCySingleton(device, struct, usage, initData) {
    var _a;
    assert((_a = struct.opts) === null || _a === void 0 ? void 0 : _a.isUniform, "CyOne struct must be created with isUniform");
    const _buf = device.createBuffer({
        size: struct.size,
        // TODO(@darzu): parameterize these
        // TODO(@darzu): be precise
        usage,
        mappedAtCreation: !!initData,
    });
    const buf = {
        struct,
        buffer: _buf,
        lastData: undefined,
        queueUpdate,
        binding,
    };
    if (initData) {
        buf.lastData = initData;
        const mappedBuf = new Uint8Array(_buf.getMappedRange());
        const d = struct.serialize(initData);
        mappedBuf.set(d, 0);
        _buf.unmap();
    }
    function queueUpdate(data) {
        // TODO(@darzu): measure perf. we probably want to allow hand written serializers
        buf.lastData = data;
        const b = struct.serialize(data);
        // assert(b.length % 4 === 0, `buf write must be 4 byte aligned: ${b.length}`);
        device.queue.writeBuffer(_buf, 0, b);
    }
    function binding(idx, plurality) {
        // TODO(@darzu): more binding options?
        return {
            binding: idx,
            // TODO(@darzu): is explicit size good?
            resource: { buffer: _buf, size: struct.size },
        };
    }
    return buf;
}
export function createCyArray(device, struct, usage, lenOrData) {
    const hasInitData = typeof lenOrData !== "number";
    const length = hasInitData ? lenOrData.length : lenOrData;
    if ((usage & GPUBufferUsage.UNIFORM) !== 0) {
        assert(struct.size % 256 === 0, "CyArray with UNIFORM usage must be 256 aligned");
    }
    const _buf = device.createBuffer({
        size: struct.size * length,
        // TODO(@darzu): parameterize these
        usage,
        mappedAtCreation: hasInitData,
    });
    const buf = {
        struct,
        buffer: _buf,
        length,
        queueUpdate,
        queueUpdates,
        binding,
    };
    const stride = struct.size;
    if (hasInitData) {
        const data = lenOrData;
        const mappedBuf = new Uint8Array(_buf.getMappedRange());
        for (let i = 0; i < data.length; i++) {
            const d = struct.serialize(data[i]);
            mappedBuf.set(d, i * stride);
        }
        _buf.unmap();
    }
    function queueUpdate(data, index) {
        const b = struct.serialize(data);
        // TODO(@darzu): disable for perf?
        // assert(b.length % 4 === 0);
        device.queue.writeBuffer(_buf, index * stride, b);
    }
    function queueUpdates(data, index) {
        const serialized = new Uint8Array(stride * data.length);
        data.forEach((d, i) => {
            serialized.set(struct.serialize(d), stride * i);
        });
        // assert(serialized.length % 4 === 0);
        device.queue.writeBuffer(_buf, index * stride, serialized);
    }
    function binding(idx, plurality) {
        const size = plurality === "one" ? struct.size : length * struct.size;
        return {
            binding: idx,
            resource: { buffer: _buf, size },
        };
    }
    return buf;
}
export function createCyIdxBuf(device, lenOrData) {
    const hasInitData = !isNumber(lenOrData);
    const length = hasInitData ? lenOrData.length : lenOrData;
    const size = align(length * Uint16Array.BYTES_PER_ELEMENT, 4);
    console.log(`idx size: ${size}`);
    const _buf = device.createBuffer({
        size: size,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: hasInitData,
    });
    const buf = {
        buffer: _buf,
        length,
        size,
        queueUpdate,
    };
    if (hasInitData) {
        const data = lenOrData;
        const mappedBuf = new Uint16Array(_buf.getMappedRange());
        assert(mappedBuf.length >= data.length, "mappedBuf.length >= data.length");
        mappedBuf.set(data);
        _buf.unmap();
    }
    function queueUpdate(data, startIdx) {
        const startByte = startIdx * Uint16Array.BYTES_PER_ELEMENT;
        // const byteView = new Uint8Array(data);
        // assert(data.length % 2 === 0);
        device.queue.writeBuffer(_buf, startByte, data);
    }
    return buf;
}
// TODO(@darzu): these paramters should just be CyTexturePtr
export function createCyTexture(device, ptr, usage) {
    const { size, format, init, sampleCount } = ptr;
    // TODO(@darzu): parameterize
    // TODO(@darzu): be more precise
    const bytesPerVal = texTypeToBytes[format];
    assert(bytesPerVal, `Unimplemented format: ${format}`);
    const cyTex = {
        ptr,
        size,
        usage,
        format,
        texture: undefined,
        queueUpdate,
        resize,
    };
    resize(size[0], size[1]);
    const initVal = init();
    if (initVal) {
        queueUpdate(initVal);
    }
    return cyTex;
    function resize(width, height) {
        var _a;
        cyTex.size[0] = width;
        cyTex.size[1] = height;
        // TODO(@darzu): feels wierd to mutate the descriptor...
        ptr.size[0] = width;
        ptr.size[1] = height;
        (_a = cyTex.texture) === null || _a === void 0 ? void 0 : _a.destroy();
        cyTex.texture = device.createTexture({
            size: cyTex.size,
            format: format,
            dimension: "2d",
            sampleCount,
            usage,
        });
    }
    // const queueUpdate = (data: Float32Array) => {
    function queueUpdate(data) {
        device.queue.writeTexture({ texture: cyTex.texture }, data, {
            offset: 0,
            bytesPerRow: cyTex.size[0] * bytesPerVal,
            rowsPerImage: cyTex.size[1],
        }, {
            width: cyTex.size[0],
            height: cyTex.size[1],
            // TODO(@darzu): what does this mean?
            depthOrArrayLayers: 1,
        });
    }
}
export function createCyDepthTexture(device, ptr, usage) {
    const tex = createCyTexture(device, ptr, usage);
    const hasStencil = ptr.format in texTypeIsStencil;
    return Object.assign(tex, {
        kind: "depthTexture",
        ptr,
        depthAttachment,
    });
    function depthAttachment() {
        return {
            // TODO(@darzu): create these less often??
            view: tex.texture.createView(),
            depthLoadOp: "clear",
            depthClearValue: 1.0,
            depthStoreOp: "store",
            stencilLoadOp: hasStencil ? "clear" : undefined,
            stencilClearValue: hasStencil ? 0 : undefined,
            stencilStoreOp: hasStencil ? "store" : undefined,
        };
    }
}
//# sourceMappingURL=gpu-data-webgpu.js.map