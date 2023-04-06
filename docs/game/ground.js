import { ColliderDef } from "../physics/collider.js";
import { EM } from "../entity-manager.js";
import { vec3 } from "../gl-matrix.js";
import { RenderableConstructDef } from "../render/renderer.js";
import { PositionDef } from "../physics/transform.js";
import { ScoreDef } from "./game.js";
import { MeDef } from "../net/components.js";
import { AssetsDef, DARK_BLUE, GROUNDSIZE, LIGHT_BLUE, } from "./assets.js";
import { defineNetEntityHelper } from "../em_helpers.js";
import { assert } from "../test.js";
import { ColorDef } from "../color.js";
const HALFSIZE = GROUNDSIZE / 2;
const SIZE = HALFSIZE * 2;
const THIRDSIZE = SIZE / 3;
export const { GroundPropsDef, GroundLocalDef, createGround } = defineNetEntityHelper(EM, {
    name: "ground",
    defaultProps: (location, color) => ({
        location: location !== null && location !== void 0 ? location : vec3.fromValues(0, 0, 0),
        color: color !== null && color !== void 0 ? color : vec3.fromValues(0, 0, 0),
    }),
    serializeProps: (o, buf) => {
        buf.writeVec3(o.location);
        buf.writeVec3(o.color);
    },
    deserializeProps: (o, buf) => {
        buf.readVec3(o.location);
        buf.readVec3(o.color);
    },
    defaultLocal: () => true,
    dynamicComponents: [PositionDef],
    buildResources: [AssetsDef, MeDef],
    build: (g, res) => {
        const em = EM;
        // TODO(@darzu): change position via events?
        vec3.copy(g.position, g.groundProps.location);
        em.ensureComponent(g.id, ColorDef, g.groundProps.color);
        em.ensureComponent(g.id, RenderableConstructDef, res.assets.ground.proto);
        em.ensureComponent(g.id, ColliderDef, {
            shape: "AABB",
            solid: true,
            aabb: res.assets.ground.aabb,
        });
    },
});
export const GroundSystemDef = EM.defineComponent("groundSystem", () => {
    return {
        groundPool: [],
        initialScore: (THIRDSIZE * 2) / 10,
        nextScore: (THIRDSIZE * 2) / 10,
        nextGroundIdx: 0,
        totalPlaced: 0,
        initialPlace: true,
    };
});
const NUM_X = 3;
const NUM_Z = 4;
export function initGroundSystem(em) {
    em.registerOneShotSystem(null, [ScoreDef, MeDef], (_, rs) => {
        const sys = em.addSingletonComponent(GroundSystemDef);
        // init ground system
        assert(sys.groundPool.length === 0);
        for (let x = 0; x < NUM_X; x++) {
            for (let z = 0; z < NUM_Z; z++) {
                const color = (x + z) % 2 === 0 ? LIGHT_BLUE : DARK_BLUE;
                const g = em.newEntity();
                em.ensureComponentOn(g, GroundPropsDef, [0, 0, 0], color);
                sys.groundPool.push(g.id);
            }
        }
    });
}
export function registerGroundSystems(em) {
    em.registerSystem(null, [GroundSystemDef, ScoreDef, MeDef], (_, res) => {
        if (!res.me.host)
            return;
        const sys = res.groundSystem;
        if (sys.groundPool.length === 0 ||
            sys.groundPool.some((id) => !em.findEntity(id, [GroundLocalDef])))
            // not inited
            return;
        // initial placement
        if (sys.initialPlace) {
            sys.initialPlace = false;
            sys.nextScore = sys.initialScore;
            sys.totalPlaced = 0;
            sys.nextGroundIdx = 0;
            for (let x = 0; x < NUM_X; x++) {
                for (let z = 0; z < NUM_Z; z++) {
                    placeNextGround();
                }
            }
        }
        else {
            // ship progress
            const score = res.score.currentScore;
            while (score > sys.nextScore) {
                placeNextGround();
                sys.nextScore += THIRDSIZE / 10;
            }
        }
        function placeNextGround() {
            // move ground
            const gId = sys.groundPool[sys.nextGroundIdx];
            const g = em.findEntity(gId, [GroundLocalDef, PositionDef]);
            if (g) {
                vec3.copy(g.position, calcLoc(sys.totalPlaced));
                sys.nextGroundIdx = (sys.nextGroundIdx + 1) % sys.groundPool.length;
                sys.totalPlaced += 1;
            }
        }
    }, "groundSystem");
    function calcLoc(num) {
        const x = num % NUM_X;
        const z = Math.floor(num / NUM_X);
        return [(x - 1) * SIZE, -7, z * SIZE];
    }
}
//# sourceMappingURL=ground.js.map