import { EM } from "./entity-manager.js";
import { vec3 } from "./gl-matrix.js";
export const ScaleDef = EM.defineComponent("scale", (by) => ({
    by: by || vec3.fromValues(1, 1, 1),
}));
//# sourceMappingURL=scale.js.map