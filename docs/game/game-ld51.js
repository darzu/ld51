import { CameraDef } from "../camera.js";
import { CanvasDef } from "../canvas.js";
import { ColorDef } from "../color-ecs.js";
import { ENDESGA16 } from "../color/palettes.js";
import { createRef } from "../em_helpers.js";
import { EM } from "../entity-manager.js";
import { vec3, quat, mat4 } from "../gl-matrix.js";
import { InputsDef } from "../inputs.js";
import { jitter } from "../math.js";
import { createAABB, emptyLine, copyAABB, transformAABB, } from "../physics/broadphase.js";
import { ColliderDef } from "../physics/collider.js";
import { AngularVelocityDef, LinearVelocityDef } from "../physics/motion.js";
import { WorldFrameDef } from "../physics/nonintersection.js";
import { PhysicsParentDef, PositionDef, RotationDef, ScaleDef, } from "../physics/transform.js";
import { PointLightDef } from "../render/lights.js";
import { cloneMesh, getAABBFromMesh, normalizeMesh, transformMesh, } from "../render/mesh.js";
import { stdRenderPipeline } from "../render/pipelines/std-mesh.js";
import { outlineRender } from "../render/pipelines/std-outline.js";
import { postProcess } from "../render/pipelines/std-post.js";
import { shadowPipelines } from "../render/pipelines/std-shadow.js";
import { RendererDef, RenderableConstructDef, RenderDataStdDef, } from "../render/renderer-ecs.js";
import { tempMat4 } from "../temp-pool.js";
import { assert } from "../test.js";
import { TimeDef } from "../time.js";
import { createEmptyMesh, createTimberBuilder, createWoodHealth, getBoardsFromMesh, SplinterParticleDef, unshareProvokingForWood, WoodHealthDef, WoodStateDef, } from "../wood.js";
import { AssetsDef, BLACK } from "./assets.js";
import { fireBullet } from "./bullet.js";
import { createGhost } from "./game-sandbox.js";
import { GravityDef } from "./gravity.js";
// TODO(@darzu): HACK. we need a better way to programmatically create sandbox games
export const sandboxSystems = [];
export async function initLD51Game(em, hosting) {
    const camera = em.addSingletonComponent(CameraDef);
    camera.fov = Math.PI * 0.5;
    const res = await em.whenResources(AssetsDef, 
    // WoodAssetsDef,
    // GlobalCursor3dDef,
    RendererDef);
    res.renderer.pipelines = [
        ...shadowPipelines,
        stdRenderPipeline,
        outlineRender,
        postProcess,
    ];
    const sunlight = em.newEntity();
    em.ensureComponentOn(sunlight, PointLightDef);
    // sunlight.pointLight.constant = 1.0;
    sunlight.pointLight.constant = 1.0;
    vec3.copy(sunlight.pointLight.ambient, [0.4, 0.4, 0.4]);
    // vec3.scale(sunlight.pointLight.ambient, sunlight.pointLight.ambient, 0.2);
    vec3.copy(sunlight.pointLight.diffuse, [0.5, 0.5, 0.5]);
    em.ensureComponentOn(sunlight, PositionDef, [50, 100, 10]);
    em.ensureComponentOn(sunlight, RenderableConstructDef, res.assets.ball.proto);
    const ghost = createGhost(em);
    vec3.copy(ghost.position, [0, 1, -1.2]);
    quat.setAxisAngle(ghost.rotation, [0.0, -1.0, 0.0], 1.62);
    // setCameraFollowPosition(g, "thirdPerson");
    ghost.cameraFollow.positionOffset = [0, 0, 5];
    // g.controllable.modes.canYaw = false;
    // g.controllable.modes.canCameraYaw = true;
    // g.controllable.modes.canPitch = true;
    ghost.controllable.speed *= 0.5;
    ghost.controllable.sprintMul = 10;
    // const c = res.globalCursor3d.cursor()!;
    // if (RenderableDef.isOn(c)) c.renderable.enabled = false;
    const ground = em.newEntity();
    const groundMesh = cloneMesh(res.assets.hex.mesh);
    transformMesh(groundMesh, mat4.fromRotationTranslationScale(tempMat4(), quat.IDENTITY, [0, -2, 0], [20, 2, 20]));
    em.ensureComponentOn(ground, RenderableConstructDef, groundMesh);
    em.ensureComponentOn(ground, ColorDef, vec3.clone(ENDESGA16.blue));
    // em.ensureComponentOn(p, ColorDef, [0.2, 0.3, 0.2]);
    em.ensureComponentOn(ground, PositionDef, [0, 0, 0]);
    // em.ensureComponentOn(plane, PositionDef, [0, -5, 0]);
    // const cube = em.newEntity();
    // const cubeMesh = cloneMesh(res.assets.cube.mesh);
    // em.ensureComponentOn(cube, RenderableConstructDef, cubeMesh);
    // em.ensureComponentOn(cube, ColorDef, [0.1, 0.1, 0.1]);
    // em.ensureComponentOn(cube, PositionDef, [0, 0, 3]);
    // em.ensureComponentOn(cube, RotationDef);
    // em.ensureComponentOn(cube, AngularVelocityDef, [0, 0.001, 0.001]);
    // em.ensureComponentOn(cube, WorldFrameDef);
    // em.ensureComponentOn(cube, ColliderDef, {
    //   shape: "AABB",
    //   solid: false,
    //   aabb: res.assets.cube.aabb,
    // });
    // em.ensureComponentOn(b1, ColliderDef, {
    //   shape: "Box",
    //   solid: false,
    //   center: res.assets.cube.center,
    //   halfsize: res.assets.cube.halfsize,
    // });
    // TODO(@darzu): timber system here!
    const sphereMesh = cloneMesh(res.assets.ball.mesh);
    const visible = false;
    em.ensureComponentOn(ghost, RenderableConstructDef, sphereMesh, visible);
    em.ensureComponentOn(ghost, ColorDef, [0.1, 0.1, 0.1]);
    em.ensureComponentOn(ghost, PositionDef, [0, 0, 0]);
    // em.ensureComponentOn(b2, PositionDef, [0, 0, -1.2]);
    em.ensureComponentOn(ghost, WorldFrameDef);
    // em.ensureComponentOn(b2, PhysicsParentDef, g.id);
    em.ensureComponentOn(ghost, ColliderDef, {
        shape: "AABB",
        solid: false,
        aabb: res.assets.ball.aabb,
    });
    // randomizeMeshColors(b2);
    // em.ensureComponentOn(b2, ColliderDef, {
    //   shape: "Box",
    //   solid: false,
    //   center: res.assets.cube.center,
    //   halfsize: res.assets.cube.halfsize,
    // });
    const timber = em.newEntity();
    const _timberMesh = createEmptyMesh("rib");
    const ribWidth = 0.5;
    const ribDepth = 0.4;
    const builder = createTimberBuilder(_timberMesh, ribWidth, ribDepth);
    const ribCount = 10;
    const ribSpace = 3;
    for (let i = 0; i < ribCount; i++) {
        mat4.identity(builder.cursor);
        mat4.translate(builder.cursor, builder.cursor, [i * ribSpace, 0, 0]);
        appendTimberRib(builder, true);
    }
    for (let i = 0; i < ribCount; i++) {
        mat4.identity(builder.cursor);
        // mat4.scale(builder.cursor, builder.cursor, [1, 1, -1]);
        mat4.translate(builder.cursor, builder.cursor, [i * ribSpace, 0, 0]);
        appendTimberRib(builder, false);
    }
    const floorPlankCount = 7;
    const floorSpace = 1.24;
    const floorLength = ribSpace * (ribCount - 1) + ribWidth * 2.0;
    const floorSegCount = 12;
    for (let i = 0; i < floorPlankCount; i++) {
        mat4.identity(builder.cursor);
        mat4.translate(builder.cursor, builder.cursor, [
            -ribWidth,
            3,
            (i - (floorPlankCount - 1) * 0.5) * floorSpace + jitter(0.01),
        ]);
        builder.width = 0.6;
        builder.depth = 0.2;
        appendTimberFloorPlank(builder, floorLength, floorSegCount);
    }
    _timberMesh.surfaceIds = _timberMesh.colors.map((_, i) => i);
    const timberState = getBoardsFromMesh(_timberMesh);
    unshareProvokingForWood(_timberMesh, timberState);
    const timberMesh = normalizeMesh(_timberMesh);
    em.ensureComponentOn(timber, RenderableConstructDef, timberMesh);
    em.ensureComponentOn(timber, WoodStateDef, timberState);
    em.ensureComponentOn(timber, ColorDef, vec3.clone(ENDESGA16.darkBrown));
    // em.ensureComponentOn(timber, ColorDef, [0.1, 0.1, 0.1]);
    // const scale = 1 * Math.pow(0.8, ti);
    const scale = 1;
    const timberAABB = getAABBFromMesh(timberMesh);
    // const timberPos = getCenterFromAABB(timberAABB);
    const timberPos = vec3.create();
    // const timberPos = vec3.clone(res.assets.timber_rib.center);
    // vec3.negate(timberPos, timberPos);
    // vec3.scale(timberPos, timberPos, scale);
    timberPos[1] += 1;
    timberPos[0] -= ribCount * 0.5 * ribSpace;
    // timberPos[2] -= floorPlankCount * 0.5 * floorSpace;
    em.ensureComponentOn(timber, PositionDef, timberPos);
    // em.ensureComponentOn(timber, PositionDef, [0, 0, -4]);
    em.ensureComponentOn(timber, RotationDef);
    em.ensureComponentOn(timber, ScaleDef, [scale, scale, scale]);
    em.ensureComponentOn(timber, WorldFrameDef);
    em.ensureComponentOn(timber, ColliderDef, {
        shape: "AABB",
        solid: false,
        aabb: timberAABB,
    });
    const timberHealth = createWoodHealth(timberState);
    em.ensureComponentOn(timber, WoodHealthDef, timberHealth);
    // randomizeMeshColors(timber);
    // const board = timberState.boards[0];
    // const timber2 = await em.whenEntityHas(timber, RenderableDef);
    // const tetra = em.newEntity();
    // const tetraMesh = cloneMesh(res.assets.tetra.mesh);
    // em.ensureComponentOn(tetra, RenderableConstructDef, tetraMesh);
    // em.ensureComponentOn(tetra, ColorDef, [0.1, 0.1, 0.1]);
    // em.ensureComponentOn(tetra, PositionDef, [0, -3, 0]);
    // em.ensureComponentOn(tetra, RotationDef);
    // em.ensureComponentOn(tetra, WorldFrameDef);
    // em.ensureComponentOn(tetra, ColliderDef, {
    //   shape: "AABB",
    //   solid: false,
    //   aabb: res.assets.tetra.aabb,
    // });
    // for (let xi = 0; xi < 0; xi += 2) {
    //   for (let yi = 0; yi < 0; yi += 2) {
    //     // TODO(@darzu): dbging splinters
    //     const splinter = em.newEntity();
    //     // TODO(@darzu): perf? probably don't need to normalize, just use same surface ID and provoking vert for all
    //     const _splinterMesh =
    //       // yi < 5 ? mkTimberSplinterEnd() : mkTimberSplinterFree();
    //       // mkTimberSplinterFree(0.2 + xi * 0.2, 0.2 + yi * 0.2);
    //       mkTimberSplinterFree(1, 1, 1);
    //     const splinterMesh = normalizeMesh(_splinterMesh);
    //     em.ensureComponentOn(splinter, RenderableConstructDef, splinterMesh);
    //     em.ensureComponentOn(splinter, ColorDef, [
    //       Math.random(),
    //       Math.random(),
    //       Math.random(),
    //     ]);
    //     // em.ensureComponentOn(splinter, ColorDef, [0.1, 0.1, 0.1]);
    //     em.ensureComponentOn(splinter, PositionDef, [xi * 2 + 4, 0, yi * 2]);
    //     em.ensureComponentOn(splinter, RotationDef);
    //     em.ensureComponentOn(splinter, WorldFrameDef);
    //     em.ensureComponentOn(splinter, ColliderDef, {
    //       shape: "AABB",
    //       solid: false,
    //       aabb: res.assets.timber_splinter.aabb,
    //     });
    //     // randomizeMeshColors(splinter);
    //   }
    // }
    const splinterObjId = 7654;
    em.registerSystem([
        SplinterParticleDef,
        LinearVelocityDef,
        AngularVelocityDef,
        GravityDef,
        PositionDef,
        RotationDef,
        RenderDataStdDef,
    ], [], (splinters, res) => {
        for (let s of splinters) {
            if (s.position[1] <= 0) {
                em.removeComponent(s.id, LinearVelocityDef);
                em.removeComponent(s.id, GravityDef);
                em.removeComponent(s.id, AngularVelocityDef);
                s.position[1] = 0;
                quat.identity(s.rotation);
                quat.rotateX(s.rotation, s.rotation, Math.PI * 0.5);
                quat.rotateZ(s.rotation, s.rotation, Math.PI * Math.random());
                s.renderDataStd.id = splinterObjId; // stops z-fighting
                // console.log("freeze!");
            }
        }
    }, "splintersOnFloor");
    sandboxSystems.push("splintersOnFloor");
    const quadIdsNeedReset = new Set();
    assert((ghost === null || ghost === void 0 ? void 0 : ghost.collider.shape) === "AABB");
    // console.dir(ghost.collider.aabb);
    em.registerSystem(null, [InputsDef, CanvasDef], (_, { inputs, htmlCanvas }) => {
        const ballAABBWorld = createAABB();
        const segAABBWorld = createAABB();
        const worldLine = emptyLine();
        assert((ghost === null || ghost === void 0 ? void 0 : ghost.collider.shape) === "AABB");
        copyAABB(ballAABBWorld, ghost.collider.aabb);
        transformAABB(ballAABBWorld, ghost.world.transform);
        // TODO(@darzu): this sphere should live elsewhere..
        const worldSphere = {
            org: ghost.world.position,
            rad: 1,
            // rad: (ballAABBWorld.max[0] - ballAABBWorld.min[0]) * 0.5,
        };
        if (inputs.lclick && htmlCanvas.hasFirstInteraction) {
            // TODO(@darzu): fire?
            console.log(`fire!`);
            const firePos = worldSphere.org;
            const fireDir = quat.create();
            quat.copy(fireDir, ghost.world.rotation);
            fireBullet(em, 1, firePos, fireDir, 0.05, 0.02, 3);
        }
    }, "runLD51Timber");
    sandboxSystems.push("runLD51Timber");
    startPirates();
}
export function appendTimberFloorPlank(b, length, numSegs) {
    const firstQuadIdx = b.mesh.quad.length;
    mat4.rotateY(b.cursor, b.cursor, Math.PI * 0.5);
    mat4.rotateX(b.cursor, b.cursor, Math.PI * 0.5);
    b.addLoopVerts();
    b.addEndQuad(true);
    const segLen = length / numSegs;
    for (let i = 0; i < numSegs; i++) {
        mat4.translate(b.cursor, b.cursor, [0, segLen, 0]);
        b.addLoopVerts();
        b.addSideQuads();
    }
    b.addEndQuad(false);
    for (let qi = firstQuadIdx; qi < b.mesh.quad.length; qi++)
        b.mesh.colors.push(vec3.clone(BLACK));
    // console.dir(b.mesh);
    return b.mesh;
}
export function appendTimberRib(b, ccw) {
    const firstQuadIdx = b.mesh.quad.length;
    const ccwf = ccw ? -1 : 1;
    mat4.rotateX(b.cursor, b.cursor, Math.PI * 0.4 * -ccwf);
    b.addLoopVerts();
    b.addEndQuad(true);
    const numSegs = 7;
    let xFactor = 0.05;
    for (let i = 0; i < numSegs; i++) {
        mat4.translate(b.cursor, b.cursor, [0, 2, 0]);
        mat4.rotateX(b.cursor, b.cursor, Math.PI * xFactor * ccwf);
        b.addLoopVerts();
        b.addSideQuads();
        mat4.rotateX(b.cursor, b.cursor, Math.PI * xFactor * ccwf);
        // mat4.rotateY(b.cursor, b.cursor, Math.PI * -0.003);
        xFactor = xFactor - 0.005;
    }
    mat4.translate(b.cursor, b.cursor, [0, 2, 0]);
    b.addLoopVerts();
    b.addSideQuads();
    b.addEndQuad(false);
    for (let qi = firstQuadIdx; qi < b.mesh.quad.length; qi++)
        b.mesh.colors.push(vec3.clone(BLACK));
    // console.dir(b.mesh);
    return b.mesh;
}
const startDelay = 5000;
export const PiratePlatformDef = EM.defineComponent("piratePlatform", (cannon, tiltPeriod, tiltTimer) => {
    return {
        cannon: createRef(cannon),
        tiltPeriod,
        tiltTimer,
        lastFire: startDelay,
    };
});
function rotatePiratePlatform(p, rad) {
    vec3.rotateY(p.position, p.position, vec3.ZEROS, rad);
    quat.rotateY(p.rotation, p.rotation, rad);
}
const pitchSpeed = 0.000042;
async function startPirates() {
    const em = EM;
    const numPirates = 7;
    for (let i = 0; i < numPirates; i++) {
        const p = await spawnPirate();
        rotatePiratePlatform(p, i * ((2 * Math.PI) / numPirates));
    }
    const tenSeconds = 1000 * 10; // TODO(@darzu): make 10 seconds
    const fireStagger = 150;
    // const tiltPeriod = 5700;
    em.registerSystem([PiratePlatformDef, PositionDef, RotationDef], [TimeDef], (ps, res) => {
        // const sinceLastFire = res.time.time - lastFire;
        // let beginFire = sinceLastFire > tenSeconds;
        // if (beginFire) {
        //   console.log("broadside!");
        //   lastFire = res.time.time;
        // }
        let pIdx = 0;
        for (let p of ps) {
            pIdx++;
            // rotate platform
            const R = Math.PI * -0.001;
            rotatePiratePlatform(p, R);
            const c = p.piratePlatform.cannon();
            // pitch cannons
            p.piratePlatform.tiltTimer += res.time.dt;
            const upMode = p.piratePlatform.tiltTimer % p.piratePlatform.tiltPeriod >
                p.piratePlatform.tiltPeriod * 0.5;
            if (RotationDef.isOn(c)) {
                let r = Math.PI * pitchSpeed * res.time.dt * (upMode ? -1 : 1);
                quat.rotateX(c.rotation, c.rotation, r);
            }
            // fire cannons
            const myTime = res.time.time + pIdx * fireStagger;
            let doFire = myTime - p.piratePlatform.lastFire > tenSeconds;
            if (doFire) {
                p.piratePlatform.lastFire = myTime;
                if (WorldFrameDef.isOn(c)) {
                    console.log(`pirate fire`);
                    fireBullet(em, 2, c.world.position, c.world.rotation, 0.05, 0.02, 3);
                }
            }
        }
    }, "updatePiratePlatforms");
    sandboxSystems.push("updatePiratePlatforms");
}
async function spawnPirate() {
    const em = EM;
    const res = await em.whenResources(AssetsDef, RendererDef);
    const platform = em.newEntity();
    const cannon = em.newEntity();
    const groundMesh = cloneMesh(res.assets.hex.mesh);
    transformMesh(groundMesh, mat4.fromRotationTranslationScale(tempMat4(), quat.IDENTITY, [0, -1, 0], [4, 1, 4]));
    em.ensureComponentOn(platform, RenderableConstructDef, groundMesh);
    em.ensureComponentOn(platform, ColorDef, vec3.clone(ENDESGA16.darkRed));
    // em.ensureComponentOn(p, ColorDef, [0.2, 0.3, 0.2]);
    em.ensureComponentOn(platform, PositionDef, [0, 0, 30]);
    em.ensureComponentOn(platform, RotationDef);
    // em.ensureComponentOn(plane, PositionDef, [0, -5, 0]);
    const tiltPeriod = 5700 + jitter(3000);
    const tiltTimer = Math.random() * tiltPeriod;
    em.ensureComponentOn(platform, PiratePlatformDef, cannon, tiltPeriod, tiltTimer);
    em.ensureComponentOn(cannon, RenderableConstructDef, res.assets.ld51_cannon.proto);
    em.ensureComponentOn(cannon, PositionDef, [0, 2, 0]);
    em.ensureComponentOn(cannon, RotationDef, quat.rotateX(quat.create(), quat.IDENTITY, Math.PI * 0.03));
    em.ensureComponentOn(cannon, PhysicsParentDef, platform.id);
    em.ensureComponentOn(cannon, ColorDef, vec3.clone(ENDESGA16.darkGray));
    let initTimer = 0;
    // TODO(@darzu):
    while (initTimer < tiltTimer) {
        initTimer += 16.6666;
        const upMode = initTimer % tiltPeriod > tiltPeriod * 0.5;
        let r = Math.PI * pitchSpeed * 16.6666 * (upMode ? -1 : 1);
        quat.rotateX(cannon.rotation, cannon.rotation, r);
    }
    return platform;
}
//# sourceMappingURL=game-ld51.js.map