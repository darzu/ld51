import { DeletedDef } from "../delete.js";
import { EM } from "../entity-manager.js";
import { quat, vec3 } from "../gl-matrix.js";
import { LinearVelocityDef } from "../physics/motion.js";
import { WorldFrameDef } from "../physics/nonintersection.js";
import { PhysicsParentDef, PositionDef, RotationDef, } from "../physics/transform.js";
import { GameState, GameStateDef } from "./gamestate.js";
import { GroundSystemDef } from "./ground.js";
import { LifetimeDef } from "./lifetime.js";
import { PlayerDef } from "./player.js";
import { CameraDef } from "../camera.js";
import { createShip, ShipLocalDef, ShipPropsDef } from "./ship.js";
export function registerRestartSystem(em) {
    em.registerSystem(null, [GameStateDef, CameraDef, GroundSystemDef], ([], res) => {
        if (res.gameState.state !== GameState.GAMEOVER)
            return;
        let ships = EM.filterEntities([ShipLocalDef, ShipPropsDef, PositionDef]);
        for (let ship of ships) {
            for (let part of ship.shipLocal.parts) {
                if (part)
                    em.ensureComponentOn(part, DeletedDef);
            }
            em.ensureComponentOn(ship, DeletedDef);
            if (ship.shipProps.cannonLId)
                em.ensureComponent(ship.shipProps.cannonLId, DeletedDef);
            if (ship.shipProps.cannonRId)
                em.ensureComponent(ship.shipProps.cannonRId, DeletedDef);
            const players = em.filterEntities([
                PlayerDef,
                PositionDef,
                RotationDef,
            ]);
            for (let p of players) {
                if (PhysicsParentDef.isOn(p))
                    p.physicsParent.id = 0;
                vec3.copy(p.position, [0, 100, 0]);
                quat.rotateY(p.rotation, quat.IDENTITY, Math.PI);
                p.player.manning = false;
            }
            quat.identity(res.camera.rotationOffset);
            const gem = em.findEntity(ship.shipProps.gemId, [
                WorldFrameDef,
                PositionDef,
                PhysicsParentDef,
            ]);
            vec3.copy(gem.position, gem.world.position);
            em.ensureComponentOn(gem, RotationDef);
            quat.copy(gem.rotation, gem.world.rotation);
            em.ensureComponentOn(gem, LinearVelocityDef, [0, -0.01, 0]);
            em.removeComponent(gem.id, PhysicsParentDef);
            em.ensureComponentOn(gem, LifetimeDef, 4000);
            res.groundSystem.initialPlace = true;
            createShip();
        }
        res.gameState.state = GameState.LOBBY;
        // TODO: delete all enemy boats
    }, "restartSystem");
}
//# sourceMappingURL=restart.js.map