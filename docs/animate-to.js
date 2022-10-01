// TODO(@darzu): Move easing system elsewhere
// TODO(@darzu): share code with smoothing?
import { EM } from "./entity-manager.js";
import { vec3 } from "./gl-matrix.js";
import { onInit } from "./init.js";
import { PositionDef } from "./physics/transform.js";
import { TimeDef } from "./time.js";
// NOTE:
//  ideas from: https://easings.net/# (GPLv3, don't use code)
//  code from: https://github.com/Michaelangel007/easing#tldr-shut-up-and-show-me-the-code
export const EASE_LINEAR = (p) => p;
export const EASE_OUTQUAD = (p) => 1 - (1 - p) ** 2;
export const EASE_INQUAD = (p) => p ** 2;
export const EASE_INCUBE = (p) => p ** 3;
export const EASE_OUTBACK = (p) => {
    const m = p - 1;
    const k = 1.70158; // 10% bounce, see Michaelangel007's link for derivation
    return 1 + m * m * (m * (k + 1) + k);
};
export const EASE_INBACK = (p) => {
    const k = 1.70158;
    return p * p * (p * (k + 1) - k);
};
export function EASE_INVERSE(fn) {
    return (p) => 1.0 - fn(1.0 - p);
}
export const AnimateToDef = EM.defineComponent("animateTo", function (a) {
    var _a, _b, _c, _d, _e;
    return {
        startPos: (_a = a === null || a === void 0 ? void 0 : a.startPos) !== null && _a !== void 0 ? _a : vec3.create(),
        endPos: (_b = a === null || a === void 0 ? void 0 : a.endPos) !== null && _b !== void 0 ? _b : vec3.create(),
        easeFn: (_c = a === null || a === void 0 ? void 0 : a.easeFn) !== null && _c !== void 0 ? _c : EASE_LINEAR,
        durationMs: (_d = a === null || a === void 0 ? void 0 : a.durationMs) !== null && _d !== void 0 ? _d : 1000,
        progressMs: (_e = a === null || a === void 0 ? void 0 : a.progressMs) !== null && _e !== void 0 ? _e : 0,
    };
});
onInit(() => {
    let delta = vec3.create();
    EM.registerSystem([AnimateToDef, PositionDef], [TimeDef], (cs, res) => {
        let toRemove = [];
        // advance the animation
        for (let c of cs) {
            c.animateTo.progressMs += res.time.dt;
            const percentTime = c.animateTo.progressMs / c.animateTo.durationMs;
            if (percentTime < 0) {
                // outside the time bounds, we're in a start delay
                vec3.copy(c.position, c.animateTo.startPos);
                continue;
            }
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