import { Collider } from "./collider.js";
import { quat, vec3 } from "./gl-matrix.js";
import { _playerId } from "./game/game.js";
import { clamp } from "./math.js";
import { CollidesWith, idPair, IdPair, ContactData } from "./phys.js";
import { AABB } from "./phys_broadphase.js";
import { vec3Dbg } from "./utils-3d.js";
import { Component, EM } from "./entity-manager.js";
import { Deserializer, Serializer } from "./serialize.js";

export const MotionDef = EM.defineComponent("motion", () => ({
  linearVelocity: vec3.create(),
  angularVelocity: vec3.create(),
  location: vec3.create(),
  rotation: quat.create(),
}));
export type Motion = Component<typeof MotionDef>;

function serializeMotion(o: Motion, buf: Serializer) {
  buf.writeVec3(o.location);
  buf.writeVec3(o.linearVelocity);
  buf.writeQuat(o.rotation);
  buf.writeVec3(o.angularVelocity);
}
function deserializeMotion(o: Motion, buf: Deserializer) {
  buf.readVec3(o.location);
  buf.readVec3(o.linearVelocity);
  buf.readQuat(o.rotation);
  buf.readVec3(o.angularVelocity);
}
EM.registerSerializerPair(MotionDef, serializeMotion, deserializeMotion);


export function copyMotionProps(dest: Motion, src: Partial<Motion>): Motion {
  if (src.location) vec3.copy(dest.location, src.location);
  if (src.rotation) quat.copy(dest.rotation, src.rotation);
  if (src.linearVelocity) vec3.copy(dest.linearVelocity, src.linearVelocity);
  if (src.angularVelocity) vec3.copy(dest.angularVelocity, src.angularVelocity);
  return dest;
}

export function createMotionProps(init: Partial<Motion>): Motion {
  // TODO(@darzu): this is difficult to keep in sync with MotionObject as fields are added/removed/changed
  if (!init.location) init.location = vec3.create();
  if (!init.rotation) init.rotation = quat.create();
  if (!init.linearVelocity) init.linearVelocity = vec3.create();
  if (!init.angularVelocity) init.angularVelocity = vec3.create();

  return init as Motion;
}

let delta = vec3.create();
let normalizedVelocity = vec3.create();
let deltaRotation = quat.create();

// TODO(@darzu): implement checkAtRest (deleted in this commit)

export function didMove(o: { motion: Motion; lastMotion: Motion }): boolean {
  // TODO(@darzu): this might be redundent with vec3.equals which does a epsilon check
  const EPSILON = 0.01;
  return (
    Math.abs(o.motion.location[0] - o.lastMotion.location[0]) > EPSILON ||
    Math.abs(o.motion.location[1] - o.lastMotion.location[1]) > EPSILON ||
    Math.abs(o.motion.location[2] - o.lastMotion.location[2]) > EPSILON
  );
}

const _constrainedVelocities = new Map<number, vec3>();

export interface MotionObj {
  id: number;
  motion: Motion;
  collider: Collider;
  _phys: {
    world: AABB;
  };
}

export function moveObjects(
  objDict: Map<number, MotionObj>,
  dt: number,
  lastCollidesWith: CollidesWith,
  lastContactData: Map<IdPair, ContactData>
) {
  const objs = Array.from(objDict.values());

  // copy .motion to .motion; we want to try to meet the gameplay wants
  // TODO(@darzu): lol, clean this up
  for (let o of objs) {
    copyMotionProps(o.motion, o.motion);
  }

  // TODO(@darzu): probably don't need this intermediate _constrainedVelocities
  _constrainedVelocities.clear();

  // check for collision constraints
  // TODO(@darzu): this is a velocity constraint and ideally should be nicely extracted
  for (let [abId, data] of lastContactData) {
    // TODO(@darzu): we're a bit free with vector creation here, are the memory implications bad?
    const bReboundDir = vec3.clone(data.bToANorm);
    const aReboundDir = vec3.negate(vec3.create(), bReboundDir);

    const a = objDict.get(data.aId);
    const b = objDict.get(data.bId);

    if (!!a && a.collider.solid) {
      const aConVel =
        _constrainedVelocities.get(data.aId) ??
        vec3.clone(objDict.get(data.aId)!.motion.linearVelocity);
      const aInDirOfB = vec3.dot(aConVel, aReboundDir);
      if (aInDirOfB > 0) {
        vec3.sub(
          aConVel,
          aConVel,
          vec3.scale(vec3.create(), aReboundDir, aInDirOfB)
        );
        _constrainedVelocities.set(data.aId, aConVel);
      }
    }

    if (!!b && b.collider.solid) {
      const bConVel =
        _constrainedVelocities.get(data.bId) ??
        vec3.clone(objDict.get(data.bId)!.motion.linearVelocity);
      const bInDirOfA = vec3.dot(bConVel, bReboundDir);
      if (bInDirOfA > 0) {
        vec3.sub(
          bConVel,
          bConVel,
          vec3.scale(vec3.create(), bReboundDir, bInDirOfA)
        );
        _constrainedVelocities.set(data.bId, bConVel);
      }
    }
  }

  // update velocity with constraints
  for (let { id, motion: m } of objs) {
    if (_constrainedVelocities.has(id))
      vec3.copy(m.linearVelocity, _constrainedVelocities.get(id)!);
  }

  for (let {
    id,
    motion: m,
    _phys: { world },
  } of objs) {
    // clamp linear velocity based on size
    const vxMax = (world.max[0] - world.min[0]) / dt;
    const vyMax = (world.max[1] - world.min[1]) / dt;
    const vzMax = (world.max[2] - world.min[2]) / dt;
    m.linearVelocity[0] = clamp(m.linearVelocity[0], -vxMax, vxMax);
    m.linearVelocity[1] = clamp(m.linearVelocity[1], -vyMax, vyMax);
    m.linearVelocity[2] = clamp(m.linearVelocity[2], -vzMax, vzMax);

    // change location according to linear velocity
    delta = vec3.scale(delta, m.linearVelocity, dt);
    vec3.add(m.location, m.location, delta);

    // change rotation according to angular velocity
    normalizedVelocity = vec3.normalize(normalizedVelocity, m.angularVelocity);
    let angle = vec3.length(m.angularVelocity) * dt;
    deltaRotation = quat.setAxisAngle(deltaRotation, normalizedVelocity, angle);
    quat.normalize(deltaRotation, deltaRotation);
    // note--quat multiplication is not commutative, need to multiply on the left
    quat.multiply(m.rotation, deltaRotation, m.rotation);
  }
}
