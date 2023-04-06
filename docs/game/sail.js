import { ColorDef } from "../color-ecs.js";
import { createRef, defineNetEntityHelper } from "../em_helpers.js";
import { EM } from "../entity-manager.js";
import { quat, vec2, vec3 } from "../gl-matrix.js";
import { onInit } from "../init.js";
import { InputsDef } from "../inputs.js";
import { clamp } from "../math.js";
import { AuthorityDef, MeDef } from "../net/components.js";
import { ColliderDef } from "../physics/collider.js";
import { WorldFrameDef } from "../physics/nonintersection.js";
import { PhysicsParentDef, PositionDef, RotationDef, ScaleDef, } from "../physics/transform.js";
import { cloneMesh, mapMeshPositions } from "../render/mesh.js";
import { FLAG_UNLIT } from "../render/pipelines/std-scene.js";
import { RenderableConstructDef, RenderableDef, RenderDataStdDef, RendererDef, } from "../render/renderer-ecs.js";
import { tempMat4, tempQuat, tempVec3 } from "../temp-pool.js";
import { range } from "../util.js";
import { signedAreaOfTriangle, positionAndTargetToOrthoViewProjMatrix, vec3Dbg, } from "../utils-3d.js";
import { AssetsDef } from "./assets.js";
import { DarkStarPropsDef, STAR1_COLOR, STAR2_COLOR } from "./darkstar.js";
import { GameState, GameStateDef } from "./gamestate.js";
import { BOAT_COLOR, PlayerShipPropsDef, } from "./player-ship.js";
import { ShipDef } from "./ship.js";
import { constructNetTurret, TurretDef } from "./turret.js";
const DEFAULT_SAIL_COLOR = vec3.fromValues(0.05, 0.05, 0.05);
const BOOM_LENGTH = 20;
const MAST_LENGTH = 40;
const BOOM_HEIGHT = MAST_LENGTH - BOOM_LENGTH - 2;
const RIB_COUNT = 6;
const BoomPitchesDef = EM.defineComponent("boomPitches", () => ({
    boom1: Math.PI / 4,
    boom2: Math.PI / 4,
}));
EM.registerSerializerPair(BoomPitchesDef, (c, writer) => {
    writer.writeFloat32(c.boom1);
    writer.writeFloat32(c.boom2);
}, (c, reader) => {
    c.boom1 = reader.readFloat32();
    c.boom2 = reader.readFloat32();
});
const SailColorDef = EM.defineComponent("sailColor", (color) => color ?? vec3.create());
// TODO: we need warnings if you forget to call the buildProps system!
export const { MastPropsDef, MastLocalDef, createMastNow } = defineNetEntityHelper(EM, {
    name: "mast",
    defaultProps: (shipId) => ({
        shipId: shipId ?? 0,
    }),
    serializeProps: (o, buf) => {
        buf.writeUint32(o.shipId);
    },
    deserializeProps: (o, buf) => {
        o.shipId = buf.readUint32();
    },
    defaultLocal: () => ({
        boom1: range(RIB_COUNT).map(() => createRef(0, [RotationDef])),
        boom2: range(RIB_COUNT).map(() => createRef(0, [RotationDef])),
        sail1: createRef(0, [
            RenderableDef,
            WorldFrameDef,
            SailColorDef,
            ColorDef,
        ]),
        sail2: createRef(0, [
            RenderableDef,
            WorldFrameDef,
            SailColorDef,
            ColorDef,
        ]),
    }),
    dynamicComponents: [RotationDef, BoomPitchesDef],
    buildResources: [AssetsDef, MeDef],
    build: (mast, res) => {
        const em = EM;
        em.ensureComponentOn(mast, PositionDef, [0, 0, 0]);
        em.ensureComponentOn(mast, RenderableConstructDef, res.assets.mast.mesh);
        em.ensureComponentOn(mast, PhysicsParentDef, mast.mastProps.shipId);
        em.ensureComponentOn(mast, ColorDef, vec3.clone(BOAT_COLOR));
        vec3.scale(mast.color, mast.color, 0.5);
        const createRib = (width) => {
            const rib = em.newEntity();
            em.ensureComponentOn(rib, PositionDef, [0, BOOM_HEIGHT, 0]);
            em.ensureComponentOn(rib, RenderableConstructDef, res.assets.mast.mesh);
            em.ensureComponentOn(rib, ScaleDef, [0.5 * width, 0.5, 0.5 * width]);
            em.ensureComponentOn(rib, RotationDef);
            em.ensureComponentOn(rib, ColorDef, vec3.clone(BOAT_COLOR));
            vec3.scale(rib.color, rib.color, 0.7);
            em.ensureComponentOn(rib, PhysicsParentDef, mast.id);
            return rib;
        };
        mast.mastLocal.boom1 = range(RIB_COUNT).map((i) => createRef(createRib(i === 0 ? 1 : 0.7)));
        mast.mastLocal.boom2 = range(RIB_COUNT).map((i) => createRef(createRib(i === 0 ? 1 : 0.7)));
        const sail1 = em.newEntity();
        em.ensureComponentOn(sail1, PositionDef, [0, BOOM_HEIGHT, 0]);
        em.ensureComponentOn(sail1, RenderableConstructDef, cloneMesh(res.assets.sail.mesh));
        //em.ensureComponentOn(sail1, ScaleDef, [12, 12, 12]);
        em.ensureComponentOn(sail1, RotationDef);
        em.ensureComponentOn(sail1, SailColorDef, STAR1_COLOR);
        em.ensureComponentOn(sail1, ColorDef, vec3.clone(DEFAULT_SAIL_COLOR));
        em.ensureComponentOn(sail1, PhysicsParentDef, mast.id);
        em.whenEntityHas(sail1, RenderDataStdDef, RenderableDef, WorldFrameDef, SailColorDef, ColorDef).then((sail1) => {
            sail1.renderDataStd.flags |= FLAG_UNLIT;
            mast.mastLocal.sail1 = createRef(sail1);
        });
        const sail2 = em.newEntity();
        em.ensureComponentOn(sail2, PositionDef, [0, BOOM_HEIGHT, 0]);
        em.ensureComponentOn(sail2, RenderableConstructDef, cloneMesh(res.assets.sail.mesh));
        //em.ensureComponentOn(sail2, ScaleDef, [12, 12, 12]);
        em.ensureComponentOn(sail2, RotationDef);
        em.ensureComponentOn(sail2, SailColorDef, STAR2_COLOR);
        em.ensureComponentOn(sail2, ColorDef, vec3.clone(DEFAULT_SAIL_COLOR));
        em.ensureComponentOn(sail2, PhysicsParentDef, mast.id);
        em.whenEntityHas(sail2, RenderDataStdDef, RenderableDef, WorldFrameDef, SailColorDef, ColorDef).then((sail2) => {
            sail2.renderDataStd.flags |= FLAG_UNLIT;
            mast.mastLocal.sail2 = createRef(sail2);
        });
        // create seperate hitbox for interacting with the mast
        const interactBox = em.newEntity();
        em.ensureComponentOn(interactBox, PhysicsParentDef, mast.mastProps.shipId);
        em.ensureComponentOn(interactBox, PositionDef, [0, 0, 0]);
        em.ensureComponentOn(interactBox, ColliderDef, {
            shape: "AABB",
            solid: false,
            aabb: {
                min: vec3.fromValues(-1, -1, -1),
                max: vec3.fromValues(1, 1, 1),
            },
        });
        // TODO: setting the yawFactor to -1 is kind of hacky
        constructNetTurret(mast, 0, 0, interactBox, Math.PI, -Math.PI / 8, -1, [0, 20, 50]);
        mast.turret.maxPitch = 0;
        mast.turret.minPitch = 0;
        mast.turret.maxYaw = Math.PI / 2;
        mast.turret.minYaw = -Math.PI / 2;
        return mast;
    },
});
onInit((em) => {
    em.registerSystem([MastPropsDef, MastLocalDef, TurretDef, BoomPitchesDef], [InputsDef, RendererDef], (masts, res) => {
        for (let mast of masts) {
            if (mast.turret.mannedId) {
                if (res.inputs.keyDowns["q"]) {
                    mast.boomPitches.boom1 -= Math.PI * 0.005;
                }
                if (res.inputs.keyDowns["a"]) {
                    mast.boomPitches.boom1 += Math.PI * 0.005;
                }
                if (res.inputs.keyDowns["w"]) {
                    mast.boomPitches.boom2 -= Math.PI * 0.005;
                }
                if (res.inputs.keyDowns["s"]) {
                    mast.boomPitches.boom2 += Math.PI * 0.005;
                }
                mast.boomPitches.boom1 = clamp(mast.boomPitches.boom1, 0, (2 * Math.PI) / 3);
                mast.boomPitches.boom2 = clamp(mast.boomPitches.boom2, 0, (2 * Math.PI) / 3);
            }
            mast.mastLocal.boom1.forEach((ribRef, i) => {
                const rib = ribRef();
                quat.rotateX(rib.rotation, quat.IDENTITY, mast.boomPitches.boom1 * (1 - i / RIB_COUNT));
            });
            mast.mastLocal.boom2.forEach((ribRef, i) => {
                const rib = ribRef();
                quat.rotateY(rib.rotation, quat.IDENTITY, Math.PI);
                quat.rotateX(rib.rotation, rib.rotation, mast.boomPitches.boom2 * (1 - i / RIB_COUNT));
            });
            const adjustSailVertices = (sailMeshHandle, rotations) => {
                // TODO: "read only mesh," eh? not so much
                rotations.push(quat.identity(tempQuat()));
                mapMeshPositions(sailMeshHandle.readonlyMesh, (pos, i) => {
                    const ribIndex = Math.floor(i / 3);
                    const ribRotationBot = rotations[ribIndex];
                    const ribRotationTop = rotations[ribIndex + 1];
                    if (i % 3 == 1) {
                        vec3.transformQuat(pos, [0, BOOM_LENGTH * 0.9, 0], ribRotationTop);
                    }
                    else if (i % 3 == 2) {
                        vec3.transformQuat(pos, [0, BOOM_LENGTH * 0.99, 0], ribRotationBot);
                    }
                    return pos;
                });
                res.renderer.renderer.stdPool.updateMeshVertices(sailMeshHandle, sailMeshHandle.readonlyMesh);
            };
            // update sails
            const sail1 = mast.mastLocal.sail1();
            if (sail1)
                adjustSailVertices(sail1.renderable.meshHandle, mast.mastLocal.boom1.map((b) => b().rotation));
            const sail2 = mast.mastLocal.sail2();
            if (sail2)
                adjustSailVertices(sail2.renderable.meshHandle, mast.mastLocal.boom2.map((b) => b().rotation));
        }
    }, "updateMastBoom");
    em.registerSystem([PlayerShipPropsDef, ShipDef, WorldFrameDef, AuthorityDef], [MeDef, GameStateDef], (es, res) => {
        if (res.gameState.state !== GameState.PLAYING) {
            return;
        }
        for (let ship of es) {
            if (ship.authority.pid !== res.me.pid)
                continue;
            const stars = em.filterEntities([
                DarkStarPropsDef,
                WorldFrameDef,
                ColorDef,
            ]);
            const sails = [
                ship.playerShipProps.mast().mastLocal.sail1(),
                ship.playerShipProps.mast().mastLocal.sail2(),
            ];
            for (let sail of sails) {
                const star = stars.find((s) => vec3.equals(s.color, sail.sailColor));
                if (!star) {
                    console.warn(`No matching star for sail with color ${vec3Dbg(sail.sailColor)}`);
                    continue;
                }
                //console.log(`Sail force is ${vec3Dbg(sailForce)}`);
                //console.log(`Area of sail from star is ${area}`);
                const shipDirection = vec3.fromValues(0, 0, -1);
                vec3.transformQuat(shipDirection, shipDirection, ship.world.rotation);
                const [force, area] = sailForceAndSignedArea(sail, star);
                const accel = vec3.dot(shipDirection, force);
                const localVerts = sail.renderable.meshHandle.readonlyMesh.pos;
                const realArea = Math.abs(signedAreaOfTriangle(vec2.fromValues(localVerts[0][1], localVerts[0][2]), vec2.fromValues(localVerts[1][1], localVerts[1][2]), vec2.fromValues(localVerts[2][1], localVerts[2][2])) * RIB_COUNT);
                // console.log(
                //   `Color lerp is ${
                //     accel / realArea
                //   }, realArea ${realArea}, accel ${accel}`
                // );
                vec3.lerp(sail.color, DEFAULT_SAIL_COLOR, vec3.normalize(tempVec3(), star.color), clamp((accel / realArea) * 5000, 0, 1));
                ship.ship.speed += accel * 0.0001;
                //console.log(`Speed is ${ship.ship.speed}`);
            }
        }
    }, "sail");
});
function sailForceAndSignedArea(sail, star) {
    const viewProjMatrix = positionAndTargetToOrthoViewProjMatrix(tempMat4(), star.world.position, sail.world.position);
    const localVerts = sail.renderable.meshHandle.readonlyMesh.pos;
    const worldVerts = localVerts.map((pos) => {
        return vec3.transformMat4(tempVec3(), pos, sail.world.transform);
    });
    const starViewVerts = worldVerts.map((pos) => {
        return vec3.transformMat4(tempVec3(), pos, viewProjMatrix);
    });
    const area = signedAreaOfTriangle(vec2.fromValues(starViewVerts[0][0], starViewVerts[0][1]), vec2.fromValues(starViewVerts[1][0], starViewVerts[1][1]), vec2.fromValues(starViewVerts[2][0], starViewVerts[2][1])) * RIB_COUNT;
    const sailNormal = vec3.cross(tempVec3(), vec3.subtract(tempVec3(), worldVerts[1], worldVerts[0]), vec3.subtract(tempVec3(), worldVerts[2], worldVerts[0]));
    vec3.normalize(sailNormal, sailNormal);
    return [vec3.scale(sailNormal, sailNormal, area), area];
}
//# sourceMappingURL=sail.js.map