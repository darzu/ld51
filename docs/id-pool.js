"use strict";
// ring buffer
function createRingBufferPool(size) {
    let _last = -1;
    let generation = 0;
    function next() {
        let next = _last + 1;
        if (next >= size) {
            next = 0;
            generation += 1;
        }
        _last = next;
        return next;
    }
    return {
        next,
        generation,
        _last,
    };
}
// random access
//
//# sourceMappingURL=id-pool.js.map