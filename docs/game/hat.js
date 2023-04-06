import { FinishedDef } from "../build.js";
import { ColliderDef } from "../physics/collider.js";
import { EM } from "../entity-manager.js";
import { vec3 } from "../gl-matrix.js";
import { HAT_OBJ, importObj, isParseError } from "../import_obj.js";
import { getAABBFromMesh, unshareProvokingVertices, } from "../mesh-pool.js";
import { AuthorityDef, MeDef, SyncDef } from "../net/components.js";
import { RenderableDef } from "../renderer.js";
import { PhysicsParentDef, PositionDef, RotationDef, } from "../physics/transform.js";
import { ColorDef } from "./game.js";
import { InteractingDef } from "./interact.js";
import { registerEventHandler, DetectedEventsDef } from "../net/events.js";
import { PlayerEntDef } from "./player.js";
import { InteractableDef } from "./interact.js";
export const HatDef = EM.defineComponent("hat", () => true);
export const HatConstructDef = EM.defineComponent("hatConstruct", (loc) => {
    return {
        loc: loc !== null && loc !== void 0 ? loc : vec3.create(),
    };
});
EM.registerSerializerPair(HatConstructDef, (c, buf) => {
    buf.writeVec3(c.loc);
}, (c, buf) => {
    buf.readVec3(c.loc);
});
let _hatMesh = undefined;
function getHatMesh() {
    if (!_hatMesh) {
        const hatRaw = importObj(HAT_OBJ);
        if (isParseError(hatRaw))
            throw hatRaw;
        const hat = unshareProvokingVertices(hatRaw);
        _hatMesh = hat;
    }
    return _hatMesh;
}
let _hatAABB = undefined;
function getHatAABB() {
    if (!_hatAABB) {
        _hatAABB = getAABBFromMesh(getHatMesh());
    }
    return _hatAABB;
}
function createHat(em, e, pid) {
    if (FinishedDef.isOn(e))
        return;
    const props = e.hatConstruct;
    if (!PositionDef.isOn(e))
        em.addComponent(e.id, PositionDef, props.loc);
    if (!RotationDef.isOn(e))
        em.addComponent(e.id, RotationDef);
    if (!ColorDef.isOn(e))
        em.addComponent(e.id, ColorDef, [0.4, 0.1, 0.1]);
    if (!PhysicsParentDef.isOn(e))
        em.addComponent(e.id, PhysicsParentDef);
    if (!RenderableDef.isOn(e))
        em.addComponent(e.id, RenderableDef, getHatMesh());
    if (!ColliderDef.isOn(e)) {
        const collider = em.addComponent(e.id, ColliderDef);
        collider.shape = "AABB";
        collider.solid = false;
        collider.aabb = getHatAABB();
    }
    if (!AuthorityDef.isOn(e))
        em.addComponent(e.id, AuthorityDef, pid);
    if (!SyncDef.isOn(e)) {
        const sync = em.addComponent(e.id, SyncDef);
        sync.fullComponents.push(HatConstructDef.id);
    }
    if (!HatDef.isOn(e)) {
        em.addComponent(e.id, HatDef);
    }
    em.ensureComponent(e.id, InteractableDef);
    em.addComponent(e.id, FinishedDef);
}
export function registerBuildHatSystem(em) {
    em.registerSystem([HatConstructDef], [MeDef], (hats, res) => {
        for (let s of hats)
            createHat(em, s, res.me.pid);
    }, "buildHats");
}
export function registerHatPickupSystem(em) {
    em.registerSystem([HatDef, InteractingDef], [DetectedEventsDef], (hats, resources) => {
        for (let { interacting, id } of hats) {
            let player = EM.findEntity(interacting.id, [PlayerEntDef]);
            if (player.player.hat === 0) {
                console.log("detecting pickup");
                resources.detectedEvents.push({
                    type: "hat-pickup",
                    entities: [player.id, id],
                    location: null,
                });
            }
            em.removeComponent(id, InteractingDef);
        }
    }, "hatPickup");
}
export function registerHatDropSystem(em) {
    em.registerSystem([PlayerEntDef, PositionDef, RotationDef], [DetectedEventsDef], (players, { detectedEvents }) => {
        for (let { player, id, position, rotation } of players) {
            // only drop a hat if we don't have a tool
            if (player.dropping && player.hat > 0 && player.tool === 0) {
                let dropLocation = vec3.fromValues(0, 0, -5);
                vec3.transformQuat(dropLocation, dropLocation, rotation);
                vec3.add(dropLocation, dropLocation, position);
                detectedEvents.push({
                    type: "hat-drop",
                    entities: [id, player.hat],
                    location: dropLocation,
                });
            }
        }
    }, "hatDrop");
}
registerEventHandler("hat-pickup", {
    eventAuthorityEntity: (entities) => entities[0],
    legalEvent: (em, entities) => {
        let player = em.findEntity(entities[0], [PlayerEntDef]);
        let hat = em.findEntity(entities[1], [InteractableDef]);
        return player !== undefined && hat !== undefined && player.player.hat === 0;
    },
    runEvent: (em, entities) => {
        let player = em.findEntity(entities[0], [PlayerEntDef]);
        let hat = em.findEntity(entities[1], [PositionDef, PhysicsParentDef]);
        hat.physicsParent.id = player.id;
        em.removeComponent(hat.id, InteractableDef);
        vec3.set(hat.position, 0, 1, 0);
        player.player.hat = hat.id;
    },
});
registerEventHandler("hat-drop", {
    eventAuthorityEntity: (entities) => entities[0],
    legalEvent: (em, entities) => {
        let player = em.findEntity(entities[0], [PlayerEntDef]);
        return player !== undefined && player.player.hat === entities[1];
    },
    runEvent: (em, entities, location) => {
        let player = em.findEntity(entities[0], [PlayerEntDef]);
        let hat = em.findEntity(entities[1], [PositionDef, PhysicsParentDef]);
        hat.physicsParent.id = 0;
        em.addComponent(hat.id, InteractableDef);
        vec3.copy(hat.position, location);
        player.player.hat = 0;
    },
});
//# sourceMappingURL=hat.js.map