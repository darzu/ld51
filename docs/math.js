import { assert } from "./test.js";
// functions
export function sum(ns) {
    return ns.reduce((p, n) => p + n, 0);
}
export function max(ns) {
    return ns.reduce((p, n) => (p > n ? p : n), -Infinity);
}
export function avg(ns) {
    return sum(ns) / ns.length;
}
export function clamp(n, min, max) {
    if (n < min)
        return min;
    else if (n > max)
        return max;
    return n;
}
export function min(ns) {
    return ns.reduce((p, n) => (p < n ? p : n), Infinity);
}
export function even(n) {
    return n % 2 == 0;
}
export const radToDeg = 180 / Math.PI;
export function jitter(radius) {
    return (Math.random() - 0.5) * radius * 2;
}
export function randInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function align(x, size) {
    return Math.ceil(x / size) * size;
}
export function chance(zeroToOne) {
    return Math.random() < zeroToOne;
}
// maps a number from [inMin, inMax] to [outMin, outMax]
export function mathMap(n, inMin, inMax, outMin, outMax) {
    assert(inMin < inMax, "must be: inMin < inMax");
    assert(outMin <= outMax, "must be: outMin <= outMax");
    assert(inMin <= n && n <= inMax, "must be: inMin <= n && n <= inMax");
    const progress = (n - inMin) / (inMax - inMin);
    return progress * (outMax - outMin) + outMin;
}
export function mathMapNEase(n, inMin, inMax, outMin, outMax, easeFn) {
    assert(inMin < inMax, "must be: inMin < inMax");
    assert(outMin <= outMax, "must be: outMin <= outMax");
    n = Math.max(n, inMin);
    n = Math.min(n, inMax);
    let progress = (n - inMin) / (inMax - inMin);
    if (easeFn)
        progress = easeFn(progress);
    return progress * (outMax - outMin) + outMin;
}
