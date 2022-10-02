import { ColorDef } from "./color-ecs.js";
import { EM } from "./entity-manager.js";
import { BLACK, } from "./game/assets.js";
import { BulletDef } from "./game/bullet.js";
import { GravityDef } from "./game/gravity.js";
import { mat4, quat, vec2, vec3, vec4 } from "./gl-matrix.js";
import { onInit } from "./init.js";
import { jitter } from "./math.js";
import { copyAABB, copyLine, createAABB, createLine, doesOverlapAABB, emptyLine, getAABBFromPositions, getLineEnd, getLineMid, lineSphereIntersections, transformAABB, transformLine, } from "./physics/broadphase.js";
import { ColliderDef } from "./physics/collider.js";
import { AngularVelocityDef, LinearVelocityDef } from "./physics/motion.js";
import { PhysicsResultsDef, WorldFrameDef } from "./physics/nonintersection.js";
import { PhysicsParentDef, PositionDef, RotationDef, } from "./physics/transform.js";
import { getQuadMeshEdges, normalizeMesh, } from "./render/mesh.js";
import { RenderableConstructDef, RenderableDef, RenderDataStdDef, RendererDef, } from "./render/renderer-ecs.js";
import { tempVec3 } from "./temp-pool.js";
import { assert } from "./test.js";
import { centroid, quatFromUpForward, randNormalVec3, vec3Dbg, } from "./utils-3d.js";
import { createSplinterPool } from "./wood-splinters.js";
// TODO(@darzu): consider other mesh representations like:
//    DCEL or half-edge data structure
// export const WoodenDef = EM.defineComponent("wooden", () => {
//   return {
//     // TODO(@darzu): options?
//   };
// });
export const WoodStateDef = EM.defineComponent("woodState", (s) => {
    return s;
});
export const WoodAssetsDef = EM.defineComponent("woodAssets", (registry = {}) => registry);
onInit((em) => {
    em.registerSystem([WoodStateDef, WoodHealthDef, WorldFrameDef, RenderableDef], [PhysicsResultsDef, RendererDef], (es, res) => {
        const { collidesWith } = res.physicsResults;
        const ballAABBWorld = createAABB();
        const segAABBWorld = createAABB();
        const worldLine = emptyLine();
        const before = performance.now();
        let segAABBHits = 0;
        let segMidHits = 0;
        let overlapChecks = 0;
        const DBG_COLOR = false;
        for (let w of es) {
            // console.log(`checking wood!`);
            const meshHandle = w.renderable.meshHandle;
            const mesh = meshHandle.readonlyMesh; // TODO(@darzu): again, shouldn't be modifying "readonlyXXXX"
            const hits = collidesWith.get(w.id);
            if (hits) {
                const balls = hits
                    .map((h) => em.findEntity(h, [BulletDef, WorldFrameDef, ColliderDef]))
                    .filter((b) => {
                    // TODO(@darzu): check authority and team
                    return b && b.bullet.health > 0;
                });
                for (let _ball of balls) {
                    const ball = _ball;
                    // TODO(@darzu): move a bunch of the below into physic system features!
                    assert(ball.collider.shape === "AABB");
                    copyAABB(ballAABBWorld, ball.collider.aabb);
                    transformAABB(ballAABBWorld, ball.world.transform);
                    // TODO(@darzu): this sphere should live elsewhere..
                    const worldSphere = {
                        org: ball.world.position,
                        rad: (ballAABBWorld.max[0] - ballAABBWorld.min[0]) * 0.5,
                    };
                    w.woodState.boards.forEach((board, boardIdx) => {
                        if (ball.bullet.health <= 0)
                            return;
                        board.forEach((seg, segIdx) => {
                            if (ball.bullet.health <= 0)
                                return;
                            // TODO(@darzu):
                            copyAABB(segAABBWorld, seg.localAABB);
                            transformAABB(segAABBWorld, w.world.transform);
                            overlapChecks++;
                            if (doesOverlapAABB(ballAABBWorld, segAABBWorld)) {
                                // TODO(@darzu): hack, turn boards red on AABB hit
                                segAABBHits += 1;
                                for (let qi of seg.quadSideIdxs) {
                                    if (DBG_COLOR && mesh.colors[qi][1] < 1) {
                                        // dont change green to red
                                        mesh.colors[qi] = [1, 0, 0];
                                    }
                                }
                                copyLine(worldLine, seg.midLine);
                                transformLine(worldLine, w.world.transform);
                                const midHits = lineSphereIntersections(worldLine, worldSphere);
                                if (midHits) {
                                    // console.log(`mid hit: ${midHits}`);
                                    segMidHits += 1;
                                    if (DBG_COLOR)
                                        for (let qi of seg.quadSideIdxs) {
                                            mesh.colors[qi] = [0, 1, 0];
                                        }
                                    // TODO(@darzu): cannon ball health stuff!
                                    const woodHealth = w.woodHealth.boards[boardIdx][segIdx];
                                    const dmg = Math.min(woodHealth.health, ball.bullet.health) + 0.001;
                                    woodHealth.health -= dmg;
                                    ball.bullet.health -= dmg;
                                    // w.woodHealth.boards[boardIdx][segIdx].health -= 0.2;
                                }
                            }
                        });
                    });
                }
            }
            if (DBG_COLOR && (segAABBHits > 0 || segMidHits > 0)) {
                // TODO(@darzu): really need sub-mesh updateMesh
                res.renderer.renderer.updateMeshVertices(meshHandle, mesh);
                // res.renderer.renderer.updateMeshIndices(meshHandle, mesh);
            }
        }
        // TODO(@darzu):
        // console.log("wooden!: " + es.length);
        //
        // TODO(@darzu): auto AABB system?
        /*
        Broadphase Collision / non-intersection:
          each level of floor planks, etc
        */
        const after = performance.now();
        if (segAABBHits > 1) {
            // console.log(
            //   `runWooden: ${(after - before).toFixed(
            //     2
            //   )}ms, aabb hits: ${segAABBHits}, line hits: ${segMidHits}, aabbChecks: ${overlapChecks}`
            // );
        }
    }, "runWooden");
});
export const SplinterParticleDef = EM.defineComponent("splinter", () => {
    return {};
});
const splinterPools = new Map();
onInit((em) => {
    em.registerSystem([WoodStateDef, WorldFrameDef, WoodHealthDef, RenderableDef, ColorDef], [RendererDef], async (es, res) => {
        // TODO(@darzu):
        for (let w of es) {
            let needsUpdate = false;
            const meshHandle = w.renderable.meshHandle;
            const mesh = meshHandle.readonlyMesh;
            w.woodState.boards.forEach((board, bIdx) => {
                let pool = undefined;
                board.forEach((seg, sIdx) => {
                    var _a, _b, _c, _d;
                    const h = w.woodHealth.boards[bIdx][sIdx];
                    if (!h.broken && h.health <= 0) {
                        h.broken = true;
                        hideSegment(seg, mesh);
                        needsUpdate = true;
                        // get the board's pool
                        if (!pool) {
                            const poolKey = `w${seg.width.toFixed(1)}_d${seg.depth.toFixed(1)}_c${vec3Dbg(w.color)}`;
                            if (!splinterPools.has(poolKey)) {
                                console.log(`new splinter pool!: ${poolKey}`);
                                pool = createSplinterPool(seg.width, seg.depth, 1, vec3.clone(w.color), 40);
                                splinterPools.set(poolKey, pool);
                            }
                            else {
                                pool = splinterPools.get(poolKey);
                            }
                        }
                        // create flying splinter (from pool)
                        {
                            const splinter = pool.getNext();
                            vec3.copy(splinter.color, w.color);
                            const pos = getLineMid(vec3.create(), seg.midLine);
                            vec3.transformMat4(pos, pos, w.world.transform);
                            EM.ensureComponentOn(splinter, PositionDef);
                            vec3.copy(splinter.position, pos);
                            const rot = getSegmentRotation(seg, false);
                            quat.mul(rot, rot, w.world.rotation); // TODO(@darzu): !VERIFY! this works
                            EM.ensureComponentOn(splinter, RotationDef);
                            quat.copy(splinter.rotation, rot);
                            const spin = randNormalVec3(vec3.create());
                            const vel = vec3.clone(spin);
                            vec3.scale(spin, spin, 0.01);
                            em.ensureComponentOn(splinter, AngularVelocityDef);
                            vec3.copy(splinter.angularVelocity, spin);
                            vec3.scale(vel, vel, 0.01);
                            em.ensureComponentOn(splinter, LinearVelocityDef);
                            vec3.copy(splinter.linearVelocity, spin);
                            em.ensureComponentOn(splinter, GravityDef);
                            vec3.copy(splinter.gravity, [0, -3, 0]);
                        }
                        if (h.prev && !h.prev.broken) {
                            // create end caps
                            // TODO(@darzu): use a pool of end caps n stuff
                            const endBot = createSplinterEnd(seg, mesh, false, seg.width, seg.depth);
                            em.ensureComponentOn(endBot, PhysicsParentDef, w.id);
                            vec3.copy(endBot.color, w.color);
                            em.whenEntityHas(endBot, RenderDataStdDef).then((end2) => {
                                // NOTE: we match the object IDs so that there's no hard outline
                                // between the splintered end and main board.
                                end2.renderDataStd.id = meshHandle.mId;
                            });
                            h.splinterBot = endBot;
                        }
                        if (h.next && !h.next.broken) {
                            const endTop = createSplinterEnd(seg, mesh, true, seg.width, seg.depth);
                            em.ensureComponentOn(endTop, PhysicsParentDef, w.id);
                            vec3.copy(endTop.color, w.color);
                            em.whenEntityHas(endTop, RenderDataStdDef).then((end2) => {
                                // NOTE: we match the object IDs so that there's no hard outline
                                // between the splintered end and main board.
                                end2.renderDataStd.id = meshHandle.mId;
                            });
                            h.splinterTop = endTop;
                        }
                        if ((_a = h.next) === null || _a === void 0 ? void 0 : _a.splinterBot) {
                            em.whenEntityHas((_b = h.next) === null || _b === void 0 ? void 0 : _b.splinterBot, RenderableDef).then((nextEnd) => {
                                // TODO(@darzu): Put back into pool!
                                nextEnd.renderable.enabled = false;
                            });
                            h.next.splinterBot = undefined;
                        }
                        if ((_c = h.prev) === null || _c === void 0 ? void 0 : _c.splinterTop) {
                            em.whenEntityHas((_d = h.prev) === null || _d === void 0 ? void 0 : _d.splinterTop, RenderableDef).then((prevEnd) => {
                                // TODO(@darzu): Put back into pool!
                                prevEnd.renderable.enabled = false;
                            });
                            h.prev.splinterTop = undefined;
                        }
                    }
                });
            });
            if (needsUpdate) {
                // TODO(@darzu): really need sub-mesh updateMesh
                res.renderer.renderer.updateMeshIndices(meshHandle, mesh);
            }
        }
    }, "woodHealth");
});
function getSegmentRotation(seg, top) {
    let segNorm = vec3.create();
    let biggestArea2 = 0;
    for (let v of seg.areaNorms) {
        const a = vec3.sqrLen(v);
        if (a > biggestArea2) {
            biggestArea2 = a;
            vec3.copy(segNorm, v);
        }
    }
    const endNorm = vec3.copy(tempVec3(), seg.midLine.ray.dir);
    if (top) {
        vec3.negate(endNorm, endNorm);
    }
    const rot = quat.create();
    quatFromUpForward(rot, endNorm, segNorm);
    return rot;
}
// TODO(@darzu): POOL THESE SPLINTER ENDS!
function createSplinterEnd(seg, boardMesh, top, W, D) {
    const pos = vec3.copy(tempVec3(), seg.midLine.ray.org);
    if (top) {
        getLineEnd(pos, seg.midLine);
    }
    const rot = getSegmentRotation(seg, top);
    // TODO(@darzu): put these into a pool
    // const res = await EM.whenResources(AssetsDef);
    const splinter = EM.newEntity();
    // TODO(@darzu): perf? probably don't need to normalize, just use same surface ID and provoking vert for all
    const cursor = mat4.fromRotationTranslation(mat4.create(), rot, pos);
    let _splinterMesh;
    {
        const b = createTimberBuilder(createEmptyMesh("splinterEnd"));
        b.width = W;
        b.depth = D;
        b.setCursor(cursor);
        b.addLoopVerts();
        // TODO(@darzu): HACK. We're "snapping" the splinter loop and segment loops
        //    together via distance; we should be able to do this in a more analytic way
        const snapDistSqr = Math.pow(0.2 * 0.5, 2);
        const loop = (top ? seg.vertNextLoopIdxs : seg.vertLastLoopIdxs);
        for (let vi = b.mesh.pos.length - 4; vi < b.mesh.pos.length; vi++) {
            const p = b.mesh.pos[vi];
            for (let lp of loop.map((vi2) => boardMesh.pos[vi2])) {
                if (vec3.sqrDist(p, lp) < snapDistSqr) {
                    vec3.copy(p, lp);
                    break;
                }
            }
        }
        // const lastLoop = vec4.clone(seg.vertLastLoopIdxs);
        // vec4RotateLeft(lastLoop);
        // vec4RotateLeft(lastLoop);
        // // vec4RotateLeft(lastLoop);
        // for (let vi of lastLoop) {
        //   b.mesh.pos.push(vec3.clone(boardMesh.pos[vi]));
        // }
        b.addEndQuad(true);
        b.setCursor(cursor);
        mat4.translate(b.cursor, b.cursor, [0, 0.1, 0]);
        b.addSplinteredEnd(b.mesh.pos.length, 5);
        // TODO(@darzu): triangle vs quad coloring doesn't work
        b.mesh.quad.forEach((_) => b.mesh.colors.push(vec3.clone(BLACK)));
        b.mesh.tri.forEach((_) => b.mesh.colors.push(vec3.clone(BLACK)));
        // TODO(@darzu): set objectIDs
        _splinterMesh = b.mesh;
    }
    // yi < 5 ? mkTimberSplinterEnd() : mkTimberSplinterFree();
    // mkTimberSplinterFree(0.2 + xi * 0.2, 0.2 + yi * 0.2);
    // mkTimberSplinterFree(1, 1, 1);
    const splinterMesh = normalizeMesh(_splinterMesh);
    EM.ensureComponentOn(splinter, RenderableConstructDef, splinterMesh);
    EM.ensureComponentOn(splinter, ColorDef, [
        Math.random(),
        Math.random(),
        Math.random(),
    ]);
    // em.ensureComponentOn(splinter, ColorDef, [0.1, 0.1, 0.1]);
    EM.ensureComponentOn(splinter, PositionDef);
    EM.ensureComponentOn(splinter, RotationDef);
    EM.ensureComponentOn(splinter, WorldFrameDef);
    // EM.ensureComponentOn(splinter, ColliderDef, {
    //   shape: "AABB",
    //   solid: false,
    //   aabb: res.assets.timber_splinter.aabb,
    // });
    return splinter;
}
export function createEmptyMesh(dbgName) {
    let mesh = {
        dbgName: "timber_rib",
        pos: [],
        tri: [],
        quad: [],
        colors: [],
    };
    return mesh;
}
export function createTimberBuilder(mesh) {
    // TODO(@darzu): have a system for building wood?
    // const W = 0.5; // width
    // const D = 0.2; // depth
    const cursor = mat4.create();
    const b = {
        width: 0.2,
        depth: 0.2,
        mesh,
        cursor,
        addSplinteredEnd,
        addLoopVerts,
        addSideQuads,
        addEndQuad,
        setCursor,
    };
    return b;
    function setCursor(newCursor) {
        mat4.copy(cursor, newCursor);
    }
    function addSplinteredEnd(lastLoopEndVi, numJags) {
        const vi = mesh.pos.length;
        const v0 = vec3.fromValues(0, 0, b.depth);
        const v1 = vec3.fromValues(0, 0, -b.depth);
        vec3.transformMat4(v0, v0, cursor);
        vec3.transformMat4(v1, v1, cursor);
        mesh.pos.push(v0, v1);
        const v_tm = vi + 0;
        const v_tbr = lastLoopEndVi + -4;
        const v_tbl = lastLoopEndVi + -1;
        const v_bbr = lastLoopEndVi + -3;
        const v_bbl = lastLoopEndVi + -2;
        // +D side
        mesh.tri.push([v_tm, v_tbl, v_tbr]);
        // -D side
        mesh.tri.push([v_tm + 1, v_bbr, v_bbl]);
        let v_tlast = v_tbl;
        let v_blast = v_bbl;
        // const numJags = 5;
        const xStep = (b.width * 2) / numJags;
        let lastY = 0;
        let lastX = -b.width;
        for (let i = 0; i <= numJags; i++) {
            const x = i * xStep - b.width + jitter(0.05);
            let y = lastY;
            while (Math.abs(y - lastY) < 0.1)
                // TODO(@darzu): HACK to make sure it's not too even
                y = i % 2 === 0 ? 0.7 + jitter(0.6) : 0.2 + jitter(0.1);
            let d = b.depth; // + jitter(0.1);
            // TODO(@darzu): HACK! This ensures that adjacent "teeth" in the splinter
            //    are properly manifold/convex/something-something
            let cross_last_this = vec2.cross(tempVec3(), [lastX, lastY], [x, y]);
            let maxLoop = 10;
            while (cross_last_this[2] > 0 && maxLoop > 0) {
                if (x < 0)
                    y += 0.1;
                else
                    y -= 0.1;
                vec2.cross(cross_last_this, [lastX, lastY], [x, y]);
                maxLoop--;
            }
            if (cross_last_this[2] > 0)
                console.warn(`non-manifold!`);
            // +D side
            const vtj = vec3.fromValues(x, y, d);
            vec3.transformMat4(vtj, vtj, cursor);
            const vtji = mesh.pos.length;
            mesh.pos.push(vtj);
            mesh.tri.push([v_tm, vtji, v_tlast]);
            // -D side
            const vbj = vec3.fromValues(x, y, -d);
            vec3.transformMat4(vbj, vbj, cursor);
            mesh.pos.push(vbj);
            mesh.tri.push([v_tm + 1, v_blast, vtji + 1]);
            // D to -D quad
            mesh.quad.push([v_blast, v_tlast, vtji, vtji + 1]);
            v_tlast = vtji;
            v_blast = vtji + 1;
            lastX = x;
            lastY = y;
        }
        // +D side
        mesh.tri.push([v_tm, v_tbr, v_tlast]);
        // -D side
        mesh.tri.push([v_tm + 1, v_blast, v_bbr]);
        // D to -D quad
        mesh.quad.push([v_blast, v_tlast, v_tbr, v_bbr]);
    }
    function addSideQuads() {
        const loop1Idx = mesh.pos.length - 1;
        const loop2Idx = mesh.pos.length - 1 - 4;
        // TODO(@darzu): handle rotation and provoking
        for (let i = 0; i > -4; i--) {
            const i2 = (i - 1) % 4;
            // console.log(`i: ${i}, i2: ${i2}`);
            mesh.quad.push([
                loop2Idx + i,
                loop1Idx + i,
                loop1Idx + i2,
                loop2Idx + i2,
            ]);
        }
    }
    function addEndQuad(facingDown) {
        // TODO(@darzu): take a "flipped" param
        // TODO(@darzu): handle provoking verts
        const lastIdx = mesh.pos.length - 1;
        const q = facingDown
            ? [lastIdx, lastIdx - 1, lastIdx - 2, lastIdx - 3]
            : [lastIdx - 3, lastIdx - 2, lastIdx - 1, lastIdx];
        mesh.quad.push(q);
    }
    function addLoopVerts() {
        const v0 = vec3.fromValues(b.width, 0, b.depth);
        const v1 = vec3.fromValues(b.width, 0, -b.depth);
        const v2 = vec3.fromValues(-b.width, 0, -b.depth);
        const v3 = vec3.fromValues(-b.width, 0, b.depth);
        vec3.transformMat4(v0, v0, cursor);
        vec3.transformMat4(v1, v1, cursor);
        vec3.transformMat4(v2, v2, cursor);
        vec3.transformMat4(v3, v3, cursor);
        mesh.pos.push(v0, v1, v2, v3);
    }
}
function hideSegment(seg, m) {
    // TODO(@darzu): how to unhide?
    // TODO(@darzu): probably a more efficient way to do this..
    for (let qi of [...seg.quadSideIdxs, ...seg.quadEndIdxs]) {
        const q = m.quad[qi];
        vec4.set(q, 0, 0, 0, 0);
    }
}
export function debugBoardSystem(m) {
    const before = performance.now();
    const boards = getBoardsFromMesh(m);
    console.dir(boards);
    const after = performance.now();
    console.log(`debugBoardSystem: ${(after - before).toFixed(2)}ms`);
    return m;
}
const TRACK_INVALID_BOARDS = false;
export function getBoardsFromMesh(m) {
    // What's in a board?
    // end verts connect to 3 others
    // mid verts connect to 4 others
    // ASSUME: quad mesh for the boards. Might as well
    // TODO(@darzu):
    // console.log("getBoardsFromMesh");
    const edges = getQuadMeshEdges(m);
    // possible ends
    // from the end, dist 1 from each vert that isn't in the end is the next stop
    // next stop must be inter connected
    const vHas3Edges = new Set(edges.reduce((p, n, i) => (n.length === 3 ? [...p, i] : p), []));
    // console.log("vHas3Edges:");
    // console.dir(vHas3Edges);
    const vIsMaybeEnd = new Set();
    // const newQuads: vec4[] = [];
    // const newTris: vec3[] = [];
    // TODO(@darzu): use m.quad as end canidates! b/c we need their cw/ccw order
    const qIsMaybeEnd = new Set();
    for (let qi = 0; qi < m.quad.length; qi++) {
        const q = m.quad[qi];
        if (q.every((vi) => vHas3Edges.has(vi) && !vIsMaybeEnd.has(vi))) {
            q.forEach((vi) => vIsMaybeEnd.add(vi));
            qIsMaybeEnd.add(qi);
        }
    }
    // console.log("qIsMaybeEnd");
    // console.dir(qIsMaybeEnd);
    // tracks verts and quads used in all boards
    const structureVis = new Set();
    const structureQis = new Set();
    // TODO: vi to board idx ?
    function createBoard(startQi) {
        const boardVis = new Set();
        const boardQis = new Set();
        const startLoop = m.quad[startQi];
        // build the board
        const allSegments = addBoardSegment(startLoop, true);
        if (allSegments) {
            // the board is valid; track it, return it
            boardVis.forEach((vi) => structureVis.add(vi));
            boardQis.forEach((qi) => structureQis.add(qi));
            // TODO(@darzu): DEBUG: render the board
            // console.log("boardQis:");
            // console.dir(boardQis);
            // boardQis.forEach((qi) =>
            //   assert(0 <= qi && qi < m.quad.length, "invalid qi")
            // );
            // boardQis.forEach((qi) => newQuads.push(m.quad[qi]));
            return allSegments;
        }
        return undefined;
        function addBoardSegment(lastLoop, isFirstLoop = false) {
            // start tracking this segment
            const segVis = new Set([...lastLoop]);
            // find the next loop
            const nextLoop_ = [];
            lastLoop.forEach((vi) => {
                edges[vi].forEach((vi2) => {
                    if (!segVis.has(vi2) &&
                        !boardVis.has(vi2) &&
                        !structureVis.has(vi2)) {
                        nextLoop_.push(vi2);
                    }
                });
            });
            // is our loop valid?
            if (nextLoop_.length !== 4) {
                // invalid board
                if (TRACK_INVALID_BOARDS)
                    console.log(`invalid board: next loop has ${nextLoop_.length} verts`);
                return undefined;
            }
            const nextLoop = nextLoop_;
            // add next loop verts to segment
            nextLoop.forEach((vi) => segVis.add(vi));
            // find all quads for segment
            // TODO(@darzu): PERF. inefficient to repeat this linear scan for each loop..
            //    probably partition the mesh into islands first
            const segQis = m.quad.reduce((p, n, ni) => !boardQis.has(ni) &&
                !structureQis.has(ni) &&
                n.every((vi) => segVis.has(vi))
                ? [...p, ni]
                : p, []);
            // TODO(@darzu): in the case of 6, we might have a single-segment
            //    board and we need to allow for that
            // do we still have a valid board?
            if (segQis.length !== 4 && segQis.length !== 5) {
                // invalid board; missing quads
                if (TRACK_INVALID_BOARDS)
                    console.log(`invalid board: seg has ${segQis.length} quads`);
                return undefined;
            }
            // track segment quads as board quads, from here the segment has either
            // the right verts and quads or the whole board is invalid.
            segQis.forEach((qi) => boardQis.add(qi));
            segVis.forEach((vi) => boardVis.add(vi));
            // create common segment data
            const vertIdxs = [...segVis.values()];
            const aabb = getAABBFromPositions(vertIdxs.map((vi) => m.pos[vi]));
            const lastMid = centroid([...lastLoop].map((vi) => m.pos[vi]));
            const nextMid = centroid([...nextLoop].map((vi) => m.pos[vi]));
            const mid = createLine(lastMid, nextMid);
            const areaNorms = segQis.map((qi) => {
                const ps = m.quad[qi].map((vi) => m.pos[vi]);
                // NOTE: assumes segments are parallelograms
                const ab = vec3.subtract(tempVec3(), ps[1], ps[0]);
                const ac = vec3.subtract(tempVec3(), ps[3], ps[0]);
                const areaNorm = vec3.cross(vec3.create(), ab, ac);
                // console.log(`vec3.len(areaNorm): ${vec3.len(areaNorm)}`);
                return areaNorm;
            });
            const len1 = vec3.dist(m.pos[lastLoop[1]], m.pos[lastLoop[0]]);
            const len2 = vec3.dist(m.pos[lastLoop[3]], m.pos[lastLoop[0]]);
            const width = Math.max(len1, len2) * 0.5;
            const depth = Math.min(len1, len2) * 0.5;
            let seg;
            // are we at an end of the board?
            if (segQis.length === 5) {
                // get the end-cap
                const endQuads = segQis.filter((qi) => m.quad[qi].every((vi) => (isFirstLoop ? lastLoop : nextLoop).includes(vi)));
                if (endQuads.length === 1) {
                    const endQuad = endQuads[0];
                    const sideQuads = segQis.filter((qi) => qi !== endQuad);
                    seg = {
                        localAABB: aabb,
                        midLine: mid,
                        areaNorms,
                        width,
                        depth,
                        vertLastLoopIdxs: lastLoop,
                        vertNextLoopIdxs: nextLoop,
                        quadSideIdxs: sideQuads,
                        quadEndIdxs: [endQuad],
                    };
                    if (isFirstLoop) {
                        // no-op, we'll continue below
                    }
                    else {
                        // we're done with the board
                        return [seg];
                    }
                }
                else {
                    // invalid board
                    if (TRACK_INVALID_BOARDS)
                        console.log(`invalid board: 5-quad but ${endQuads.length} end quads and is first: ${isFirstLoop}`);
                    return undefined;
                }
            }
            else {
                // no end quads, just side
                seg = {
                    localAABB: aabb,
                    midLine: mid,
                    areaNorms,
                    width,
                    depth,
                    vertLastLoopIdxs: lastLoop,
                    vertNextLoopIdxs: nextLoop,
                    quadSideIdxs: segQis,
                    quadEndIdxs: [],
                };
            }
            // continue
            // TODO(@darzu): perf. tail call optimization?
            const nextSegs = addBoardSegment(nextLoop);
            if (!nextSegs)
                return undefined;
            else
                return [seg, ...nextSegs];
        }
    }
    const boards = [];
    for (let qi of qIsMaybeEnd) {
        if (!structureQis.has(qi)) {
            const b = createBoard(qi);
            if (b)
                boards.push(b);
        }
    }
    // const newQuads: vec4[] = [];
    // const newTri: vec3[] = [];
    // const newColors: vec3[] = [];
    // const newSurfaceIds: number[] = [];
    // // TODO(@darzu): transfer quad data
    // takenQis.forEach((qi) => {
    //   const newQi = newQuads.length;
    //   newQuads.push(m.quad[qi]);
    //   newColors[newQi] = m.colors[qi]; // TODO(@darzu): face indexing isn't quite right here b/c of triangles
    //   newSurfaceIds[newQi] = newQi;
    // });
    // console.log(`quad count: ${m.quad.length} -> ${m.quad.length}`);
    // m.quad = newQuads;
    // m.tri = newTri;
    // m.colors = newColors;
    // m.surfaceIds = newSurfaceIds;
    const woodenState = {
        boards,
        usedVertIdxs: structureVis,
        usedQuadIdxs: structureQis,
    };
    return woodenState;
}
export function unshareProvokingForWood(m, woodState) {
    // TODO(@darzu): verify this actually works. We should pre-split the mesh
    //  into islands (which will speed up getBoardsFromMesh by a lot), and then
    //  verify each island is unshared.
    const provokingVis = new Set();
    let bIdx = 0;
    for (let b of woodState.boards) {
        // for (let b of [woodState.boards[60]]) {
        // first, do ends
        for (let seg of b) {
            for (let qi of seg.quadEndIdxs) {
                const done = unshareProvokingForBoardQuad(m.quad[qi], qi);
                if (!done)
                    console.error(`invalid board ${bIdx}! End cap can't unshare`);
                // console.log(`end: ${m.quad[qi]}`);
            }
        }
        for (let seg of b) {
            for (let qi of seg.quadSideIdxs) {
                const done = unshareProvokingForBoardQuad(m.quad[qi], qi, [
                    ...seg.vertLastLoopIdxs,
                ]);
                // if (done) console.log(`side: ${m.quad[qi]}`);
                if (!done) {
                    const done2 = unshareProvokingForBoardQuad(m.quad[qi], qi);
                    // if (done2) console.log(`side(2): ${m.quad[qi]}`);
                    if (!done2) {
                        console.error(`invalid board ${bIdx}; unable to unshare provoking`);
                    }
                }
            }
        }
        bIdx++;
    }
    function unshareProvokingForBoardQuad([i0, i1, i2, i3], qi, preferVis) {
        if ((!preferVis || preferVis.includes(i0)) && !provokingVis.has(i0)) {
            provokingVis.add(i0);
            m.quad[qi] = [i0, i1, i2, i3];
            return true;
        }
        else if ((!preferVis || preferVis.includes(i1)) &&
            !provokingVis.has(i1)) {
            provokingVis.add(i1);
            m.quad[qi] = [i1, i2, i3, i0];
            return true;
        }
        else if ((!preferVis || preferVis.includes(i2)) &&
            !provokingVis.has(i2)) {
            provokingVis.add(i2);
            m.quad[qi] = [i2, i3, i0, i1];
            return true;
        }
        else if ((!preferVis || preferVis.includes(i3)) &&
            !provokingVis.has(i3)) {
            provokingVis.add(i3);
            m.quad[qi] = [i3, i0, i1, i2];
            return true;
        }
        else {
            return false;
        }
    }
}
export const WoodHealthDef = EM.defineComponent("woodHealth", (s) => {
    return s;
});
export function createWoodHealth(w) {
    // TODO(@darzu):
    return {
        boards: w.boards.map((b) => {
            let lastSeg = b.reduce((p, n) => {
                const h = {
                    prev: p,
                    health: 1.0,
                    broken: false,
                };
                return h;
            }, undefined);
            if (!lastSeg)
                return [];
            // patch up "next" ptrs
            while (lastSeg.prev) {
                lastSeg.prev.next = lastSeg;
                lastSeg = lastSeg.prev;
            }
            let nextSeg = lastSeg;
            const segHealths = [];
            while (nextSeg) {
                segHealths.push(nextSeg);
                nextSeg = nextSeg.next;
            }
            // console.dir(segHealths);
            return segHealths;
        }),
    };
}
//# sourceMappingURL=wood.js.map