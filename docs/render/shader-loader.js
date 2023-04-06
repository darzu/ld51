import { EM } from "../entity-manager.js";
import { onInit } from "../init.js";
import { assert } from "../util.js";
import { getText } from "../webget.js";
const DEFAULT_SHADER_PATH = "shaders/";
export const ShaderPaths = [
    "std-mesh",
    "std-ocean",
    "std-outline",
    "std-blur",
    "std-post",
    "xp-boid-render",
    "xp-boid-update",
    "std-jump-flood",
    "xp-cloth-update",
    "std-screen-quad-vert",
    "std-rand",
    "std-stars",
];
const ShaderLoaderDef = EM.defineComponent("shaderLoader", () => {
    return {
        promise: null,
    };
});
export const ShadersDef = EM.defineComponent("shaders", (shaders) => shaders);
async function loadShaders() {
    const codePromises = ShaderPaths.map((name) => getText(`${DEFAULT_SHADER_PATH}${name}.wgsl`));
    const codes = await Promise.all(codePromises);
    const set = {};
    for (let i = 0; i < ShaderPaths.length; i++) {
        set[ShaderPaths[i]] = {
            code: codes[i],
        };
    }
    // TODO(@darzu): should this submit to webgpu for parsing?
    return set;
}
onInit(async (em) => {
    em.addSingletonComponent(ShaderLoaderDef);
    // start loading of shaders
    const { shaderLoader } = await em.whenResources(ShaderLoaderDef);
    assert(!shaderLoader.promise, "somehow we're double loading shaders");
    const shadersPromise = loadShaders();
    shaderLoader.promise = shadersPromise;
    shadersPromise.then((result) => {
        em.addSingletonComponent(ShadersDef, result);
    }, (failureReason) => {
        // TODO(@darzu): fail more gracefully
        throw `Failed to load shaders: ${failureReason}`;
    });
});
//# sourceMappingURL=shader-loader.js.map