import { assert } from "../test.js";
import { CY, } from "./gpu-registry.js";
import { isRenderPipeline, } from "./data-webgpu.js";
import { MeshUniformStruct, } from "./pipelines/std-scene.js";
import { bundleRenderPipelines, createCyResources, doCompute, onCanvasResizeAll, startBundleRenderer, } from "./instantiator-webgpu.js";
import { texTypeToBytes } from "./gpu-struct.js";
export function createWebGPURenderer(canvas, device, context, shaders) {
    let renderer = {
        drawLines: true,
        drawTris: true,
        addMesh,
        addMeshInstance,
        updateMesh,
        updateScene,
        submitPipelines,
        readTexture,
    };
    const resources = createCyResources(CY, shaders, device);
    const cyKindToNameToRes = resources.kindToNameToRes;
    const pool = cyKindToNameToRes.meshPool["meshPool"];
    const sceneUni = cyKindToNameToRes.singleton["scene"];
    // render bundle
    const bundledMIds = new Set();
    let needsRebundle = false;
    let lastWireMode = [
        renderer.drawLines,
        renderer.drawTris,
    ];
    let lastPipelines = [];
    const cyRenderToBundle = {};
    updateRenderBundle([], []);
    // recomputes textures, widths, and aspect ratio on canvas resize
    let lastWidth = 0;
    let lastHeight = 0;
    function checkCanvasResize() {
        const newWidth = canvas.width;
        const newHeight = canvas.height;
        if (lastWidth === newWidth && lastHeight === newHeight)
            return false;
        onCanvasResizeAll(device, context, resources, [newWidth, newHeight]);
        lastWidth = newWidth;
        lastHeight = newHeight;
        return true;
    }
    function addMesh(m) {
        const handle = pool.addMesh(m);
        return handle;
    }
    function addMeshInstance(oldHandle) {
        const d = MeshUniformStruct.clone(oldHandle.shaderData);
        const newHandle = pool.addMeshInstance(oldHandle, d);
        return newHandle;
    }
    function updateMesh(handle, newMeshData) {
        pool.updateMeshVertices(handle, newMeshData);
    }
    function updateRenderBundle(handles, pipelines) {
        needsRebundle = false; // TODO(@darzu): hack?
        bundledMIds.clear();
        handles.forEach((h) => bundledMIds.add(h.mId));
        lastWireMode = [renderer.drawLines, renderer.drawTris];
        const renderBundles = bundleRenderPipelines(device, resources, pipelines, bundledMIds);
        for (let i = 0; i < pipelines.length; i++) {
            cyRenderToBundle[pipelines[i].ptr.name] = renderBundles[i];
        }
    }
    function updateScene(scene) {
        sceneUni.queueUpdate({
            ...sceneUni.lastData,
            ...scene,
        });
    }
    function submitPipelines(handles, pipelinePtrs) {
        // TODO(@darzu): a lot of the smarts of this fn should come out and be an explicit part
        //  of some pipeline sequencer-timeline-composition-y description thing
        if (!pipelinePtrs.length) {
            console.warn("rendering without any pipelines specified");
            return;
        }
        let renderPipelines = [];
        let computePipelines = [];
        let pipelines = [];
        pipelinePtrs.forEach((p) => {
            if (p.kind === "renderPipeline") {
                const res = cyKindToNameToRes.renderPipeline[p.name];
                assert(res, `Resource not initialized: ${p.name}`);
                renderPipelines.push(res);
                pipelines.push(res);
            }
            else {
                const res = cyKindToNameToRes.compPipeline[p.name];
                assert(res, `Resource not initialized: ${p.name}`);
                computePipelines.push(res);
                pipelines.push(res);
            }
        });
        const didPipelinesChange = lastPipelines.length !== pipelinePtrs.length ||
            lastPipelines.reduce((p, n, i) => p || lastPipelines[i].name !== pipelinePtrs[i].name, false);
        const didResize = checkCanvasResize();
        // update all mesh transforms
        for (let m of handles) {
            pool.updateUniform(m);
        }
        // TODO(@darzu): not great detection, needs to be more precise and less
        //    false positives
        // TODO(@darzu): account for handle masks
        needsRebundle =
            needsRebundle ||
                didPipelinesChange ||
                didResize ||
                bundledMIds.size !== handles.length ||
                renderer.drawLines !== lastWireMode[0] ||
                renderer.drawTris !== lastWireMode[1];
        if (!needsRebundle) {
            for (let mId of handles.map((o) => o.mId)) {
                if (!bundledMIds.has(mId)) {
                    // TODO(@darzu): BUG. this is currently true too often, maybe every frame
                    needsRebundle = true;
                    break;
                }
            }
        }
        if (needsRebundle) {
            // console.log("rebundeling");
            updateRenderBundle(handles, renderPipelines);
        }
        // start collecting our commands for this frame
        const commandEncoder = device.createCommandEncoder();
        const bundleRenderer = startBundleRenderer(context, commandEncoder, resources);
        // run pipelines
        for (let p of pipelines) {
            if (isRenderPipeline(p)) {
                // render
                bundleRenderer.render(p, cyRenderToBundle[p.ptr.name]);
            }
            else {
                // compute
                bundleRenderer.endPass();
                doCompute(device, resources, commandEncoder, p);
            }
        }
        bundleRenderer.endPass();
        // submit render passes to GPU
        device.queue.submit([commandEncoder.finish()]);
    }
    async function readTexture(ptr) {
        const tex = cyKindToNameToRes.texture[ptr.name];
        assert(!!tex, "cannot read from uninitialized texture: " + ptr.name);
        const bytesPerVal = texTypeToBytes[tex.format];
        const byteSize = tex.size[0] * tex.size[1] * bytesPerVal;
        console.log(`byteSize: ${byteSize}`);
        // TODO(@darzu): re-use buffers! and/or make it a CyBuffer-thing
        const gpuBuffer = device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            mappedAtCreation: false, // mapped post texture copy
        });
        const commandEncoder = device.createCommandEncoder();
        // TODO(@darzu): shares a lot with CyTexture's queueUpdate
        commandEncoder.copyTextureToBuffer({
            texture: tex.texture,
        }, {
            buffer: gpuBuffer,
            offset: 0,
            bytesPerRow: tex.size[0] * bytesPerVal,
            rowsPerImage: tex.size[1],
        }, {
            width: tex.size[0],
            height: tex.size[1],
            // TODO(@darzu): what does this mean?
            depthOrArrayLayers: 1,
        });
        device.queue.submit([commandEncoder.finish()]);
        await gpuBuffer.mapAsync(GPUMapMode.READ, 0, byteSize);
        // TODO(@darzu): support unmapping the array??
        return gpuBuffer.getMappedRange();
    }
    return renderer;
}
//# sourceMappingURL=render-webgpu.js.map