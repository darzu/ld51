import ts from "../ext/typescript.js";
import { emitFile } from "./ts-to-bast.js";
import { ajax } from "../util.js";
export function sampleTranspile() {
    const source = "let x: string  = 'string'";
    console.log(`has ts? ${!!ts}`);
    console.dir(ts);
    let result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
    console.dir(result);
}
function createMemHost(files) {
    function fileExists(fileName) {
        fileName = getCanonicalFileName(fileName);
        return fileName in files;
    }
    function readFile(fileName) {
        fileName = getCanonicalFileName(fileName);
        const res = files[fileName];
        if (!res) {
            console.error("Oops! Can't find: " + fileName);
        }
        return res;
    }
    function getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
        fileName = getCanonicalFileName(fileName);
        // TODO @darzu: cache?
        // TODO @darzu: errors?
        const res = ts.createSourceFile(fileName, files[fileName], languageVersion);
        // console.log(`getSourceFile(${fileName})`)
        // console.dir(res);
        return res;
    }
    function getDefaultLibFileName(options) {
        // TODO @darzu: hmmm
        return "lib.d.ts";
    }
    function writeFile(fileName, data, writeByteOrderMark, onError, sourceFiles) {
        fileName = getCanonicalFileName(fileName);
        // TODO @darzu: other args?
        files[fileName] = data;
    }
    function getCurrentDirectory() {
        // TODO @darzu: hmm
        return "~";
    }
    function getCanonicalFileName(fileName) {
        // console.log(`getCanonicalFileName(${fileName})`)
        return fileName.replace("~/", "");
    }
    function useCaseSensitiveFileNames() {
        return true;
    }
    function getNewLine() {
        return "\n";
    }
    return {
        // module resolution
        fileExists,
        readFile,
        // host
        getSourceFile,
        getDefaultLibFileName,
        writeFile,
        getCurrentDirectory,
        getCanonicalFileName,
        useCaseSensitiveFileNames,
        getNewLine,
    };
}
export async function compileTs(maints) {
    const compOpts = {
        lib: ['lib.d.ts', 'dz.d.ts'],
        target: ts.ScriptTarget.Latest
    };
    const files = {
        'main.ts': maints,
        'lib.d.ts': await ajax.getText("./ext/lib.es5.d.ts"),
        'dz.d.ts': await ajax.getText("./dz.d.ts"), // TODO @darzu:
    };
    const host = createMemHost(files);
    // const host = ts.createCompilerHost(compOpts);
    // host.writeFile("main.ts", await ajax.getText('./samples/log.ts'), false);
    const progOpts = {
        rootNames: ['main.ts'],
        options: compOpts,
        host: host,
    };
    const prog = ts.createProgram(progOpts);
    const diag = [...prog.getSyntacticDiagnostics(), ...prog.getSemanticDiagnostics(), ...prog.getGlobalDiagnostics()];
    for (let d of diag) {
        console.log(`err: ${d.messageText}`);
    }
    const ast = prog.getSourceFile('main.ts');
    if (!ast)
        return [];
    const tc = prog.getTypeChecker();
    const res = emitFile(ast);
    console.dir(res);
    const jsRes = prog.emit();
    for (let d of jsRes.diagnostics) {
        console.log(`err: ${d.messageText}`);
    }
    for (let f of jsRes.emittedFiles || ["main.js"]) {
        const s = host.readFile(f);
        console.log(s);
    }
    // console.dir(prog)
    return res;
}
//# sourceMappingURL=ts-host.js.map