import { EM, } from "../entity-manager.js";
import { quat } from "../gl-matrix.js";
import { PhysicsParentDef, PositionDef, RotationDef, ScaleDef, } from "../physics/transform.js";
import { scaleMesh3 } from "../render/mesh-pool.js";
import { RenderableConstructDef } from "../render/renderer.js";
import { ColorDef } from "../color.js";
export const EnemyDef = EM.defineComponent("enemy", () => {
    return {
        leftLegId: 0,
        rightLegId: 0,
    };
});
export function createEnemy(em, assets, parent, pos) {
    const e = em.newEntity();
    em.ensureComponentOn(e, EnemyDef);
    em.ensureComponentOn(e, PositionDef, pos);
    em.ensureComponentOn(e, RotationDef, quat.create());
    const torso = scaleMesh3(assets.cube.mesh, [0.75, 0.75, 0.4]);
    em.ensureComponentOn(e, RenderableConstructDef, torso);
    em.ensureComponentOn(e, ColorDef, [0.2, 0.0, 0]);
    em.ensureComponentOn(e, PhysicsParentDef, parent);
    function makeLeg(x) {
        const l = em.newEntity();
        em.ensureComponentOn(l, PositionDef, [x, -1.75, 0]);
        em.ensureComponentOn(l, RenderableConstructDef, assets.cube.proto);
        em.ensureComponentOn(l, ScaleDef, [0.1, 1.0, 0.1]);
        em.ensureComponentOn(l, ColorDef, [0.05, 0.05, 0.05]);
        em.ensureComponentOn(l, PhysicsParentDef, e.id);
        return l;
    }
    e.enemy.leftLegId = makeLeg(-0.5).id;
    e.enemy.rightLegId = makeLeg(0.5).id;
    return e;
}
//# sourceMappingURL=enemy.js.map