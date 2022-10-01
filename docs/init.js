import { assert } from "./test.js";
let hasInitPassed = false;
const onInitFns = [];
export function onInit(fn) {
    assert(!hasInitPassed, `trying to add an init fn but init has already happened!`);
    onInitFns.push(fn);
}
export function callInitFns(em) {
    assert(!hasInitPassed, "double init");
    hasInitPassed = true;
    onInitFns.forEach((fn) => fn(em));
}
//# sourceMappingURL=init.js.map