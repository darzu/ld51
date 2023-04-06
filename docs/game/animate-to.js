// TODO(@darzu): Move easing system elsewhere
// TODO(@darzu): share code with smoothing?
// TODO(@darzu): support more: https://easings.net/#
import { EM } from "../entity-manager.js";
import { vec3 } from "../gl-matrix.js";
import { onInit } from "../init.js";
import { PositionDef } from "../physics/transform.js";
import { PhysicsTimerDef } from "../time.js";
export const EASE_LINEAR = (p) => p;
export const EASE_OUTQUAD = (p) => 1 - (1 - p) ** 2;
export const AnimateToDef = EM.defineComponent("animateTo", function (a) {
    var _a, _b, _c, _d;
    return {
        startPos: (_a = a.startPos) !== null && _a !== void 0 ? _a : vec3.create(),
        endPos: (_b = a.endPos) !== null && _b !== void 0 ? _b : vec3.create(),
        easeFn: (_c = a.easeFn) !== null && _c !== void 0 ? _c : EASE_LINEAR,
        durationMs: (_d = a.durationMs) !== null && _d !== void 0 ? _d : 1000,
        progressMs: 0,
    };
});
onInit(() => {
    let delta = vec3.create();
    EM.registerSystem([AnimateToDef, PositionDef], [PhysicsTimerDef], (cs, res) => {
        let toRemove = [];
        const dt = res.physicsTimer.period;
        for (let c of cs) {
            c.animateTo.progressMs += dt;
            const percentTime = c.animateTo.progressMs / c.animateTo.durationMs;
            if (percentTime >= 1.0) {
                toRemove.push(c.id);
                vec3.copy(c.position, c.animateTo.endPos);
                continue;
            }
            const percentPath = c.animateTo.easeFn(percentTime);
            vec3.sub(delta, c.animateTo.endPos, c.animateTo.startPos);
            // TODO(@darzu): support other (non-linear) paths
            vec3.scale(delta, delta, percentPath);
            vec3.add(c.position, c.animateTo.startPos, delta);
        }
        // clean up finished
        for (let id of toRemove) {
            EM.removeComponent(id, AnimateToDef);
        }
    }, "animateTo");
});
//# sourceMappingURL=animate-to.js.map