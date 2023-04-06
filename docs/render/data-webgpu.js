import { align } from "../math.js";
import { assert, assertDbg } from "../util.js";
import { isNumber } from "../util.js";
import { texTypeIsStencil, texTypeToBytes, } from "./gpu-struct.js";
import { isRenderPipelinePtr, } from "./gpu-registry.js";
import { GPUBufferUsage } from "./webgpu-hacks.js";
import { PERF_DBG_GPU } from "../flags.js";
export function isRenderPipeline(p) {
    return isRenderPipelinePtr(p.ptr);
}
export let _gpuQueueBufferWriteBytes = 0;
export function createCySingleton(device, struct, usage, initData) {
    assert(struct.opts?.isUniform, "CyOne struct must be created with isUniform");
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
        assertDbg(b.byteLength % 4 === 0, `alignment`);
        device.queue.writeBuffer(_buf, 0, b);
        if (PERF_DBG_GPU)
            _gpuQueueBufferWriteBytes += b.byteLength;
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
    // if ((usage & GPUBufferUsage.UNIFORM) !== 0) {
    //   // TODO(@darzu): is this true for arrays where the whole array might be a uniform?
    //   assert(
    //     struct.size % 256 === 0,
    //     "CyArray with UNIFORM usage must be 256 aligned"
    //   );
    // }
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
    if (hasInitData) {
        const data = lenOrData;
        const mappedBuf = new Uint8Array(_buf.getMappedRange());
        for (let i = 0; i < data.length; i++) {
            const d = struct.serialize(data[i]);
            mappedBuf.set(d, i * struct.size);
        }
        _buf.unmap();
    }
    function queueUpdate(data, index) {
        const b = struct.serialize(data);
        const bufOffset = index * struct.size;
        assertDbg(bufOffset % 4 === 0, `alignment`);
        assertDbg(b.length % 4 === 0, `alignment`);
        device.queue.writeBuffer(_buf, bufOffset, b);
        if (PERF_DBG_GPU)
            _gpuQueueBufferWriteBytes += b.length;
    }
    // TODO(@darzu): somewhat hacky way to reuse Uint8Arrays here; we could do some more global pool
    //    of these.
    let tempUint8Array = new Uint8Array(struct.size * 10);
    function queueUpdates(data, bufIdx, dataIdx, // TODO(@darzu): make last two params optional?
    dataCount) {
        // TODO(@darzu): IMPL
        // TODO(@darzu): PERF. probably a good idea to keep the serialized array
        //  around and modify that directly for many scenarios that need frequent
        //  updates.
        const dataSize = struct.size * dataCount;
        if (tempUint8Array.byteLength <= dataSize) {
            tempUint8Array = new Uint8Array(dataSize);
        }
        const serialized = tempUint8Array;
        // TODO(@darzu): DBG HACK! USE TEMP!
        // const serialized = new Uint8Array(dataSize);
        for (let i = dataIdx; i < dataIdx + dataCount; i++)
            serialized.set(struct.serialize(data[i]), struct.size * (i - dataIdx));
        const bufOffset = bufIdx * struct.size;
        assertDbg(dataSize % 4 === 0, `alignment`);
        assertDbg(bufOffset % 4 === 0, `alignment`);
        device.queue.writeBuffer(_buf, bufOffset, serialized, 0, dataSize);
        if (PERF_DBG_GPU)
            _gpuQueueBufferWriteBytes += dataSize;
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
    // console.log(`idx size: ${size}`);
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
        const startByte = startIdx * 2;
        assertDbg(data.byteLength % 4 === 0, `alignment`);
        assertDbg(startByte % 4 === 0, `alignment`);
        device.queue.writeBuffer(_buf, startByte, data);
        if (PERF_DBG_GPU)
            _gpuQueueBufferWriteBytes += data.byteLength;
    }
    return buf;
}
// TODO(@darzu): these paramters should just be CyTexturePtr
export function createCyTexture(device, ptr, usage) {
    const { size, format, init, sampleCount } = ptr;
    // TODO(@darzu): parameterize
    // TODO(@darzu): be more precise
    const bytesPerVal = texTypeToBytes[format];
    assert(bytesPerVal, `TODO format: ${format}`);
    const cyTex = {
        ptr,
        size,
        usage,
        format,
        texture: undefined,
        queueUpdate,
        resize,
        attachment,
    };
    resize(size[0], size[1]);
    if (init) {
        const data = init();
        if (PERF_DBG_GPU)
            console.log(`creating texture of size: ${(data.length * 4) / 1024}kb`);
        queueUpdate(data);
    }
    const black = [0, 0, 0, 1];
    return cyTex;
    function resize(width, height) {
        cyTex.size[0] = width;
        cyTex.size[1] = height;
        // TODO(@darzu): feels wierd to mutate the descriptor...
        ptr.size[0] = width;
        ptr.size[1] = height;
        cyTex.texture?.destroy();
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
    function attachment(opts) {
        const loadOp = opts?.doClear ? "clear" : "load";
        const backgroundColor = opts?.defaultColor ?? black;
        return {
            view: opts?.viewOverride ?? cyTex.texture.createView(),
            loadOp,
            clearValue: backgroundColor,
            storeOp: "store",
        };
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
    function depthAttachment(clear) {
        return {
            // TODO(@darzu): create these less often??
            view: tex.texture.createView(),
            depthLoadOp: clear ? "clear" : "load",
            depthClearValue: 1.0,
            depthStoreOp: "store",
            stencilLoadOp: hasStencil ? "clear" : undefined,
            stencilClearValue: hasStencil ? 0 : undefined,
            stencilStoreOp: hasStencil ? "store" : undefined,
        };
    }
}
//# sourceMappingURL=data-webgpu.js.map