import { FinishedDef } from "./build.js";
import { EM, } from "./entity-manager.js";
import { AuthorityDef, MeDef, SyncDef } from "./net/components.js";
import { assert } from "./test.js";
import { capitalize } from "./util.js";
export function defineSerializableComponent(em, name, construct, serialize, deserialize) {
    const def = em.defineComponent(name, construct);
    em.registerSerializerPair(def, serialize, deserialize);
    return def;
}
function registerConstructorSystem(em, def, rs, callback) {
    em.registerSystem([def], rs, (es, res) => {
        for (let e of es) {
            if (FinishedDef.isOn(e))
                continue;
            callback(e, res);
            em.ensureComponentOn(e, FinishedDef);
        }
    }, `${def.name}Build`);
    return callback;
    // console.log(`reg ${def.name}Build`);
}
// TODO(@darzu): what happens if build() is async???!
export function defineNetEntityHelper(em, opts) {
    const propsDef = defineSerializableComponent(em, `${opts.name}Props`, opts.defaultProps, opts.serializeProps, opts.deserializeProps);
    const localDef = em.defineComponent(`${opts.name}Local`, opts.defaultLocal);
    const constructFn = registerConstructorSystem(em, propsDef, [...opts.buildResources, MeDef], (e, res) => {
        // TYPE HACK
        const me = res.me;
        em.ensureComponentOn(e, AuthorityDef, me.pid);
        em.ensureComponentOn(e, localDef);
        em.ensureComponentOn(e, SyncDef);
        e.sync.fullComponents = [propsDef.id];
        e.sync.dynamicComponents = opts.dynamicComponents.map((d) => d.id);
        for (let d of opts.dynamicComponents)
            em.ensureComponentOn(e, d);
        // TYPE HACK
        const _e = e;
        opts.build(_e, res);
    });
    const createNew = (...args) => {
        const e = em.newEntity();
        em.ensureComponentOn(e, propsDef, ...args);
        return e;
    };
    const createNewNow = (res, ...args) => {
        const e = em.newEntity();
        em.ensureComponentOn(e, propsDef, ...args);
        // TODO(@darzu): maybe we should force users to give us the MeDef? it's probably always there tho..
        // TODO(@darzu): Think about what if buid() is async...
        constructFn(e, res);
        em.ensureComponentOn(e, FinishedDef);
        return e;
    };
    const capitalizedN = capitalize(opts.name);
    const result = {
        [`${capitalizedN}PropsDef`]: propsDef,
        [`${capitalizedN}LocalDef`]: localDef,
        [`create${capitalizedN}`]: createNew,
        [`create${capitalizedN}Now`]: createNewNow,
    };
    // TYPE HACK: idk how to make Typscript accept this...
    return result;
}
export function createRef(idOrE, cs) {
    if (typeof idOrE === "number") {
        if (idOrE <= 0) {
            const thunk = () => undefined;
            thunk.id = idOrE;
            return thunk;
        }
        else {
            let found;
            assert(!!cs, "Ref must be given ComponentDef witnesses w/ id");
            const thunk = () => {
                if (!found)
                    found = EM.findEntity(idOrE, cs);
                return found;
            };
            thunk.id = idOrE;
            return thunk;
        }
    }
    else {
        const thunk = () => idOrE;
        thunk.id = idOrE.id;
        return thunk;
    }
}
