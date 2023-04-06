import { assert } from "../util.js";
export const linearSamplerPtr = {
    kind: "sampler",
    name: "linearSampler",
};
// // TODO(@darzu): not the right way to specify samplers!
// // TODO(@darzu): wait, unfiltering sampler might make zero sense....
// export const linearUnfilterSamplerPtr = {
//   kind: "sampler",
//   name: "linearUnfilterSampler",
// } as const;
export const nearestSamplerPtr = {
    kind: "sampler",
    name: "nearestSampler",
};
export const comparisonSamplerPtr = {
    kind: "sampler",
    name: "comparison",
};
export function isResourcePtr(p) {
    return !!p.kind;
}
export function getTexFromAttachment(t) {
    return isResourcePtr(t) ? t : t.ptr;
}
// HELPERS
export function isRenderPipelinePtr(p) {
    return p.kind === "renderPipeline";
}
export const CY = createCyRegistry();
export function createCyRegistry() {
    let nameToPtr = {};
    let kindToPtrs = {
        array: [],
        singleton: [],
        idxBuffer: [],
        texture: [],
        depthTexture: [],
        compPipeline: [],
        renderPipeline: [],
        meshPool: [],
        sampler: [
            linearSamplerPtr,
            // linearUnfilterSamplerPtr,
            nearestSamplerPtr,
            comparisonSamplerPtr,
        ],
    };
    function registerCyResource(ptr) {
        assert(!nameToPtr[ptr.name], `already registered Cy resource with name: ${ptr.name}`);
        nameToPtr[ptr.name] = ptr;
        kindToPtrs[ptr.kind].push(ptr);
        return ptr;
    }
    // Note: we define individual register functions instead of a generic like
    //   register.kind() because some descriptions have custom type parameters
    //   we want to provide good typing for.
    return {
        nameToPtr,
        kindToPtrs,
        createSingleton: (name, desc) => {
            return registerCyResource({
                ...desc,
                kind: "singleton",
                name,
            });
        },
        createArray: (name, desc) => {
            return registerCyResource({
                ...desc,
                kind: "array",
                name,
            });
        },
        createIdxBuf: (name, desc) => {
            return registerCyResource({
                ...desc,
                kind: "idxBuffer",
                name,
            });
        },
        createTexture: (name, desc) => {
            return registerCyResource({
                ...desc,
                kind: "texture",
                name,
            });
        },
        createDepthTexture: (name, desc) => {
            return registerCyResource({
                ...desc,
                kind: "depthTexture",
                name,
            });
        },
        createComputePipeline: (name, desc) => {
            return registerCyResource({
                ...desc,
                kind: "compPipeline",
                name,
            });
        },
        createRenderPipeline: (name, desc) => {
            return registerCyResource({
                ...desc,
                kind: "renderPipeline",
                name,
            });
        },
        createMeshPool: (name, desc) => {
            return registerCyResource({
                ...desc,
                kind: "meshPool",
                name,
            });
        },
    };
}
//# sourceMappingURL=gpu-registry.js.map