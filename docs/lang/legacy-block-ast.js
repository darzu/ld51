import { pxtColorsHSL } from "./color.js";
import { V2, max, sum, even } from "../math.js";
import { genDef, getPxtBlockDefs, parseBlocksXml } from "./pxt-parse.js";
import { wrapNodes, sizeOfText } from "./resize.js";
import { ajax, range } from "../util.js";
const WRAP_INDENT = 8;
const INNER_W_M = 8;
const INNER_H_M = 4;
const CHAR_H = 16;
const CHAR_W = 9.6;
const NODE_SPACER = CHAR_W;
const MOUTH_INDENT = WRAP_INDENT * 2;
const MIN_WIDTH = 164;
const LABEL_MARGIN = 12;
const STACK_GAP = 12;
export const BlockCategories = ["loops", "variables", "sprites", "logic"];
export const CornerShapes = ["square", "circular", "triangular"];
export const BlockLooks = ["event", "statement", "norm_exp", "bool_exp"];
export const BlockCategoryProps = {
    "loops": {
        hue: 148
    },
    "variables": {
        hue: 350
    },
    "sprites": {
        hue: 222
    },
    "logic": {
        // TODO(dz):
        hue: 222
    }
};
export const BlockLookProps = {
    "event": {
        cornerShape: "square"
    },
    "statement": {
        cornerShape: "square"
    },
    "norm_exp": {
        cornerShape: "circular"
    },
    "bool_exp": {
        cornerShape: "triangular"
    }
};
export const HOLE = { kind: "hole" };
export function IsLabel(d) {
    return typeof d === "string";
}
export function IsHoleDef(d) {
    return d.kind === "hole";
}
export function IsLeafDef(d) {
    return !IsHoleDef(d);
}
export const MOUTH = "mouth";
export function HasParameter(b) {
    return !IsLabel(b);
}
export function HasParameters(sec) {
    if (sec === "mouth")
        return true;
    return sec.reduce((p, n) => p || HasParameter(n), false);
}
export function hasMultipleSectionArgs(args) {
    return Array.isArray(args[0]);
}
export function IsBlockValue(v) {
    return "block" in v;
}
//////////////
function genSampleBlock(def) {
    if (def.sections.length !== 1)
        return null; // TODO
    if (def.sections[0] === MOUTH)
        return null; // TODO
    let sec = def.sections[0];
    let numHoles = sec.filter(p => p === HOLE).length;
    let args = range(numHoles).map(_ => ({
        kind: "image",
        value: ":)",
    }));
    return {
        block: def.id,
        args: args
    };
}
// Sample gen: (not terribly useful)
//
// let stmtSamples = defs
//   .filter(d => d.look === "statement")
//   .map(genSampleBlock)
//   .filter(b => !!b) as Value[]
// console.log("out samples:")
// console.dir(stmtSamples)
// // codeTree.args = [...codeTree.args as Value[], ...stmtSamples]
// codeTree.args = [stmtSamples[3]]
function sizeOfDropdown(txt) {
    // TODO(dz): refine
    return V2.add({ x: CHAR_W * txt.length + 2 /*for arrow*/, y: CHAR_H }, { x: INNER_W_M * 2, y: 0 });
}
function mkRenderableValue(val) {
    if (val.kind == "enum") {
        // TODO(dz): enum dropdown
        return {
            kind: "label",
            text: val.value,
            size: sizeOfText(val.value)
        };
    }
    else if (val.kind == "image") {
        // TODO(dz): image rendering
        return {
            kind: "label",
            text: ":)",
            size: { x: 20, y: 20 }
        };
    }
    else if (val.kind == "bool") {
        let txt = val.value + "";
        return {
            kind: "dropdown",
            text: txt,
            size: sizeOfDropdown(txt),
            corner: "square",
            color: pxtColorsHSL["logic"],
            look: "bool_exp"
        };
    }
    let _ = val;
    return _;
}
function mkRenderableLabel(val) {
    return {
        kind: "label",
        text: val,
        size: V2.add(sizeOfText(val), { x: 0, y: LABEL_MARGIN * 2 })
    };
}
function mkRenderableMouthSection(args, maxWidth) {
    let lines = args.map(a => ({ nodes: [a], size: a.size }));
    let innerW = max(args.map(a => a.size.x));
    let innerH = sum(lines.map(a => a.size.y));
    let outerW = Math.min(Math.max(innerW + INNER_W_M * 2 + MOUTH_INDENT, MIN_WIDTH), maxWidth);
    return {
        kind: "mouth",
        innerSize: { x: innerW, y: innerH },
        outerSize: { x: outerW, y: innerH },
        lines: lines
    };
}
function mkRenderableWrappedSection(def, args, maxWidth) {
    let nodes = [];
    let nextArg = 0;
    for (let defN of def) {
        if (IsLabel(defN)) {
            let words = defN
                .split(" ")
                .filter(n => !!n);
            words
                .map(mkRenderableLabel)
                .forEach(w => nodes.push(w));
        }
        else if (defN.kind == "hole") {
            // TODO: error handle mis-matched args & nodes
            nodes.push(args[nextArg]);
            nextArg++;
        }
        else if (defN.kind == "enum") {
            // TODO(dz): validate enum value? typecheck? probably before this step
            // TODO: Arg should probably not be a Renderable by this point, it should still
            //       be able to take input from the def
            nodes.push(args[nextArg]);
            nextArg++;
        }
    }
    let lines = wrapNodes(nodes, maxWidth - INNER_W_M * 2);
    let innerW = max(lines.map(l => l.size.x));
    let innerH = sum(lines.map(l => l.size.y));
    let innerSize = { x: innerW, y: innerH };
    let outerW = Math.min(Math.max(innerW + INNER_W_M * 2, MIN_WIDTH), maxWidth);
    return {
        kind: "wrap",
        innerSize: innerSize,
        outerSize: { x: outerW, y: innerH + INNER_H_M * 2 },
        lines: lines,
    };
}
function mkRenderableSection(def, args, maxWidth) {
    if (def === "mouth")
        return mkRenderableMouthSection(args, maxWidth);
    else
        return mkRenderableWrappedSection(def, args, maxWidth);
}
// function computeSectionPositions(secs: (HasSize & { kind: "wrap" | "mouth" })[]): Pos[] {
//   // TODO: move to elsewhere?
//   // use INNER_H_M, INNER_W_M, INDENT
//   let ps: Pos[] = []
//   let y = INNER_H_M;
//   for (let s of secs) {
//     let x = s.kind === "wrap" ? INNER_W_M : MOUTH_INDENT
//     ps.push({ x, y })
//     let [w, h] = s.size
//     y += h
//     y += INNER_H_M
//   }
//   return ps;
// }
export function mkRenderable(codeTree, maxWidth) {
    // TODO: render should take both def and values as arg? Feel like we should have that step in here, maybe before rendering
    // is it a leaf value?
    if (!IsBlockValue(codeTree)) {
        return mkRenderableValue(codeTree);
    }
    // it's a block
    let def = blockDefsById[codeTree.block];
    let cat = BlockCategoryProps[def.category];
    let kin = BlockLookProps[def.look];
    // first, do children
    let sectionArgs;
    // TODO: distinguish indent levels in head vs mouth?
    let maxBlockChildWidth = maxWidth - WRAP_INDENT;
    let maxMouthChildWidth = maxWidth - MOUTH_INDENT;
    if (hasMultipleSectionArgs(codeTree.args)) {
        sectionArgs = codeTree.args.map((secArgs, i) => {
            let isMouth = even(i);
            return secArgs.map(a => mkRenderable(a, isMouth ? maxMouthChildWidth : maxBlockChildWidth));
        });
    }
    else {
        sectionArgs = [codeTree.args.map(v => mkRenderable(v, maxBlockChildWidth))];
    }
    // combine arguments and definition nodes to create renderable sections
    let nextArgs = 0;
    let sections = [];
    for (let sec of def.sections) {
        if (HasParameters(sec)) {
            sections.push(mkRenderableSection(sec, sectionArgs[nextArgs], maxWidth));
            nextArgs++;
        }
        else {
            sections.push(mkRenderableSection(sec, [], maxWidth));
        }
    }
    if (even(sections.length)) {
        // add end cap
        let innerSize = { x: 0, y: 16 + 8 };
        sections.push({
            lines: [],
            innerSize: innerSize,
            outerSize: V2.add(innerSize, { x: INNER_W_M * 2, y: INNER_H_M * 2 }),
            kind: "wrap"
        });
    }
    // determine outer size
    let width = Math.max(...sections.map(s => s.outerSize.x));
    let height = sections
        .map(s => s.outerSize.y)
        .reduce((p, n) => p + n, 0);
    // finalize
    const color = pxtColorsHSL[def.category];
    return {
        kind: "block",
        corner: kin.cornerShape,
        sections: sections,
        color,
        look: def.look,
        size: { x: width, y: height }
    };
}
export let legacyCodeTree = {
    block: "on_start",
    args: [
        {
            block: "set_var",
            args: [
                {
                    kind: "enum",
                    value: "foobar"
                },
                {
                    block: "new_sprite",
                    args: [
                        {
                            kind: "image",
                            value: ":)",
                        },
                        {
                            kind: "enum",
                            value: "player"
                        }
                    ]
                }
            ]
        },
        {
            block: "set_var",
            args: [
                {
                    kind: "enum",
                    value: "foobar"
                },
                {
                    kind: "image",
                    value: ":)",
                },
            ]
        },
        {
            block: "if",
            args: [
                // TODO(dz): handle missing parameters
                [{ kind: "bool", value: true }],
                [
                    {
                        block: "set_var",
                        args: [
                            {
                                kind: "enum",
                                value: "baz"
                            },
                            {
                                kind: "image",
                                value: "-.-",
                            },
                        ]
                    },
                ],
                [{ kind: "bool", value: true }],
                [
                    {
                        block: "set_var",
                        args: [
                            {
                                kind: "enum",
                                value: "bar"
                            },
                            {
                                kind: "image",
                                value: "0.0",
                            },
                        ]
                    },
                ],
                [
                    {
                        block: "set_var",
                        args: [
                            {
                                kind: "enum",
                                value: "cat"
                            },
                            {
                                kind: "image",
                                value: ":P",
                            },
                        ]
                    },
                ],
            ]
        }
    ] // on start
};
// codeTree =
//   {
//     block: "on_start",
//     args: [] // on start
//   }
// TODO @darzu:
let blockDefs = [];
let blockDefsById = {};
// TODO: don't mutate like this... tsk tsk
function addBlockDef(def) {
    blockDefsById[def.id] = def;
    blockDefs.push(def);
}
const initBlockDefs = [
    {
        id: "on_start",
        category: "loops",
        look: "event",
        sections: [
            ["on start"],
            MOUTH
        ]
    },
    {
        id: "set_var",
        category: "variables",
        look: "statement",
        sections: [[
                "set", {
                    // TODO: iterate on enum definition
                    kind: "enum",
                    values: ["foobar", "baz"]
                }, "to", HOLE
            ]]
    },
    {
        id: "new_sprite",
        category: "sprites",
        look: "norm_exp",
        sections: [["new sprite",
                HOLE, "of kind",
                {
                    kind: "enum",
                    values: ["player", "enemy"]
                }
            ]]
    },
    {
        id: "if",
        category: "logic",
        look: "statement",
        sections: [
            ["if", HOLE, "then"],
            MOUTH,
            ["else if", HOLE, "then"],
            MOUTH,
            ["else"],
            MOUTH
        ],
    }
];
initBlockDefs.forEach(addBlockDef);
let pxtBuiltinBlockDefMap = {
    // TODO: logic_compare, logic_boolean, variables_get,
    //    math_number, math_arithmetic,
    "pxt-on-start": "on_start",
    "variables_set": "set_var",
    "controls_if": "if",
};
export async function runSampleBlocks() {
    // load definitions
    let pxtDefs = await getPxtBlockDefs();
    let defs = pxtDefs.map(genDef).filter(b => !!b);
    // console.log("out defs:")
    // console.dir(defs)
    defs.forEach(addBlockDef);
    // load code
    let example = await ajax.getXml("/blocks/sample_blocks.xml");
    console.log(example);
    parseBlocksXml(example);
}
//# sourceMappingURL=legacy-block-ast.js.map