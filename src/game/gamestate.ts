import { CameraDef } from "../camera.js";
import { DeletedDef } from "../delete.js";
import { EM, EntityManager } from "../entity-manager.js";
import { quat, vec3 } from "../gl-matrix.js";
import { MusicDef } from "../music.js";
import { AuthorityDef, HostDef, MeDef } from "../net/components.js";
import { eventWizard } from "../net/events.js";
import { LinearVelocityDef } from "../physics/motion.js";
import { WorldFrameDef } from "../physics/nonintersection.js";
import {
  PhysicsParentDef,
  PositionDef,
  RotationDef,
} from "../physics/transform.js";
import { PhysicsTimerDef } from "../time.js";
import { ScoreDef } from "./game.js";
import { GroundSystemDef } from "./ground.js";
import { LifetimeDef } from "./lifetime.js";
import { LocalPlayerDef, PlayerDef } from "./player.js";
import { createShip, ShipLocalDef, ShipPropsDef } from "./ship.js";

const RESTART_TIME_MS = 5000;

export enum GameState {
  LOBBY,
  PLAYING,
  GAMEOVER,
}

export const GameStateDef = EM.defineComponent("gameState", () => {
  return { state: GameState.LOBBY, time: 0 };
});

export const startGame = eventWizard(
  "start-game",
  () => [[PlayerDef]] as const,
  () => {
    EM.getResource(GameStateDef)!.state = GameState.PLAYING;
  },
  { legalEvent: () => EM.getResource(GameStateDef)!.state === GameState.LOBBY }
);

export const endGame = eventWizard(
  "end-game",
  () => [[ShipPropsDef, ShipLocalDef, PositionDef]] as const,
  ([ship]) => {
    console.log("end");
    const res = EM.getResources([MusicDef, GameStateDef, MeDef])!;
    res.music.playChords([1, 2, 3, 4, 4], "minor");
    res.gameState.state = GameState.GAMEOVER;
    res.gameState.time = 0;
    for (const partRef of ship.shipLocal.parts) {
      const part = partRef();
      if (part) EM.ensureComponentOn(part, DeletedDef);
    }
    EM.ensureComponentOn(ship, DeletedDef);
    if (ship.shipProps.cannonLId)
      EM.ensureComponent(ship.shipProps.cannonLId, DeletedDef);
    if (ship.shipProps.cannonRId)
      EM.ensureComponent(ship.shipProps.cannonRId, DeletedDef);
    const players = EM.filterEntities([
      PlayerDef,
      PositionDef,
      RotationDef,
      AuthorityDef,
      PhysicsParentDef,
      WorldFrameDef,
    ]);
    for (let p of players) {
      p.player.manning = false;
      if (p.authority.pid === res.me.pid) {
        p.physicsParent.id = 0;
        vec3.copy(p.position, p.world.position);
        quat.copy(p.rotation, p.world.rotation);
      }
    }

    const gem = EM.findEntity(ship.shipProps.gemId, [
      WorldFrameDef,
      PositionDef,
      PhysicsParentDef,
    ])!;
    vec3.copy(gem.position, gem.world.position);
    EM.ensureComponentOn(gem, RotationDef);
    quat.copy(gem.rotation, gem.world.rotation);
    EM.ensureComponentOn(gem, LinearVelocityDef, [0, 0.01, 0]);
    EM.removeComponent(gem.id, PhysicsParentDef);
    EM.ensureComponentOn(gem, LifetimeDef, 4000);
  },
  {
    legalEvent: () => EM.getResource(GameStateDef)!.state === GameState.PLAYING,
  }
);

export const restartGame = eventWizard(
  "restart-game",
  () => [[ShipPropsDef]] as const,
  ([ship]) => {
    console.log("restart");
    const res = EM.getResources([GameStateDef, LocalPlayerDef, ScoreDef])!;
    res.gameState.state = GameState.LOBBY;
    const player = EM.findEntity(res.localPlayer.playerId, [
      PhysicsParentDef,
      PositionDef,
    ])!;
    player.physicsParent.id = ship.id;
    vec3.copy(player.position, [0, 100, 0]);
    res.score.currentScore = 0;
    // reset ground system
    const ground = EM.getResource(GroundSystemDef);
    if (ground) {
      ground.initialPlace = true;
    }
  },
  {
    legalEvent: () =>
      EM.getResource(GameStateDef)!.state === GameState.GAMEOVER,
  }
);

export function registerGameStateSystems(em: EntityManager) {
  em.registerSystem(
    null,
    [GameStateDef, PhysicsTimerDef, HostDef],
    ([], res) => {
      if (res.gameState.state === GameState.GAMEOVER) {
        res.gameState.time += res.physicsTimer.period * res.physicsTimer.steps;
        if (res.gameState.time > RESTART_TIME_MS) {
          // Do we have a ship to restart onto yet?
          const ship = EM.filterEntities([ShipPropsDef, ShipLocalDef])[0];
          if (ship) {
            restartGame(ship);
          } else {
            createShip();
          }
        }
      }
    },
    "restartTimer"
  );
}
