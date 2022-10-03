import { EM, } from "../entity-manager.js";
import { vec3 } from "../gl-matrix.js";
import { FinishedDef } from "../build.js";
import { ColorDef } from "../color-ecs.js";
import { RenderableConstructDef } from "../render/renderer-ecs.js";
import { PositionDef, RotationDef } from "../physics/transform.js";
import { ColliderDef } from "../physics/collider.js";
import { AuthorityDef, MeDef, SyncDef, PredictDef } from "../net/components.js";
import { AssetsDef } from "./assets.js";
import { AngularVelocityDef, LinearVelocityDef, } from "../physics/motion.js";
import { MotionSmoothingDef } from "../motion-smoothing.js";
import { LifetimeDef } from "./lifetime.js";
import { TimeDef } from "../time.js";
import { GravityDef } from "./gravity.js";
import { ENDESGA16 } from "../color/palettes.js";
import { WorldFrameDef } from "../physics/nonintersection.js";
import { DeletedDef } from "../delete.js";
import { MusicDef } from "../music.js";
import { randNormalVec3 } from "../utils-3d.js";
import { SplinterParticleDef } from "../wood.js";
import { tempVec3 } from "../temp-pool.js";
import { assert } from "../test.js";
export const BulletDef = EM.defineComponent("bullet", (team, health) => {
    return {
        team,
        health,
    };
});
export const BulletConstructDef = EM.defineComponent("bulletConstruct", (loc, vel, angVel, team, gravity, health) => {
    return {
        location: loc !== null && loc !== void 0 ? loc : vec3.fromValues(0, 0, 0),
        linearVelocity: vel !== null && vel !== void 0 ? vel : vec3.fromValues(0, 1, 0),
        angularVelocity: angVel !== null && angVel !== void 0 ? angVel : vec3.fromValues(0, 0, 0),
        team,
        gravity: gravity !== null && gravity !== void 0 ? gravity : 0,
        health,
    };
});
EM.registerSerializerPair(BulletConstructDef, (c, writer) => {
    writer.writeVec3(c.location);
    writer.writeVec3(c.linearVelocity);
    writer.writeVec3(c.angularVelocity);
    writer.writeFloat32(c.gravity);
}, (c, reader) => {
    reader.readVec3(c.location);
    reader.readVec3(c.linearVelocity);
    reader.readVec3(c.angularVelocity);
    c.gravity = reader.readFloat32();
});
const BULLET_COLOR = [0.02, 0.02, 0.02];
function createBullet(em, e, pid, assets) {
    if (FinishedDef.isOn(e))
        return;
    const props = e.bulletConstruct;
    em.ensureComponent(e.id, PositionDef, vec3.clone(props.location));
    em.ensureComponent(e.id, RotationDef);
    em.ensureComponent(e.id, LinearVelocityDef, props.linearVelocity);
    em.ensureComponent(e.id, AngularVelocityDef, props.angularVelocity);
    em.ensureComponentOn(e, ColorDef, vec3.clone(BULLET_COLOR));
    if (props.team === 1) {
        vec3.copy(e.color, ENDESGA16.deepGreen);
    }
    else if (props.team === 2) {
        vec3.copy(e.color, ENDESGA16.deepBrown);
    }
    em.ensureComponent(e.id, MotionSmoothingDef);
    em.ensureComponent(e.id, RenderableConstructDef, assets.ball.proto);
    em.ensureComponent(e.id, AuthorityDef, pid);
    em.ensureComponent(e.id, BulletDef, props.team, props.health);
    em.ensureComponent(e.id, ColliderDef, {
        shape: "AABB",
        solid: false,
        aabb: assets.ball.aabb,
    });
    em.ensureComponent(e.id, LifetimeDef, 4000);
    em.ensureComponentOn(e, SyncDef, [PositionDef.id]);
    e.sync.fullComponents = [BulletConstructDef.id];
    em.ensureComponent(e.id, PredictDef);
    em.ensureComponentOn(e, GravityDef, [0, -props.gravity, 0]);
    em.addComponent(e.id, FinishedDef);
}
export function registerBuildBulletsSystem(em) {
    em.registerSystem([BulletConstructDef], [MeDef, AssetsDef], (bullets, res) => {
        for (let b of bullets)
            createBullet(em, b, res.me.pid, res.assets);
    }, "buildBullets");
}
export function registerBulletUpdate(em) {
    // TODO(@darzu): remove?
    em.registerSystem([BulletConstructDef, BulletDef, PositionDef, LinearVelocityDef], [TimeDef], (bullets, res) => {
        // for (let b of bullets) {
        //   b.linearVelocity[1] -=
        //     0.00001 * b.bulletConstruct.gravity * res.time.dt;
        // }
    }, "updateBullets");
}
export function fireBullet(em, team, location, rotation, speed, // = 0.02,
rotationSpeed, // = 0.02,
gravity, // = 6
health) {
    {
        const music = EM.getResource(MusicDef);
        if (music)
            music.playChords([3], "minor", 2.0, 5.0, 1);
    }
    let bulletAxis = vec3.fromValues(0, 0, -1);
    vec3.transformQuat(bulletAxis, bulletAxis, rotation);
    vec3.normalize(bulletAxis, bulletAxis);
    const linearVelocity = vec3.scale(vec3.create(), bulletAxis, speed);
    const angularVelocity = vec3.scale(vec3.create(), bulletAxis, rotationSpeed);
    const e = em.newEntity();
    em.addComponent(e.id, BulletConstructDef, vec3.clone(location), linearVelocity, angularVelocity, team, gravity, health);
}
const bulletPartPool = [];
let _bulletPartPoolIsInit = false;
let _bulletPartPoolNext = 0;
function getNextBulletPartSet() {
    assert(_bulletPartPoolNext < bulletPartPool.length, "bullet pool problem");
    const res = bulletPartPool[_bulletPartPoolNext];
    _bulletPartPoolNext += 1;
    if (_bulletPartPoolNext >= bulletPartPool.length)
        _bulletPartPoolNext = 0;
    return res;
}
async function initBulletPartPool() {
    if (_bulletPartPoolIsInit)
        return;
    _bulletPartPoolIsInit = true;
    const em = EM;
    const { assets } = await em.whenResources(AssetsDef);
    const numSetsInPool = 20;
    for (let i = 0; i < numSetsInPool; i++) {
        let bset = [];
        for (let part of assets.ball_broken) {
            const pe = em.newEntity();
            em.ensureComponentOn(pe, RenderableConstructDef, part.proto);
            em.ensureComponentOn(pe, ColorDef);
            em.ensureComponentOn(pe, RotationDef);
            em.ensureComponentOn(pe, PositionDef);
            em.ensureComponentOn(pe, LinearVelocityDef);
            em.ensureComponentOn(pe, AngularVelocityDef);
            // em.ensureComponentOn(pe, LifetimeDef, 2000);
            em.ensureComponentOn(pe, GravityDef, [0, -4, 0]);
            em.ensureComponentOn(pe, SplinterParticleDef);
            bset.push(pe);
        }
        bulletPartPool.push(bset);
    }
}
// TODO(@darzu): use object pool!
export async function breakBullet(bullet) {
    const em = EM;
    if (DeletedDef.isOn(bullet))
        return;
    if (!WorldFrameDef.isOn(bullet))
        return; // TODO(@darzu): BUG. Why does this happen sometimes?
    if (!_bulletPartPoolIsInit)
        await initBulletPartPool();
    // const { music, assets } = await em.whenResources(MusicDef, AssetsDef);
    const parts = getNextBulletPartSet();
    for (let pe of parts) {
        if (!pe || !bullet || !bullet.world)
            continue;
        vec3.copy(pe.position, bullet.world.position);
        vec3.copy(pe.color, bullet.color);
        const vel = vec3.clone(bullet.linearVelocity);
        vec3.normalize(vel, vel);
        vec3.negate(vel, vel);
        vec3.add(vel, vel, randNormalVec3(tempVec3()));
        vec3.add(vel, vel, [0, -1, 0]);
        vec3.normalize(vel, vel);
        vec3.scale(vel, vel, 0.02);
        em.ensureComponentOn(pe, LinearVelocityDef);
        vec3.copy(pe.linearVelocity, vel);
        em.ensureComponentOn(pe, AngularVelocityDef);
        vec3.copy(pe.angularVelocity, vel);
        // em.ensureComponentOn(pe, LifetimeDef, 2000);
        em.ensureComponentOn(pe, GravityDef);
        vec3.copy(pe.gravity, [0, -4, 0]);
    }
    em.ensureComponentOn(bullet, DeletedDef);
}
//# sourceMappingURL=bullet.js.map