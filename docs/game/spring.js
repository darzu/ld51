import { vec3 } from "../gl-matrix.js";
import { tempVec3 } from "../temp-pool.js";
import { EM } from "../entity-manager.js";
import { TimeDef } from "../time.js";
import { onInit } from "../init.js";
const EPSILON = 0.0000000000000000001;
const VELOCITY_CAP = 1;
let DEBUG = false;
function log(s) {
    if (DEBUG)
        console.log(s);
}
export var SpringType;
(function (SpringType) {
    SpringType[SpringType["DesiredLocation"] = 0] = "DesiredLocation";
    SpringType[SpringType["SimpleDistance"] = 1] = "SimpleDistance";
})(SpringType || (SpringType = {}));
export const SpringGridDef = EM.defineComponent("springGrid", (springType, rows, columns, fixed, distance, kOnAxis, kOffAxis) => {
    springType = springType || SpringType.SimpleDistance;
    rows = rows || 0;
    columns = columns || 0;
    fixed = fixed || [];
    distance = distance || 1;
    kOnAxis = kOnAxis || 5000;
    kOffAxis = kOffAxis || kOnAxis;
    const positions = [];
    const prevPositions = [];
    const nextPositions = [];
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
            let pos = vec3.fromValues(x * distance, y * distance, 0);
            positions.push(pos);
            prevPositions.push(vec3.clone(pos));
            nextPositions.push(vec3.create());
        }
    }
    const externalForce = vec3.create();
    const fixedSet = new Set(fixed);
    return {
        rows,
        columns,
        positions,
        prevPositions,
        nextPositions,
        fixed: fixedSet,
        distance,
        kOnAxis,
        kOffAxis,
        externalForce,
        springType,
    };
});
export const ForceDef = EM.defineComponent("force", (v) => v ?? vec3.create());
EM.registerSerializerPair(ForceDef, (f, buf) => buf.writeVec3(f), (f, buf) => buf.readVec3(f));
var Direction;
(function (Direction) {
    Direction[Direction["Up"] = 0] = "Up";
    Direction[Direction["Down"] = 1] = "Down";
    Direction[Direction["Left"] = 2] = "Left";
    Direction[Direction["Right"] = 3] = "Right";
})(Direction || (Direction = {}));
function neighbor(g, point, direction) {
    let x = point % g.columns;
    let y = (point - x) / g.columns;
    switch (direction) {
        case Direction.Up:
            y = y + 1;
            break;
        case Direction.Down:
            y = y - 1;
            break;
        case Direction.Left:
            x = x - 1;
            break;
        case Direction.Right:
            x = x + 1;
            break;
    }
    if (x >= 0 && x < g.columns && y >= 0 && y < g.rows) {
        return y * g.columns + x;
    }
    return null;
}
function targetLocation(g, neighbor, inDirection, out) {
    vec3.copy(out, g.positions[neighbor]);
    switch (inDirection) {
        case Direction.Up:
            out[1] = out[1] - g.distance;
            break;
        case Direction.Down:
            out[1] = out[1] + g.distance;
            break;
        case Direction.Left:
            out[0] = out[0] + g.distance;
            break;
        case Direction.Right:
            out[0] = out[0] - g.distance;
            break;
    }
}
function addSpringForce(g, point, force) {
    const distanceVec = tempVec3();
    let directions = [
        Direction.Up,
        Direction.Down,
        Direction.Left,
        Direction.Right,
    ];
    let neighbors = directions
        .map((d) => [d, neighbor(g, point, d)])
        .filter(([d, o]) => o !== null);
    for (let [direction, o] of neighbors) {
        log(`spring force on ${point}`);
        switch (g.springType) {
            case SpringType.SimpleDistance:
                vec3.sub(distanceVec, g.positions[point], g.positions[o]);
                let distance = vec3.length(distanceVec);
                vec3.normalize(distanceVec, distanceVec);
                vec3.scale(distanceVec, distanceVec, g.kOnAxis * (g.distance - distance));
                break;
            case SpringType.DesiredLocation:
                targetLocation(g, o, direction, distanceVec);
                log("vectors");
                log(distanceVec);
                log(g.positions[point]);
                vec3.sub(distanceVec, distanceVec, g.positions[point]);
                // distanceVec now stores the vector between this point and
                // where it "should" be as far as this neighbor is concerned.  We
                // want to apply a restoring force to try to get it back to that
                // position.
                switch (direction) {
                    case Direction.Up:
                    case Direction.Down:
                        distanceVec[0] = distanceVec[0] * g.kOffAxis;
                        distanceVec[1] = distanceVec[1] * g.kOnAxis;
                        break;
                    case Direction.Left:
                    case Direction.Right:
                        distanceVec[0] = distanceVec[0] * g.kOnAxis;
                        distanceVec[1] = distanceVec[1] * g.kOffAxis;
                }
                distanceVec[2] = distanceVec[2] * g.kOffAxis;
        }
        vec3.scale(distanceVec, distanceVec, 1.0 / neighbors.length);
        vec3.add(force, force, distanceVec);
    }
}
export function stepSprings(g, dt) {
    dt = dt / 1000;
    const forceVec = tempVec3();
    const velocityVec = tempVec3();
    for (let point = 0; point < g.rows * g.columns; point++) {
        vec3.copy(g.nextPositions[point], g.positions[point]);
        if (g.fixed.has(point)) {
            log(`${point} fixed`);
            continue;
        }
        vec3.sub(velocityVec, g.positions[point], g.prevPositions[point]);
        vec3.scale(velocityVec, velocityVec, dt);
        //console.log("applying a force");
        vec3.copy(forceVec, g.externalForce);
        // console.log(`externalForce: ${vec3Dbg(forceVec)}`); // TODO(@darzu):
        addSpringForce(g, point, forceVec);
        vec3.scale(forceVec, forceVec, dt * dt);
        if (vec3.length(velocityVec) > EPSILON) {
            vec3.add(g.nextPositions[point], g.nextPositions[point], velocityVec);
        }
        if (vec3.length(forceVec) > EPSILON) {
            vec3.add(g.nextPositions[point], g.nextPositions[point], forceVec);
        }
        // vec3.add(g.velocities[point], g.velocities[point], forceVec);
        // const speed = vec3.length(g.velocities[point]);
        // if (speed > VELOCITY_CAP) {
        //   console.log("scaling velocity");
        //   vec3.scale(
        //     g.velocities[point],
        //     g.velocities[point],
        //     VELOCITY_CAP / speed
        //   );
    }
    for (let point = 0; point < g.rows * g.columns; point++) {
        vec3.copy(g.prevPositions[point], g.positions[point]);
        vec3.copy(g.positions[point], g.nextPositions[point]);
    }
}
export function callSpringSystems(em) {
    em.callSystem("spring");
}
onInit((em) => {
    em.registerSystem([SpringGridDef, ForceDef], [TimeDef], (springs, res) => {
        for (let { springGrid, force } of springs) {
            vec3.copy(springGrid.externalForce, force);
            stepSprings(springGrid, res.time.dt);
        }
    }, "spring");
});
//# sourceMappingURL=spring.js.map