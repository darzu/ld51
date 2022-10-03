import { align } from "../math.js";
import { assert } from "../test.js";
import { quadToTris } from "./mesh.js";
import { VERBOSE_MESH_POOL_STATS } from "../flags.js";
// Mesh: lossless, all the data of a model/asset from blender
// MeshPool: lossy, a reduced set of attributes for vertex, line, triangle, and model uniforms
const vertsPerTri = 3;
const bytesPerTri = Uint16Array.BYTES_PER_ELEMENT * vertsPerTri;
const bytesPerLine = Uint16Array.BYTES_PER_ELEMENT * 2;
export const MAX_INDICES = 65535; // Since we're using u16 index type, this is our max indices count
export function isMeshHandle(m) {
    return "mId" in m;
}
function logMeshPoolStats(opts) {
    const maxMeshes = opts.unis.length;
    const maxTris = opts.triInds.length / 3;
    const maxVerts = opts.verts.length;
    const maxLines = opts.lineInds.length / 2;
    const vertStruct = opts.verts.struct;
    const uniStruct = opts.unis.struct;
    if (MAX_INDICES < maxVerts)
        throw `Too many vertices (${maxVerts})! W/ Uint16, we can only support '${maxVerts}' verts`;
    if (VERBOSE_MESH_POOL_STATS) {
        // log our estimated space usage stats
        console.log(`Mesh space usage for up to ${maxMeshes} meshes, ${maxTris} tris, ${maxVerts} verts:`);
        console.log(`   ${((maxVerts * vertStruct.size) / 1024).toFixed(1)} KB for verts`);
        console.log(`   ${((maxTris * bytesPerTri) / 1024).toFixed(1)} KB for tri indices`);
        console.log(`   ${((maxLines * bytesPerLine) / 1024).toFixed(1)} KB for line indices`);
        console.log(`   ${((maxMeshes * uniStruct.size) / 1024).toFixed(1)} KB for object uniform data`);
        const unusedBytesPerModel = uniStruct.size - uniStruct.compactSize;
        console.log(`   Unused ${unusedBytesPerModel} bytes in uniform buffer per object (${((unusedBytesPerModel * maxMeshes) /
            1024).toFixed(1)} KB total waste)`);
        const totalReservedBytes = maxVerts * vertStruct.size +
            maxTris * bytesPerTri +
            maxLines * bytesPerLine +
            maxMeshes * uniStruct.size;
        console.log(`Total space reserved for objects: ${(totalReservedBytes / 1024).toFixed(1)} KB`);
    }
}
// TODO(@darzu): HACK. should be scoped; removed as global
let nextMeshId = 1;
export function createMeshPool(opts) {
    logMeshPoolStats(opts);
    const maxMeshes = opts.unis.length;
    const maxTris = Math.ceil(opts.triInds.length / 3);
    const maxVerts = opts.verts.length;
    const maxLines = opts.lineInds.length / 2;
    const allMeshes = [];
    const pool = {
        opts,
        allMeshes,
        numTris: 0,
        numVerts: 0,
        numLines: 0,
        updateUniform,
        addMesh,
        addMeshInstance,
        updateMeshVertices,
        updateMeshIndices,
    };
    function computeTriData(m) {
        const numTri = m.tri.length + m.quad.length * 2;
        const triData = new Uint16Array(align(numTri * 3, 2));
        // add tris
        m.tri.forEach((triInd, i) => {
            // TODO(@darzu): support index shifting
            triData.set(triInd, i * 3);
        });
        m.quad.forEach((quadInd, i) => {
            // TODO(@darzu): support index shifting
            const [t1, t2] = quadToTris(quadInd);
            triData.set(t1, m.tri.length * 3 + i * 6);
            triData.set(t2, m.tri.length * 3 + i * 6 + 3);
        });
        return triData;
    }
    // TODO(@darzu): default to all 1s?
    function addMesh(m) {
        var _a, _b, _c, _d, _e, _f, _g;
        assert(pool.allMeshes.length + 1 <= maxMeshes, "Too many meshes!");
        assert(pool.numVerts + m.pos.length <= maxVerts, "Too many vertices!");
        const numTri = m.tri.length + m.quad.length * 2;
        assert(pool.numTris + numTri <= maxTris, "Too many triangles!");
        assert(pool.numLines + ((_b = (_a = m.lines) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) <= maxLines, "Too many lines!");
        assert(m.usesProvoking, `mesh must use provoking vertices`);
        const vertsData = opts.computeVertsData(m);
        // add tris
        const triData = computeTriData(m);
        // add lines
        let lineData;
        if ((_c = m.lines) === null || _c === void 0 ? void 0 : _c.length) {
            lineData = new Uint16Array(m.lines.length * 2);
            m.lines.forEach((inds, i) => {
                lineData === null || lineData === void 0 ? void 0 : lineData.set(inds, i * 2);
            });
        }
        // initial uniform data
        const uni = opts.computeUniData(m);
        const handle = {
            mId: nextMeshId++,
            // enabled: true,
            triNum: numTri,
            lineNum: (_e = (_d = m.lines) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0,
            vertNum: m.pos.length,
            vertIdx: pool.numVerts,
            triIdx: pool.numTris,
            lineIdx: pool.numLines,
            uniIdx: allMeshes.length,
            readonlyMesh: m,
            mask: 0,
            //shaderData: uni,
        };
        assert(triData.length % 2 === 0, "triData");
        opts.triInds.queueUpdate(triData, handle.triIdx * 3);
        if (lineData)
            opts.lineInds.queueUpdate(lineData, handle.lineIdx * 2);
        opts.verts.queueUpdates(vertsData, handle.vertIdx);
        opts.unis.queueUpdate(uni, handle.uniIdx);
        pool.numTris += numTri;
        // NOTE: mesh's triangles need to be 4-byte aligned.
        // TODO(@darzu): is this still necessary? might be handled by the CyBuffer stuff
        pool.numTris = align(pool.numTris, 2);
        pool.numLines += (_g = (_f = m.lines) === null || _f === void 0 ? void 0 : _f.length) !== null && _g !== void 0 ? _g : 0;
        pool.numVerts += m.pos.length;
        pool.allMeshes.push(handle);
        return handle;
    }
    function addMeshInstance(m) {
        if (pool.allMeshes.length + 1 > maxMeshes)
            throw "Too many meshes!";
        const uniOffset = allMeshes.length;
        const newHandle = {
            ...m,
            uniIdx: uniOffset,
            mId: nextMeshId++,
            //shaderData: d,
        };
        allMeshes.push(newHandle);
        //updateUniform(newHandle);
        return newHandle;
    }
    function updateMeshVertices(handle, newMesh) {
        const data = opts.computeVertsData(newMesh);
        opts.verts.queueUpdates(data, handle.vertIdx);
    }
    function updateMeshIndices(handle, newMesh) {
        const data = computeTriData(newMesh);
        opts.triInds.queueUpdate(data, handle.triIdx * 3);
    }
    function updateUniform(m, d) {
        opts.unis.queueUpdate(d, m.uniIdx);
    }
    return pool;
}
