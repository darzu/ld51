import { ColliderDef } from "./collider.js";
import { EM, } from "./entity-manager.js";
import { PhysicsTimerDef } from "./time.js";
import { mat4, quat, vec3 } from "./gl-matrix.js";
import { computeContactData, computeReboundData, idPair, PAD, } from "./phys.js";
import { checkBroadphase, collisionPairs, copyAABB, createAABB, doesOverlap, doesTouch, getAABBFromPositions, rayHitDist, resetCollidesWithSet, } from "./phys_broadphase.js";
import { IDENTITY_FRAME, PositionDef, TransformDef, updateFrameFromPosRotScale, updateFrameFromTransform, } from "./transform.js";
import { assert } from "./test.js";
// TODO(@darzu): PHYSICS TODO:
// - parent to the "world planes" (BEFORE MERGE)
// - seperate rotation and motion w/ constraint checking between them
// - impl GJK
// - re-work the pos-rot-scale & transform dichotomy into something u can reason about
//    perhaps "Frames":
//      a frame has all of: pos, rot, scale, lin vel, ang vel, transform
//      if there are few enough ways in which the frame is mutated, we can provide helpers
//          such that the frame is always consistent
//      otherwise we have a "recomputeTransform" or "recomputeYYY" to rebuild parts from the others
//      ideally there would be some flags to help know what is out of sync
//    is it possible Frames could be read-only and all mutation could be pushed back to the "truth" fields?
export const PhysicsResultsDef = EM.defineComponent("physicsResults", () => {
    return {
        collidesWith: new Map(),
        reboundData: new Map(),
        contactData: new Map(),
        checkRay: (r) => [],
    };
});
export const WorldFrameDef = EM.defineComponent("world", () => {
    return {
        position: vec3.create(),
        rotation: quat.create(),
        scale: vec3.fromValues(1, 1, 1),
        transform: mat4.create(),
    };
});
// TODO(@darzu): break this up into the specific use cases
export const PhysicsStateDef = EM.defineComponent("_phys", () => {
    return {
        // track last stats so we can diff
        lastWPos: PositionDef.construct(),
        // AABBs
        localAABB: createAABB(),
        worldAABB: createAABB(),
        lastWorldAABB: createAABB(),
        sweepAABB: createAABB(),
    };
});
export let __step = 0; // TODO(@darzu): singleton component this
const _collisionRefl = vec3.create();
const _motionAABBs = [];
const _collisionPairs = new Set();
export let _motionPairsLen = 0; // TODO(@darzu): debug
const _objDict = new Map();
function getParentFrame(o) {
    if (o.physicsParent) {
        const parent = EM.findEntity(o.physicsParent.id, [WorldFrameDef]);
        if (parent)
            return parent.world;
    }
    return IDENTITY_FRAME;
}
// TODO(@darzu): PRECONDITION: assumes world frames are all up to date
export function registerUpdateWorldAABBs(em, s = "") {
    em.registerSystem([PhysicsStateDef, WorldFrameDef], [PhysicsTimerDef], (objs, res) => {
        for (let o of objs) {
            // update world AABBs
            const { localAABB, worldAABB, lastWorldAABB, sweepAABB } = o._phys;
            // TODO(@darzu): highly inefficient
            const wCorners = getAABBCorners(localAABB).map((p) => vec3.transformMat4(p, p, o.world.transform));
            copyAABB(worldAABB, getAABBFromPositions(wCorners));
            // update sweep AABBs
            for (let i = 0; i < 3; i++) {
                sweepAABB.min[i] = Math.min(lastWorldAABB.min[i], worldAABB.min[i]);
                sweepAABB.max[i] = Math.max(lastWorldAABB.max[i], worldAABB.max[i]);
            }
        }
    }, "registerUpdateWorldAABBs" + s);
}
export function registerUpdateWorldFromPosRotScale(em) {
    em.registerSystem([WorldFrameDef], [], (objs) => {
        for (let o of objs)
            updateFrameFromPosRotScale(o.world);
    }, "updateWorldFromPosRotScale");
}
export function registerUpdateLocalPhysicsFromWorldAndParent(em, s = "") {
    // TODO(@darzu): do we need topo-sort ?
    // const isUpdated: Set<number> = new Set();
    // function updateLocalPhysicsFromWorldAndParent(
    //   o: EntityW<
    //     [typeof PhysicsStateDef, typeof WorldFrameDef, typeof TransformDef]
    //   >
    // ) {
    //   if (isUpdated.has(o.id)) throw `Double visiting ${o.id}`;
    //   let parentFrame: ReadonlyFrame;
    //   if (PhysicsParentDef.isOn(o) && !isUpdated.has(o.physicsParent.id)) {
    //     const p = em.findEntity(o.physicsParent.id, [
    //       PhysicsStateDef,
    //       WorldFrameDef,
    //       TransformDef,
    //     ]);
    //     if (!p) throw `Parent ${o.physicsParent.id} is uninited!`;
    //     updateLocalPhysicsFromWorldAndParent(p);
    //     parentFrame = p.world;
    //   } else {
    //     parentFrame = IDENTITY_FRAME;
    //   }
    // }
    em.registerSystem([PhysicsStateDef, WorldFrameDef, TransformDef], [PhysicsTimerDef], (objs, res) => {
        for (let o of objs) {
            const parentFrame = getParentFrame(o);
            const parentToWorld = parentFrame.transform;
            const worldToParent = parentFrame.transform === mat4.IDENTITY
                ? mat4.IDENTITY
                : mat4.invert(mat4.create(), parentToWorld);
            const localToWorld = o.world.transform;
            // const worldToLocal = mat4.invert(mat4.create(), localToWorld);
            mat4.multiply(o.transform, worldToParent, localToWorld);
            updateFrameFromTransform(o);
            const localToParent = o.transform;
            // TODO(@darzu): angular velocity
        }
    }, "updateLocalPhysicsFromWorldAndParent" + s);
}
function getAABBCorners(aabb) {
    const points = [
        [aabb.max[0], aabb.max[1], aabb.max[2]],
        [aabb.max[0], aabb.max[1], aabb.min[2]],
        [aabb.max[0], aabb.min[1], aabb.max[2]],
        [aabb.max[0], aabb.min[1], aabb.min[2]],
        [aabb.min[0], aabb.max[1], aabb.max[2]],
        [aabb.min[0], aabb.max[1], aabb.min[2]],
        [aabb.min[0], aabb.min[1], aabb.max[2]],
        [aabb.min[0], aabb.min[1], aabb.min[2]],
    ];
    return points;
}
function stepConstraints(objs) {
    __step++; // TODO(@darzu): hack for debugging purposes
    // build a dict
    _objDict.clear();
    for (let o of objs)
        _objDict.set(o.id, o);
    // get singleton data
    const { physicsResults } = EM.findSingletonComponent(PhysicsResultsDef);
    const { collidesWith, contactData, reboundData } = physicsResults;
    // update in-contact pairs; this is seperate from collision or rebound
    for (let [abId, lastData] of contactData) {
        const aId = lastData.aId;
        const bId = lastData.bId;
        const a = _objDict.get(aId);
        const b = _objDict.get(bId);
        if (!lastData || !a || !b) {
            // one of the objects might have been deleted since the last frame,
            // ignore this contact
            contactData.delete(abId);
            continue;
        }
        // colliding again so we don't need any adjacency checks
        if (doesOverlap(a._phys.worldAABB, b._phys.worldAABB)) {
            const conData = computeContactData(a, b);
            contactData.set(abId, conData);
            continue;
        }
        // check for adjacency even if not colliding
        // TODO(@darzu): do we need to consider relative motions?
        //    i.e. a check to see if the two objects are pressing into each other?
        if (doesTouch(a._phys.worldAABB, b._phys.worldAABB, 2 * PAD)) {
            const conData = computeContactData(a, b);
            contactData.set(abId, conData);
            continue;
        }
        // else, this collision isn't valid any more
        contactData.delete(abId);
    }
    // reset collision data
    resetCollidesWithSet(collidesWith, objs);
    reboundData.clear();
    _collisionPairs.clear();
    // check for possible collisions using the motion swept AABBs
    if (_motionAABBs.length !== objs.length)
        _motionAABBs.length = objs.length;
    for (let i = 0; i < objs.length; i++) {
        const { id, _phys: { worldAABB: aabb }, } = objs[i];
        if (!_motionAABBs[i]) {
            _motionAABBs[i] = {
                id: id,
                aabb: aabb,
            };
        }
        else {
            _motionAABBs[i].id = id;
            _motionAABBs[i].aabb = aabb;
        }
    }
    const { collidesWith: motionCollidesWith, checkRay: motionCheckRay } = checkBroadphase(_motionAABBs);
    let motionPairs = [...collisionPairs(motionCollidesWith)];
    _motionPairsLen = motionPairs.length;
    const COLLISION_ITRS = 100;
    // we'll track which objects have moved each itr,
    // since we just ran dynamics assume everything has moved
    const lastObjMovs = {};
    for (let o of objs)
        lastObjMovs[o.id] = true;
    // we'll track how much each object should be adjusted each itr
    const nextObjMovFracs = {};
    // our loop condition
    let anyMovement = true;
    let itr = 0;
    while (anyMovement && itr < COLLISION_ITRS) {
        // enumerate the possible collisions, looking for objects that need to pushed apart
        for (let [aId, bId] of motionPairs) {
            if (bId < aId)
                throw `a,b id pair in wrong order ${bId} > ${aId}`;
            // did one of these objects move?
            if (!lastObjMovs[aId] && !lastObjMovs[bId])
                continue;
            const a = _objDict.get(aId);
            const b = _objDict.get(bId);
            if (!doesOverlap(a._phys.worldAABB, b._phys.worldAABB)) {
                // a miss
                continue;
            }
            // record the real collision
            const h = idPair(aId, bId);
            if (!_collisionPairs.has(h)) {
                _collisionPairs.add(h);
                collidesWith.get(aId).push(bId);
                collidesWith.get(bId).push(aId);
            }
            // compute contact info
            const contData = computeContactData(a, b);
            contactData.set(h, contData);
            // solid objects rebound
            if (a.collider.solid && b.collider.solid) {
                // compute rebound info
                const rebData = computeReboundData(a, b, itr);
                reboundData.set(h, rebData);
                // update how much we need to rebound objects by
                const { aRebound, bRebound } = rebData;
                if (aRebound < Infinity)
                    nextObjMovFracs[aId] = Math.max(nextObjMovFracs[aId] || 0, aRebound);
                if (bRebound < Infinity)
                    nextObjMovFracs[bId] = Math.max(nextObjMovFracs[bId] || 0, bRebound);
            }
        }
        // adjust objects Rebound to compensate for collisions
        anyMovement = false;
        for (let o of objs) {
            let movFrac = nextObjMovFracs[o.id];
            if (movFrac) {
                // TODO(@darzu): MUTATING WORLD POS. We probably shouldn't do that here
                vec3.sub(_collisionRefl, o._phys.lastWPos, o.world.position);
                vec3.scale(_collisionRefl, _collisionRefl, movFrac);
                vec3.add(o.world.position, o.world.position, _collisionRefl);
                // translate non-sweep AABBs
                // TODO(@darzu): update these the "right" way
                vec3.add(o._phys.worldAABB.min, o._phys.worldAABB.min, _collisionRefl);
                vec3.add(o._phys.worldAABB.max, o._phys.worldAABB.max, _collisionRefl);
                // track that movement occured
                anyMovement = true;
            }
            // record which objects moved from this iteration,
            // reset movement fractions for next iteration
            lastObjMovs[o.id] = !!nextObjMovFracs[o.id];
            nextObjMovFracs[o.id] = 0;
        }
        itr++;
    }
    // remember current state for next time
    for (let o of objs) {
        vec3.copy(o._phys.lastWPos, o.world.position);
        vec3.copy(o._phys.lastWorldAABB.min, o._phys.worldAABB.min);
        vec3.copy(o._phys.lastWorldAABB.max, o._phys.worldAABB.max);
    }
    // // copy out changes we made
    // for (let o of objs) {
    //   // TODO(@darzu): cache this inverse matrix?
    //   const oldWorldPos = vec3.transformMat4(
    //     tempVec(),
    //     [0, 0, 0],
    //     o.world.transform
    //   );
    //   const delta = vec3.sub(tempVec(), o.world.position, oldWorldPos);
    //   vec3.add(o.position, o.position, delta);
    //   // const worldInv = mat4.create();
    //   // mat4.invert(worldInv, o.world.transform);
    //   // const delta = vec3.create();
    //   // vec3.transformMat4(delta, o.world.position, worldInv);
    //   // vec3.add(o.position, o.position, delta);
    //   // TODO(@darzu):
    //   // vec3.copy(o.position, o.world.position);
    // }
    // update out checkRay function
    physicsResults.checkRay = (r) => {
        const motHits = motionCheckRay(r);
        const hits = [];
        for (let mh of motHits) {
            const o = EM.findEntity(mh.id, [PhysicsStateDef]);
            if (o) {
                const dist = rayHitDist(o._phys.worldAABB, r);
                if (!isNaN(dist))
                    hits.push({ id: o.id, dist });
            }
        }
        return hits;
    };
}
export function registerPhysicsInit(em) {
    em.addSingletonComponent(PhysicsResultsDef);
    em.registerSystem([ColliderDef], [], (objs) => {
        for (let o of objs)
            if (!PhysicsStateDef.isOn(o)) {
                const _phys = em.addComponent(o.id, PhysicsStateDef);
                // AABBs (collider derived)
                // TODO(@darzu): handle scale
                assert(o.collider.shape === "AABB", `Unimplemented collider shape: ${o.collider.shape}`);
                copyAABB(_phys.localAABB, o.collider.aabb);
                copyAABB(_phys.worldAABB, _phys.localAABB);
                copyAABB(_phys.sweepAABB, _phys.localAABB);
            }
    }, "physicsInit");
}
// ECS register
export function registerPhysicsContactSystems(em) {
    em.registerSystem([ColliderDef, PhysicsStateDef, WorldFrameDef], [PhysicsTimerDef], (objs, res) => {
        // TODO(@darzu): interestingly, this system doesn't need the step count
        if (res.physicsTimer.steps > 0) {
            stepConstraints(objs);
        }
    }, "physicsStepContact");
}
//# sourceMappingURL=phys_nonintersection.js.map