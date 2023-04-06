import { CanvasDef } from "../canvas.js";
import { EM } from "../entity-manager.js";
import { FORCE_WEBGL } from "../main.js";
// import { attachToCanvasWebgl } from "./render_webgl.js";
import { createWebGPURenderer } from "./render-webgpu.js";
// TODO(@darzu): ECS this
// export let _renderer: Renderer;
export const RendererDef = EM.defineComponent("renderer", (renderer, usingWebGPU) => {
    return {
        renderer,
        usingWebGPU,
    };
});
let _rendererPromise = null;
export function registerRenderInitSystem(em) {
    em.registerSystem([], [CanvasDef], (_, res) => {
        if (!!em.getResource(RendererDef))
            return; // already init
        if (!!_rendererPromise)
            return;
        _rendererPromise = init(em, res.htmlCanvas.canvas);
    }, "renderInit");
}
async function init(em, canvas) {
    var _a;
    let renderer = undefined;
    let usingWebGPU = false;
    if (!FORCE_WEBGL) {
        // try webgpu first
        const adapter = await ((_a = navigator.gpu) === null || _a === void 0 ? void 0 : _a.requestAdapter());
        if (adapter) {
            const device = await adapter.requestDevice();
            // TODO(@darzu): uses cast while waiting for webgpu-types.d.ts to be updated
            const context = canvas.getContext("webgpu");
            if (context) {
                renderer = createWebGPURenderer(canvas, device, context);
                if (renderer)
                    usingWebGPU = true;
            }
        }
    }
    // TODO(@darzu): re-enable WebGL
    // if (!rendererInit)
    //   rendererInit = attachToCanvasWebgl(canvas, MAX_MESHES, MAX_VERTICES);
    if (!renderer)
        throw "Unable to create webgl or webgpu renderer";
    console.log(`Renderer: ${usingWebGPU ? "webGPU" : "webGL"}`);
    // add to ECS
    // TODO(@darzu): this is a little wierd to do this in an async callback
    em.addSingletonComponent(RendererDef, renderer, usingWebGPU);
}
//# sourceMappingURL=render-init.js.map