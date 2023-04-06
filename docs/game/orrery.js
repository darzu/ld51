import { ColorDef } from "../color-ecs.js";
import { createRef } from "../em_helpers.js";
import { EM } from "../entity-manager.js";
import { mat4, vec3 } from "../gl-matrix.js";
import { onInit } from "../init.js";
import { WorldFrameDef } from "../physics/nonintersection.js";
import { PhysicsParentDef, PositionDef, ScaleDef, } from "../physics/transform.js";
import { RenderableConstructDef } from "../render/renderer-ecs.js";
import { tempMat4 } from "../temp-pool.js";
import { AssetsDef } from "./assets.js";
import { DarkStarPropsDef } from "./darkstar.js";
import { BOAT_COLOR, } from "./player-ship.js";
const ORRERY_SCALE = 0.001;
export async function makeOrrery(em, parentId) {
    const res = await em.whenResources(AssetsDef);
    const orrery = em.newEntity();
    em.ensureComponentOn(orrery, OrreryDef);
    em.ensureComponentOn(orrery, PhysicsParentDef, parentId);
    em.ensureComponentOn(orrery, PositionDef, [0, 4, 4]);
    // put a ship model at the center of it
    const shipModel = em.newEntity();
    em.ensureComponentOn(shipModel, PhysicsParentDef, orrery.id);
    em.ensureComponentOn(shipModel, PositionDef, [0, 0, 0]);
    em.ensureComponentOn(shipModel, RenderableConstructDef, res.assets.ship.proto);
    em.ensureComponentOn(shipModel, ScaleDef, [
        ORRERY_SCALE * 40,
        ORRERY_SCALE * 40,
        ORRERY_SCALE * 40,
    ]);
    em.ensureComponentOn(shipModel, ColorDef, BOAT_COLOR);
}
export const OrreryDef = EM.defineComponent("orrery", () => ({
    orreryStars: [],
}));
onInit((em) => {
    em.registerSystem([OrreryDef, WorldFrameDef], [AssetsDef], (es, res) => {
        const stars = em.filterEntities([
            DarkStarPropsDef,
            WorldFrameDef,
            ColorDef,
        ]);
        for (let orrery of es) {
            while (orrery.orrery.orreryStars.length < stars.length) {
                const orreryStar = em.newEntity();
                em.ensureComponentOn(orreryStar, PositionDef);
                em.ensureComponentOn(orreryStar, PhysicsParentDef, orrery.id);
                em.ensureComponentOn(orreryStar, ColorDef);
                em.ensureComponentOn(orreryStar, RenderableConstructDef, res.assets.ball.proto);
                em.ensureComponentOn(orreryStar, ScaleDef, [0.25, 0.25, 0.25]);
                orrery.orrery.orreryStars.push(createRef(orreryStar));
            }
            const intoOrrerySpace = mat4.invert(tempMat4(), orrery.world.transform);
            stars.forEach((star, i) => {
                const orreryStar = orrery.orrery.orreryStars[i]();
                vec3.copy(orreryStar.color, star.color);
                vec3.copy(orreryStar.position, star.world.position);
                vec3.transformMat4(orreryStar.position, orreryStar.position, intoOrrerySpace);
                vec3.scale(orreryStar.position, orreryStar.position, ORRERY_SCALE);
            });
        }
    }, "orreryMotion");
});
//# sourceMappingURL=orrery.js.map