import { EM } from "./entity-manager.js";
import { vec3 } from "./gl-matrix.js";
export const TintsDef = EM.defineComponent("tints", () => new Map());
export function applyTints(tints, tint) {
    tints.forEach((c) => vec3.add(tint, tint, c));
}
export function setTint(tints, name, tint) {
    let current = tints.get(name);
    if (!current) {
        current = vec3.create();
        tints.set(name, current);
    }
    vec3.copy(current, tint);
}
export function clearTint(tints, name) {
    let current = tints.get(name);
    if (current) {
        vec3.set(current, 0, 0, 0);
    }
}
//# sourceMappingURL=tint.js.map