"use strict";
function BuildUnaryRelation() {
    return (key) => {
        const storage = [];
        const has = (e) => e.id in storage;
        const get = (e) => storage[e.id][1];
        const set = (v, e) => storage[e.id] = [e, v];
        const members = () => storage;
        const del = (e) => delete storage[e.id];
        return {
            key,
            arity: 1,
            has,
            get,
            set,
            del,
            members
        };
    };
}
function BuildBinaryRelation() {
    return (key) => {
        const storage = [];
        const idToIndices = [];
        function* allMatches(a, b) {
            const bMap = {};
            b.forEach(i => bMap[i] = true);
            for (let i of a)
                if (bMap[i])
                    yield i;
        }
        function firstMatch(a, b) {
            for (let i of allMatches(a, b))
                return i;
            return null;
        }
        const getIdx = (e1, e2) => {
            const e1Ids = idToIndices[e1.id];
            const e2Ids = idToIndices[e2.id];
            const id = firstMatch(e1Ids, e2Ids);
            return id;
        };
        const has = (e1, e2) => {
            return getIdx(e1, e2) !== null;
        };
        const get = (e1, e2) => {
            const idx = getIdx(e1, e2);
            if (idx === null)
                return null;
            return storage[idx][2];
        };
        const set = (v, e1, e2) => {
            var _a;
            const idx = (_a = getIdx(e1, e2)) !== null && _a !== void 0 ? _a : storage.length;
            storage[idx] = [e1, e2, v];
        };
        const members = () => {
            return storage;
        };
        const del = (e1, e2) => {
            const e1Ids = idToIndices[e1.id];
            const e2Ids = idToIndices[e2.id];
            let idsToRemove = [];
            for (let id of allMatches(e1Ids, e2Ids)) {
                idsToRemove.push(id);
            }
            for (let id of idsToRemove) {
                e1Ids.splice(e1Ids.indexOf(id));
                e2Ids.splice(e2Ids.indexOf(id));
                delete storage[id];
            }
        };
        return {
            key,
            arity: 2,
            has,
            get,
            set,
            del,
            members
        };
    };
}
function MakeAtomFn(relation) {
    return (...terms) => ({
        terms,
        relation
    });
}
function DefineComponent(relation) {
    const res = MakeAtomFn(relation);
    return Object.assign(res, { relation });
}
function With(a, ...q) {
    // TODO(@darzu): do this without cast?
    return q.map(fn => fn(a));
}
function When(query, cb) {
    // TODO: impl
}
// TESTS
{
    const Colliding = DefineComponent(BuildBinaryRelation()("colliding"));
    const Player = DefineComponent(BuildUnaryRelation()("player"));
    const Pizza = DefineComponent(BuildUnaryRelation()("pizza"));
    const Position = DefineComponent(BuildUnaryRelation()("position"));
    const Velocity = DefineComponent(BuildUnaryRelation()("velocity"));
    const Sprite = [Position, Velocity];
    When([
        Colliding("x", "y"),
        // ...With("y", Pizza, Position),
        ...With("x", Player, ...Sprite),
        Pizza("y"),
        // Player("x"),
        Position("y"),
        // Food("y"),
    ], ({ x, y }) => {
        console.log(x.colliding);
        console.log(y.colliding);
        console.log(y.pizza);
        console.log(y.position);
        console.log(x.velocity);
        // console.log(y.food)
    });
    const EgColliding = Colliding("z", "w");
}
//# sourceMappingURL=ecs.js.map