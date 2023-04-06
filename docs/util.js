import { DBG_ASSERT } from "./flags.js";
import { randInt } from "./math.js";
export function assert(cond, msg) {
    // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions
    if (!cond)
        throw new Error(msg ?? "Assertion failed (consider adding a helpful msg).");
}
export function assertDbg(cond, msg) {
    if (DBG_ASSERT)
        assert(cond, msg);
}
export function range(length) {
    return new Array(length).fill(null).map((_, i) => i);
}
export function edges(ts) {
    return range(ts.length + 1).map((i) => [ts[i - 1] || null, ts[i] || null]);
}
export function zip(ts, us) {
    return ts.map((t, i) => [t, us[i]]);
}
export function never(x, msg) {
    throw new Error(msg ?? "Unexpected object: " + x);
}
export function __isSMI(n) {
    // Checks if a number is within the "small integer" range
    //  that V8 uses on 64-bit platforms to efficiently represent
    //  small ints. Keeping numbers within this range _should_
    //  lead to better perf esp. for arrays.
    return -(2 ** 31) < n && n < 2 ** 31 - 1;
}
const CHECK_PAIR_RANGE = true;
export function idPair(aId, bId) {
    // TODO(@darzu): need a better hash?
    // TODO(@darzu): for perf, ensure this always produces a V8 SMI when given two <2^16 SMIs.
    //                Also maybe constrain ids to <2^16
    // if (CHECK_PAIR_RANGE) {
    //   assert(aId < 2 ** 16 && bId < 2 ** 16, "IDs r too big for idPair!");
    // }
    const h = aId < bId ? (aId << 16) ^ bId : (bId << 16) ^ aId;
    // TODO(@darzu): DEBUGGING for perf, see comments in __isSMI
    // if (CHECK_PAIR_RANGE && !__isSMI(h))
    //   console.error(`id pair hash isn't SMI: ${h}`);
    return h;
}
export function packI16s(a, b) {
    // if (CHECK_PAIR_RANGE && (a >= 2 ** 15 || a <= -(2 ** 15)))
    //   console.error(`numbers in num pair r too big!`);
    // if (CHECK_PAIR_RANGE && (b >= 2 ** 15 || b <= -(2 ** 15)))
    //   console.error(`numbers in num pair r too big!`);
    // console.log(
    //   `${aNeg}${bNeg}\n${toBinary(aP)}\n${toBinary(bP)}\n${toBinary(h)}\n`
    // );
    // if (CHECK_PAIR_RANGE && !__isSMI(h))
    //   console.error(`id pair hash isn't SMI: ${h}`);
    return (a << 16) | (b & 0xffff);
}
// NOTE:
//  using [number, number] takes ~1500ms for 1,000,000,000 pack/unpacks
//  using { a: number; b: number } takes ~640ms for 1,000,000,000 pack/unpacks
// but the [,] notation is more convenient and fast enough for now.
export function unpackI16s(ab) {
    return [ab >> 16, (ab << 16) >> 16];
}
// export function unpackI16s(ab: number): { a: number; b: number } {
//   return { a: ab >> 16, b: (ab << 16) >> 16 };
// }
export function testPackUnpackI16() {
    _testPackUnpackI16(0, 0);
    _testPackUnpackI16(1, -1);
    _testPackUnpackI16(-1, 1);
    _testPackUnpackI16(-1000, -1000);
    _testPackUnpackI16(2 ** 15 - 1, -(2 ** 15) + 1);
    _testPackUnpackI16(-(2 ** 15) + 1, 2 ** 15 - 1);
    _testPackUnpackI16(-2747, 1);
    for (let i = 0; i < 10; i++) {
        const a = randInt(-(2 ** 15) + 1, 2 ** 15 - 1);
        const b = randInt(-(2 ** 15) + 1, 2 ** 15 - 1);
        _testPackUnpackI16(a, b);
    }
    // speed test
    // const before = performance.now();
    // let x = -2747;
    // let y = 100;
    // for (let i = 0; i < 1000000000; i++) {
    //   // let { a, b } = unpackI16s(packI16s(x, y));
    //   let [x1, y2] = unpackI16s(packI16s(x, y));
    //   // [x, y] = unpackI16s(packI16s(x, y));
    // }
    // const after = performance.now();
    // console.log(`PackUnpack took ${(after - before).toFixed(2)}ms`);
    function _testPackUnpackI16(a, b) {
        const ab = packI16s(a, b);
        const [a2, b2] = unpackI16s(ab);
        assert(a === a2 && b === b2, `PackUnpackI16 failure\n${a} & ${b}\nbecame ${a2} & ${b2}`);
    }
}
export function isString(val) {
    return typeof val === "string";
}
export function hashCode(s) {
    var hash = 0, i, chr;
    if (s.length === 0)
        return hash;
    for (i = 0; i < s.length; i++) {
        chr = s.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
        // TODO: is the next line necessary?
        hash >>>= 0; // Convert to unsigned
    }
    return hash;
}
export function objMap(a, map) {
    const res = {};
    Object.entries(a).forEach(([n, v1]) => {
        res[n] = map(v1, n);
    });
    return res;
}
export function toRecord(as, key, val) {
    const res = {};
    as.forEach((a) => (res[key(a)] = val(a)));
    return res;
}
// TODO(@darzu): this is is a typescript hack for the fact that just using "false"
//  causes type inference (specifically type narrowing) to not work right in
//  dead code sometimes (last tested with tsc v4.2.3)
export const FALSE = false;
export function toBinary(n, digits = 32) {
    let s = (n >>> 0).toString(2);
    while (s.length < digits)
        s = "0" + s;
    return s;
}
let _logOnceKeys = new Set();
export function dbgLogOnce(key, msg, warn = false) {
    if (!_logOnceKeys.has(key)) {
        _logOnceKeys.add(key);
        console[warn ? "warn" : "log"](msg ?? key);
    }
}
export function dbgDirOnce(key, obj) {
    if (!_logOnceKeys.has(key)) {
        _logOnceKeys.add(key);
        console.dir(obj ?? key);
    }
}
export function dbgOnce(key) {
    if (!_logOnceKeys.has(key)) {
        _logOnceKeys.add(key);
        return true;
    }
    else
        return false;
}
export function isArray(t) {
    return Array.isArray(t);
}
export function isFunction(t) {
    return typeof t === "function";
}
export function isNumber(t) {
    return typeof t === "number";
}
export function capitalize(s) {
    return `${s[0].toUpperCase()}${s.slice(1)}`;
}
export function uncapitalize(s) {
    return `${s[0].toLowerCase()}${s.slice(1)}`;
}
export function pluralize(s) {
    return `${s}s`; // lol
}
export function arraySortedEqual(vs, us) {
    if (vs.length !== us.length)
        return false;
    for (let i = 0; i < vs.length; i++)
        if (vs[i] !== us[i])
            return false;
    return true;
}
export function arrayUnsortedEqual(vs, us) {
    // NOTE: inefficient for large lengths
    if (vs.length !== us.length)
        return false;
    for (let i1 = 0; i1 < vs.length; i1++) {
        let match = false;
        for (let i2 = 0; i2 < vs.length; i2++) {
            if (vs[i1] === us[i2]) {
                match = true;
                break;
            }
        }
        if (!match)
            return false;
    }
    return true;
}
export async function asyncTimeout(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(null);
        }, ms);
    });
}
export function createIntervalTracker(maxSep) {
    let min = Infinity;
    let max = -Infinity;
    const intervals = [];
    function addRange(rMin, rMax) {
        if (min === Infinity ||
            (min - maxSep <= rMin && rMin <= max + maxSep) || // rMin is inside
            (min - maxSep <= rMax && rMax <= max + maxSep) // rMax is inside
        ) {
            // update interval
            min = Math.min(min, rMin);
            max = Math.max(max, rMax);
        }
        else {
            // start new interval
            intervals.push({ min, max });
            min = rMin;
            max = rMax;
        }
    }
    function finishInterval() {
        if (min !== Infinity) {
            intervals.push({ min, max });
            min = Infinity;
            max = -Infinity;
        }
    }
    return {
        intervals,
        addRange,
        finishInterval,
    };
}
//# sourceMappingURL=util.js.map