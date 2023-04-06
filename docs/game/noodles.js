import { EM } from "../entity-manager.js";
import { cloneMesh, mapMeshPositions, normalizeMesh, scaleMesh3, } from "../render/mesh.js";
import { PositionDef } from "../physics/transform.js";
import { RenderableConstructDef, RenderableDef, } from "../render/renderer-ecs.js";
import { assert } from "../util.js";
import { RendererDef } from "../render/renderer-ecs.js";
import { vec3 } from "../gl-matrix.js";
import { CUBE_MESH } from "./assets.js";
export const NoodleDef = EM.defineComponent("noodle", (segments) => ({
    segments,
}));
// TODO(@darzu): DEBUGGING
export function debugCreateNoodles(em) {
    const e = em.newEntity();
    em.ensureComponentOn(e, NoodleDef, [
        {
            pos: [0, 0, 0],
            dir: [0, -1, 0],
        },
        {
            pos: [2, 2, 2],
            dir: [0, 1, 0],
        },
    ]);
    const m = createNoodleMesh(0.1, [0.2, 0.05, 0.05]);
    em.ensureComponentOn(e, RenderableConstructDef, m);
    em.ensureComponentOn(e, PositionDef, [5, -5, 0]);
    // TODO(@darzu): test cube faces (update: they are correct)
    // const cube = em.newEntity();
    // em.ensureComponentOn(cube, PositionDef, [0, -2, 0]);
    // const cubeM = cloneMesh(CUBE_MESH);
    // for (let triIdx of CUBE_FACES.bottom) {
    //   cubeM.colors[triIdx] = [0, 0, 0.5];
    // }
    // em.ensureComponentOn(cube, RenderableConstructDef, cubeM);
}
export function registerNoodleSystem(em) {
    const posIdxToSegIdx = new Map();
    CUBE_MESH.pos.forEach((p, i) => {
        if (p[1] > 0)
            posIdxToSegIdx.set(i, 0);
        else
            posIdxToSegIdx.set(i, 1);
    });
    em.registerSystem([NoodleDef, RenderableDef], [RendererDef], (es, rs) => {
        for (let e of es) {
            const mesh = e.renderable.meshHandle.readonlyMesh;
            assert(!!mesh, "Cannot find mesh for noodle");
            // mapMeshPositions(m, (p, i) => p);
            // e.noodle.size *= 1.01;
            // vec3.add(e.noodle.segments[0], e.noodle.segments[0], [0.01, 0, 0.01]);
            mapMeshPositions(mesh, (p, i) => {
                const segIdx = posIdxToSegIdx.get(i);
                assert(segIdx !== undefined, `missing posIdxToSegIdx for ${i}`);
                const seg = e.noodle.segments[segIdx];
                // TODO(@darzu): PERF, don't create vecs here
                // TODO(@darzu): rotate around .dir
                return vec3.add(vec3.create(), p, seg.pos);
            });
            rs.renderer.renderer.stdPool.updateMeshVertices(e.renderable.meshHandle, mesh);
        }
    }, "updateNoodles");
}
export function createNoodleMesh(thickness, color) {
    const m = cloneMesh(CUBE_MESH);
    m.colors.forEach((c) => vec3.copy(c, color));
    scaleMesh3(m, [thickness, 0.0, thickness]);
    return normalizeMesh(m);
}
//# sourceMappingURL=noodles.js.map