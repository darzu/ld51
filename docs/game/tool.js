import { ColliderDef } from "../physics/collider.js";
import { EM } from "../entity-manager.js";
import { vec3 } from "../gl-matrix.js";
import { PhysicsParentDef, PositionDef, RotationDef, ScaleDef, } from "../physics/transform.js";
import { registerEventHandler, DetectedEventsDef } from "../net/events.js";
import { LocalPlayerDef, PlayerDef } from "./player.js";
import { InteractableDef, InRangeDef } from "./interact.js";
export const ToolDef = EM.defineComponent("tool", (type) => ({
    type,
}));
export function registerToolSystems(em) {
    em.registerSystem([ToolDef, InRangeDef], [DetectedEventsDef, LocalPlayerDef], (hats, resources) => {
        for (let { id } of hats) {
            let player = EM.findEntity(resources.localPlayer.playerId, [
                PlayerDef,
            ]);
            if (player.player.tool === 0 && player.player.interacting) {
                resources.detectedEvents.raise({
                    type: "tool-pickup",
                    entities: [player.id, id],
                    extra: null,
                });
            }
        }
    }, "toolPickup");
    em.registerSystem([PlayerDef, PositionDef, RotationDef], [DetectedEventsDef], (players, { detectedEvents }) => {
        for (let { player, id, position, rotation } of players) {
            if (player.dropping && player.tool > 0) {
                let dropLocation = vec3.fromValues(0, 0, -5);
                vec3.transformQuat(dropLocation, dropLocation, rotation);
                vec3.add(dropLocation, dropLocation, position);
                detectedEvents.raise({
                    type: "tool-drop",
                    entities: [id, player.tool],
                    extra: dropLocation,
                });
            }
        }
    }, "toolDrop");
    registerEventHandler("tool-pickup", {
        entities: [
            [PlayerDef],
            [InteractableDef, PositionDef, PhysicsParentDef],
        ],
        eventAuthorityEntity: ([playerId, toolId]) => playerId,
        legalEvent: (em, [player, tool]) => {
            return player.player.tool === 0;
        },
        runEvent: (em, [player, tool]) => {
            tool.physicsParent.id = player.id;
            // TODO(@darzu): add interact box
            // em.removeComponent(tool.id, InteractableDef);
            vec3.set(tool.position, 0, 0, -1.5);
            em.ensureComponentOn(tool, ScaleDef);
            vec3.copy(tool.scale, [0.5, 0.5, 0.5]);
            player.player.tool = tool.id;
            if (ColliderDef.isOn(tool))
                tool.collider.solid = false;
        },
    });
    registerEventHandler("tool-drop", {
        entities: [[PlayerDef], [PositionDef, PhysicsParentDef]],
        eventAuthorityEntity: ([playerId, toolId]) => playerId,
        legalEvent: (em, [player, tool]) => {
            return player.player.tool === tool.id;
        },
        runEvent: (em, [player, tool], location) => {
            tool.physicsParent.id = 0;
            // TODO(@darzu): add interact box
            // em.addComponent(tool.id, InteractableDef);
            vec3.copy(tool.position, location);
            em.ensureComponentOn(tool, ScaleDef);
            vec3.copy(tool.scale, [1, 1, 1]);
            player.player.tool = 0;
            if (ColliderDef.isOn(tool))
                tool.collider.solid = true;
        },
        serializeExtra: (buf, location) => {
            buf.writeVec3(location);
        },
        deserializeExtra: (buf) => {
            return buf.readVec3();
        },
    });
}
//# sourceMappingURL=tool.js.map