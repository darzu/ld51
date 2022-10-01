import { EM } from "./entity-manager.js";
import { TextDef } from "./game/ui.js";
import { InputsDef } from "./inputs.js";
import { _lastCollisionTestTimeMs, _doesOverlapAABBs, _enclosedBys, _cellChecks, } from "./physics/broadphase.js";
import { RendererDef } from "./render/renderer-ecs.js";
export const DevConsoleDef = EM.defineComponent("dev", () => {
    const stats = {
        avgJsTime: 0,
        avgFrameTime: 0,
        avgSimTime: 0,
    };
    const updateAvgs = (jsTime, frameTime, simTime) => {
        stats.avgJsTime = updateAvg(stats.avgJsTime, jsTime);
        stats.avgFrameTime = updateAvg(stats.avgFrameTime, frameTime);
        stats.avgSimTime = updateAvg(stats.avgSimTime, simTime);
    };
    return Object.assign(stats, {
        showConsole: false,
        // TODO(@darzu): debugging
        // showConsole: true,
        updateAvgs,
    });
});
let avgWeight = 0.05;
function updateAvg(avg, curr) {
    return avg ? (1 - avgWeight) * avg + avgWeight * curr : curr;
}
export function registerDevSystems(em) {
    em.addSingletonComponent(DevConsoleDef);
    em.registerSystem(null, [InputsDef, DevConsoleDef], (_, res) => {
        if (res.inputs.keyClicks["`"])
            res.dev.showConsole = !res.dev.showConsole;
    }, "devConsoleToggle");
    em.registerSystem(null, [RendererDef, TextDef, DevConsoleDef], async (_, res) => {
        if (!res.dev.showConsole) {
            res.text.debugText = "";
            return;
        }
        const usingWebGPU = res.renderer.usingWebGPU;
        const controlsStr = `[WASD space 1 2 3 4 5 r t]`;
        // TODO(@darzu): can net stats be re-enabled?
        let { reliableBufferSize, unreliableBufferSize, numDroppedUpdates, skew, ping, } = /*net
        ? net.stats()
        : */ {
            reliableBufferSize: 0,
            unreliableBufferSize: 0,
            numDroppedUpdates: 0,
            skew: [],
            ping: [],
        };
        const pipelineTimes = await res.renderer.renderer.stats();
        let pipelineTimesTxts = [];
        pipelineTimes.forEach((time, pipeline) => pipelineTimesTxts.push(`\n${pipeline} ${(Number(time / BigInt(1000)) / 1000).toFixed(2)}`));
        const { avgFrameTime, avgJsTime, avgSimTime } = res.dev;
        const avgFPS = 1000 / avgFrameTime;
        const dbgTxt = controlsStr +
            ` ` +
            `js:${avgJsTime.toFixed(2)}ms ` +
            `sim:${avgSimTime.toFixed(2)}ms ` +
            `broad:(${_lastCollisionTestTimeMs.toFixed(1)}ms ` +
            `o:${_doesOverlapAABBs} e:${_enclosedBys} c:${_cellChecks}) ` +
            `fps:${avgFPS.toFixed(1)} ` +
            //`buffers:(r=${reliableBufferSize}/u=${unreliableBufferSize}) ` +
            `dropped:${numDroppedUpdates} ` +
            `entities:${EM.entities.size} ` +
            `skew: ${skew.join(",")} ` +
            `ping: ${ping.join(",")} ` +
            `${usingWebGPU ? "WebGPU" : "WebGL"} ` +
            `pipelines: ${pipelineTimesTxts.join(",")}`;
        res.text.debugText = dbgTxt;
    }, "devConsole");
}
//# sourceMappingURL=console.js.map