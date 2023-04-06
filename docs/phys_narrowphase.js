// TODO(@darzu): box vs box collision testing
// https://www.youtube.com/watch?v=ajv46BSqcK4
import { vec3 } from "./gl-matrix.js";
function doesOverlap(a, b) {
    // TODO(@darzu): implement
    //
}
function points(c) {
    const m = vec3.add(vec3.create(), c.motion.location, c.collider.center);
    const s = c.collider.halfsize;
    return [
        vec3.fromValues(m[0] - s[0], m[1] - s[1], m[2] - s[2]),
        vec3.fromValues(m[0] - s[0], m[1] - s[1], m[2] + s[2]),
        vec3.fromValues(m[0] - s[0], m[1] + s[1], m[2] - s[2]),
        vec3.fromValues(m[0] - s[0], m[1] + s[1], m[2] + s[2]),
        vec3.fromValues(m[0] + s[0], m[1] - s[1], m[2] - s[2]),
        vec3.fromValues(m[0] + s[0], m[1] - s[1], m[2] + s[2]),
        vec3.fromValues(m[0] + s[0], m[1] + s[1], m[2] - s[2]),
        vec3.fromValues(m[0] + s[0], m[1] + s[1], m[2] + s[2]),
    ];
}
// returns the point on shape which has the highest dot product with d
function support(c, d) {
    return supportInternal(points(c), d);
}
function supportInternal(points, d) {
    let max = -Infinity;
    let maxP = null;
    for (let p of points) {
        const n = vec3.dot(p, d);
        if (n > max) {
            max = n;
            maxP = p;
        }
    }
    return maxP;
}
function nearestSimplex(s) {
    // 
    throw 'TODO';
}
function moveSimplexToward(s, d, newP) {
    const farthest = supportInternal(s, vec3.negate(vec3.create(), d));
    return [...s, newP].filter(p => p !== farthest);
}
function hasOrigin(s) {
    // TODO(@darzu): 
    // can only be in regions R_ab, R_abc, and R_ac if "a" is the newest point
    // dir_ab = (AC x AB) x AB
    //  if dir_ab * AO > 0, origin is in R_ab, remove c, D = R_ab
    throw `TODO`;
}
function nextDir(s) {
    throw `TODO`;
}
// initial dir: vec between the two centers of the shapes (normalized)
function gjk(p, q, d) {
    // https://en.wikipedia.org/wiki/Gilbert–Johnson–Keerthi_distance_algorithm
    let A = vec3.sub(vec3.create(), support(p, d), support(q, vec3.negate(vec3.create(), d)));
    let s = [A, A, A, A];
    let D = vec3.negate(vec3.create(), A);
    // TODO(@darzu): max itrs?
    while (true) {
        A = vec3.sub(vec3.create(), support(p, D), support(q, vec3.negate(vec3.create(), D)));
        if (vec3.dot(A, D) < 0)
            return false;
        s = moveSimplexToward(s, D, A);
        if (hasOrigin(s))
            return true;
        D = nextDir(s);
    }
}
function handleSimplex(s, d) {
    if (s.length === 2)
        return lineCase(s, d);
    return triangleCase(s, d);
}
function lineCase(s, d) {
    let [B, A] = s;
    AB = B - A;
    AO = O - A;
    // TODO(@darzu): what does the triple product mean?
    ABPerp = tripleProd(AB, AO, AB);
    newD = ABPerp;
    return false;
}
function triangleCase(s, d) {
    let [C, B, A] = s;
    AB = B - A;
    AC = C - A;
    AO = O - A;
    ABPerp = tripleProd(AC, AB, AB);
    ACPerp = tripleProd(AB, AC, AC);
    if (dot(ABPerp, AO) > 0) {
        s.remove(C);
        newD = ABPerp;
        return false;
    }
    else if (dot(ACPerp, AO) > 0) {
        s.remove(B);
        newD = ACPerp;
        return false;
    }
    return true;
}
// TODO(@darzu): GJK should tell u distance between objects
/*
from Godot:
    collision_layer
        This describes the layers that the object appears in. By default, all bodies are on layer 1.
    collision_mask
        This describes what layers the body will scan for collisions. If an object isn't in one of the mask layers, the body will ignore it. By default, all bodies scan layer 1.

sprig:
    objects can have 0 or 1 collider
    this collider can either participate in physics constraints or not
    either way, it will generate collision events
    if you need multiple colliders per object, either:
    - have one or more child objects (positioned relative to u) w/ a different collider
    - use a union composite collider type that is just one collider built out of the union of multiple other colliders (e.g. the ship)


*/
//# sourceMappingURL=phys_narrowphase.js.map