import { DBG_ASSERT } from "./flags.js";
import { assert, assertDbg, hashCode } from "./util.js";
function isOneShotSystem(s) {
    return "e" in s;
}
function nameToId(name) {
    return hashCode(name);
}
export class EntityManager {
    constructor() {
        this.entities = new Map();
        this.systems = new Map();
        this.systemsById = new Map();
        this.oneShotSystems = new Map();
        this.components = new Map();
        this.serializers = new Map();
        this.ranges = {};
        this.defaultRange = "";
        this.sysStats = {};
        this.globalStats = {
            // time spent maintaining the query caches
            queryCacheTime: 0, // TODO(@darzu): IMPL
        };
        this.loops = 0;
        // TODO(@darzu): PERF. maybe the entities list should be maintained sorted. That
        //    would make certain scan operations (like updating them on component add/remove)
        //    cheaper. And perhaps better gameplay code too.
        this._systemsToEntities = new Map();
        this._entitiesToSystems = new Map(); // TODO(@darzu): IMPL
        this._systemsToComponents = new Map();
        this._componentToSystems = new Map();
        this._nextSystemId = 1;
        this.nextOneShotSuffix = 0;
        this.entities.set(0, { id: 0 });
        // TODO(@darzu): maintain _entitiesToSystems for ent 0?
    }
    defineComponent(name, construct) {
        const id = nameToId(name);
        if (this.components.has(id)) {
            throw `Component with name ${name} already defined--hash collision?`;
        }
        const component = {
            name,
            construct,
            id,
            isOn: (e) => name in e,
        };
        this.components.set(id, component);
        return component;
    }
    checkComponent(def) {
        if (!this.components.has(def.id))
            throw `Component ${def.name} (id ${def.id}) not found`;
        if (this.components.get(def.id).name !== def.name)
            throw `Component id ${def.id} has name ${this.components.get(def.id).name}, not ${def.name}`;
    }
    registerSerializerPair(def, serialize, deserialize) {
        this.serializers.set(def.id, { serialize, deserialize });
    }
    serialize(id, componentId, buf) {
        const def = this.components.get(componentId);
        if (!def)
            throw `Trying to serialize unknown component id ${componentId}`;
        const entity = this.findEntity(id, [def]);
        if (!entity)
            throw `Trying to serialize component ${def.name} on entity ${id}, which doesn't have it`;
        const serializerPair = this.serializers.get(componentId);
        if (!serializerPair)
            throw `No serializer for component ${def.name} (for entity ${id})`;
        serializerPair.serialize(entity[def.name], buf);
    }
    deserialize(id, componentId, buf) {
        const def = this.components.get(componentId);
        if (!def)
            throw `Trying to deserialize unknown component id ${componentId}`;
        if (!this.hasEntity(id)) {
            throw `Trying to deserialize component ${def.name} of unknown entity ${id}`;
        }
        let entity = this.findEntity(id, [def]);
        let component;
        // TODO: because of this usage of dummy, deserializers don't
        // actually need to read buf.dummy
        if (buf.dummy) {
            component = {};
        }
        else if (!entity) {
            component = this.addComponent(id, def);
        }
        else {
            component = entity[def.name];
        }
        const serializerPair = this.serializers.get(componentId);
        if (!serializerPair)
            throw `No deserializer for component ${def.name} (for entity ${id})`;
        serializerPair.deserialize(component, buf);
    }
    setDefaultRange(rangeName) {
        this.defaultRange = rangeName;
    }
    setIdRange(rangeName, nextId, maxId) {
        this.ranges[rangeName] = { nextId, maxId };
    }
    // TODO(@darzu): dont return the entity!
    newEntity(rangeName) {
        if (rangeName === undefined)
            rangeName = this.defaultRange;
        const range = this.ranges[rangeName];
        if (!range) {
            throw `Entity manager has no ID range (range specifier is ${rangeName})`;
        }
        if (range.nextId >= range.maxId)
            throw `EntityManager has exceeded its id range!`;
        const e = { id: range.nextId++ };
        if (e.id > 2 ** 15)
            console.warn(`We're halfway through our local entity ID space! Physics assumes IDs are < 2^16`);
        this.entities.set(e.id, e);
        this._entitiesToSystems.set(e.id, []);
        return e;
    }
    registerEntity(id) {
        assert(!this.entities.has(id), `EntityManager already has id ${id}!`);
        /* TODO: should we do the check below but for all ranges?
        if (this.nextId <= id && id < this.maxId)
        throw `EntityManager cannot register foreign ids inside its local range; ${this.nextId} <= ${id} && ${id} < ${this.maxId}!`;
        */
        const e = { id: id };
        this.entities.set(e.id, e);
        this._entitiesToSystems.set(e.id, []);
        return e;
    }
    // TODO(@darzu): hacky, special components
    isDeletedE(e) {
        return "deleted" in e;
    }
    isDeadE(e) {
        return "dead" in e;
    }
    isDeadC(e) {
        return "dead" === e.name;
    }
    addComponent(id, def, ...args) {
        this.checkComponent(def);
        if (id === 0)
            throw `hey, use addSingletonComponent!`;
        const c = def.construct(...args);
        const e = this.entities.get(id);
        // TODO: this is hacky--EM shouldn't know about "deleted"
        if (DBG_ASSERT && this.isDeletedE(e)) {
            console.error(`Trying to add component ${def.name} to deleted entity ${id}`);
        }
        if (def.name in e)
            throw `double defining component ${def.name} on ${e.id}!`;
        e[def.name] = c;
        // update query caches
        // TODO(@darzu): PERF. need to measure time spent maintaining these caches.
        // TODO(@darzu): IMPL dead
        const eSystems = this._entitiesToSystems.get(e.id);
        if (this.isDeadC(def)) {
            // remove from every current system
            eSystems.forEach((s) => {
                const es = this._systemsToEntities.get(s);
                // TODO(@darzu): perf. sorted removal
                const indx = es.findIndex((v) => v.id === id);
                if (indx >= 0)
                    es.splice(indx, 1);
            });
            eSystems.length = 0;
        }
        const systems = this._componentToSystems.get(def.name);
        for (let sysId of systems ?? []) {
            const allNeededCs = this._systemsToComponents.get(sysId);
            if (allNeededCs?.every((n) => n in e)) {
                // TODO(@darzu): perf. sorted insert
                this._systemsToEntities.get(sysId).push(e);
                eSystems.push(sysId);
            }
        }
        return c;
    }
    addComponentByName(id, name, ...args) {
        console.log("addComponentByName called, should only be called for debugging");
        let component = this.components.get(nameToId(name));
        if (!component) {
            throw `no component named ${name}`;
        }
        return this.addComponent(id, component, ...args);
    }
    ensureComponent(id, def, ...args) {
        this.checkComponent(def);
        const e = this.entities.get(id);
        const alreadyHas = def.name in e;
        if (!alreadyHas) {
            return this.addComponent(id, def, ...args);
        }
        else {
            return e[def.name];
        }
    }
    // TODO(@darzu): do we want to make this the standard way we do ensureComponent and addComponent ?
    ensureComponentOn(e, def, ...args) {
        const alreadyHas = def.name in e;
        if (!alreadyHas) {
            this.addComponent(e.id, def, ...args);
        }
    }
    addSingletonComponent(def, ...args) {
        this.checkComponent(def);
        const c = def.construct(...args);
        const e = this.entities.get(0);
        if (def.name in e)
            throw `double defining singleton component ${def.name} on ${e.id}!`;
        e[def.name] = c;
        return c;
    }
    ensureSingletonComponent(def, ...args) {
        this.checkComponent(def);
        const e = this.entities.get(0);
        const alreadyHas = def.name in e;
        if (!alreadyHas) {
            return this.addSingletonComponent(def, ...args);
        }
        else {
            return e[def.name];
        }
    }
    removeSingletonComponent(def) {
        const e = this.entities.get(0);
        if (def.name in e) {
            delete e[def.name];
        }
        else {
            throw `Tried to remove absent singleton component ${def.name}`;
        }
    }
    // TODO(@darzu): should this be public??
    // TODO(@darzu): rename to findSingletonComponent
    getResource(c) {
        const e = this.entities.get(0);
        if (c.name in e) {
            return e[c.name];
        }
        return undefined;
    }
    getResources(rs) {
        const e = this.entities.get(0);
        if (rs.every((r) => r.name in e))
            return e;
        return undefined;
    }
    hasEntity(id) {
        return this.entities.has(id);
    }
    removeComponent(id, def) {
        if (!this.tryRemoveComponent(id, def))
            throw `Tried to remove absent component ${def.name} from entity ${id}`;
    }
    tryRemoveComponent(id, def) {
        const e = this.entities.get(id);
        if (def.name in e) {
            delete e[def.name];
        }
        else {
            return false;
        }
        // update query cache
        const systems = this._componentToSystems.get(def.name);
        for (let name of systems ?? []) {
            const es = this._systemsToEntities.get(name);
            if (es) {
                // TODO(@darzu): perf. sorted removal
                const indx = es.findIndex((v) => v.id === id);
                if (indx >= 0) {
                    es.splice(indx, 1);
                }
            }
        }
        if (this.isDeadC(def)) {
            const eSystems = this._entitiesToSystems.get(id);
            eSystems.length = 0;
            for (let sysId of this.systemsById.keys()) {
                const allNeededCs = this._systemsToComponents.get(sysId);
                if (allNeededCs?.every((n) => n in e)) {
                    // TODO(@darzu): perf. sorted insert
                    this._systemsToEntities.get(sysId).push(e);
                    eSystems.push(sysId);
                }
            }
        }
        return true;
    }
    keepOnlyComponents(id, cs) {
        let ent = this.entities.get(id);
        if (!ent)
            throw `Tried to delete non-existent entity ${id}`;
        for (let component of this.components.values()) {
            if (!cs.includes(component) && ent[component.name]) {
                this.removeComponent(id, component);
            }
        }
    }
    hasComponents(e, cs) {
        return cs.every((c) => c.name in e);
    }
    findEntity(id, cs) {
        const e = this.entities.get(id);
        if (!e || !cs.every((c) => c.name in e)) {
            return undefined;
        }
        return e;
    }
    findEntitySet(es) {
        const res = [];
        for (let [id, ...cs] of es) {
            res.push(this.findEntity(id, cs));
        }
        return res;
    }
    // TODO(@darzu): PERF. cache these responses like we do systems?
    // TODO(@darzu): PERF. evaluate all per-frame uses of this
    filterEntities(cs) {
        const res = [];
        if (cs === null)
            return res;
        const inclDead = cs.some((c) => this.isDeadC(c)); // TODO(@darzu): HACK? for DeadDef
        for (let e of this.entities.values()) {
            if (!inclDead && this.isDeadE(e))
                continue;
            if (e.id === 0)
                continue; // TODO(@darzu): Entity 0 needs to be fixed..
            if (cs.every((c) => c.name in e)) {
                res.push(e);
            }
            else {
                // TODO(@darzu): easier way to help identify these errors?
                // console.log(
                //   `${e.id} is missing ${cs
                //     .filter((c) => !(c.name in e))
                //     .map((c) => c.name)
                //     .join(".")}`
                // );
            }
        }
        return res;
    }
    dbgFilterEntitiesByKey(cs) {
        // TODO(@darzu): respect "DeadDef" comp ?
        console.log("filterEntitiesByKey called--should only be called from console");
        const res = [];
        if (typeof cs === "string")
            cs = [cs];
        for (let e of this.entities.values()) {
            if (cs.every((c) => c in e)) {
                res.push(e);
            }
            else {
                // TODO(@darzu): easier way to help identify these errors?
                // console.log(
                //   `${e.id} is missing ${cs
                //     .filter((c) => !(c.name in e))
                //     .map((c) => c.name)
                //     .join(".")}`
                // );
            }
        }
        return res;
    }
    registerSystem(cs, rs, callback, name) {
        name = name || callback.name;
        if (name === "") {
            throw new Error(`To define a system with an anonymous function, pass an explicit name`);
        }
        if (this.systems.has(name))
            throw `System named ${name} already defined. Try explicitly passing a name`;
        const id = this._nextSystemId;
        this._nextSystemId += 1;
        const sys = {
            cs,
            rs,
            callback,
            name,
            id,
        };
        this.systems.set(name, sys);
        this.systemsById.set(id, sys);
        this.sysStats[name] = {
            calls: 0,
            queries: 0,
            callTime: 0,
            maxCallTime: 0,
            queryTime: 0,
        };
        // update query cache:
        //  pre-compute entities for this system for quicker queries; these caches will be maintained
        //  by add/remove/ensure component calls
        // TODO(@darzu): ability to toggle this optimization on/off for better debugging
        const es = this.filterEntities(cs);
        this._systemsToEntities.set(id, [...es]);
        if (cs) {
            for (let c of cs) {
                if (!this._componentToSystems.has(c.name))
                    this._componentToSystems.set(c.name, [id]);
                else
                    this._componentToSystems.get(c.name).push(id);
            }
            this._systemsToComponents.set(id, cs.map((c) => c.name));
        }
        for (let e of es) {
            const ss = this._entitiesToSystems.get(e.id);
            assertDbg(ss);
            ss.push(id);
        }
    }
    whenResources(...rs) {
        return this.whenEntityHas(this.entities.get(0), ...rs);
    }
    hasSystem(name) {
        return this.systems.has(name);
    }
    callSystem(name) {
        // TODO(@darzu):
        // if (name.endsWith("Build")) console.log(`calling ${name}`);
        // if (name == "groundPropsBuild") console.log("calling groundPropsBuild");
        const s = this.systems.get(name);
        if (!s)
            throw `No system named ${name}`;
        let start = performance.now();
        // try looking up in the query cache
        let es;
        if (s.cs) {
            assertDbg(this._systemsToEntities.has(s.id), `System ${s.name} doesn't have a query cache!`);
            es = this._systemsToEntities.get(s.id);
        }
        else {
            es = [];
        }
        // TODO(@darzu): uncomment to debug query cache issues
        // es = this.filterEntities(s.cs);
        const rs = this.getResources(s.rs); // TODO(@darzu): remove allocs here
        let afterQuery = performance.now();
        this.sysStats[s.name].queries++;
        this.sysStats[s.name].queryTime += afterQuery - start;
        if (rs) {
            s.callback(es, rs);
            let afterCall = performance.now();
            this.sysStats[s.name].calls++;
            const thisCallTime = afterCall - afterQuery;
            this.sysStats[s.name].callTime += thisCallTime;
            this.sysStats[s.name].maxCallTime = Math.max(this.sysStats[s.name].maxCallTime, thisCallTime);
        }
    }
    callOneShotSystems() {
        const beforeOneShots = performance.now();
        let calledSystems = new Set();
        this.oneShotSystems.forEach((s) => {
            if (!s.cs.every((c) => c.name in s.e))
                return;
            const afterOneShotQuery = performance.now();
            const stats = this.sysStats["__oneShots"];
            stats.queries += 1;
            stats.queryTime += afterOneShotQuery - beforeOneShots;
            calledSystems.add(s.name);
            // TODO(@darzu): how to handle async callbacks and their timing?
            s.callback(s.e);
            const afterOneShotCall = performance.now();
            stats.calls += 1;
            const thisCallTime = afterOneShotCall - afterOneShotQuery;
            stats.callTime += thisCallTime;
            stats.maxCallTime = Math.max(stats.maxCallTime, thisCallTime);
        });
        for (let name of calledSystems) {
            this.oneShotSystems.delete(name);
        }
    }
    // TODO(@darzu): good or terrible name?
    whyIsntSystemBeingCalled(name) {
        // TODO(@darzu): more features like check against a specific set of entities
        const sys = this.systems.get(name) ?? this.oneShotSystems.get(name);
        if (!sys) {
            console.warn(`No systems found with name: '${name}'`);
            return;
        }
        let haveAllResources = true;
        if (!isOneShotSystem(sys)) {
            for (let _r of sys.rs) {
                let r = _r;
                if (!this.getResource(r)) {
                    console.warn(`System '${name}' missing resource: ${r.name}`);
                    haveAllResources = false;
                }
            }
        }
        const es = this.filterEntities(sys.cs);
        console.warn(`System '${name}' matches ${es.length} entities and has all resources: ${haveAllResources}.`);
    }
    // TODO(@darzu): Rethink naming here
    // NOTE: if you're gonna change the types, change registerSystem first and just copy
    //  them down to here
    whenEntityHas(e, ...cs) {
        // short circuit if we already have the components
        if (cs.every((c) => c.name in e))
            return Promise.resolve(e);
        // TODO(@darzu): this is too copy-pasted from registerSystem
        // TODO(@darzu): need unified query maybe?
        let _name = "oneShot" + this.nextOneShotSuffix++;
        if (this.oneShotSystems.has(_name))
            throw `One-shot single system named ${_name} already defined.`;
        // use one bucket for all one shots. Change this if we want more granularity
        this.sysStats["__oneShots"] = this.sysStats["__oneShots"] ?? {
            calls: 0,
            queries: 0,
            callTime: 0,
            maxCallTime: 0,
            queryTime: 0,
        };
        return new Promise((resolve, reject) => {
            const sys = {
                e,
                cs,
                callback: resolve,
                name: _name,
            };
            this.oneShotSystems.set(_name, sys);
        });
    }
}
// TODO(@darzu): where to put this?
export const EM = new EntityManager();
//# sourceMappingURL=entity-manager.js.map