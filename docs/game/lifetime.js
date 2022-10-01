import { DeletedDef } from "../delete.js";
import { EM } from "../entity-manager.js";
import { AuthorityDef, MeDef } from "../net/components.js";
import { TimeDef } from "../time.js";
export const LifetimeDef = EM.defineComponent("lifetime", (ms) => {
    return { ms };
});
export function registerUpdateLifetimes(em) {
    em.registerSystem([LifetimeDef], [TimeDef, MeDef], (objs, res) => {
        for (let o of objs) {
            if (em.hasComponents(o, [AuthorityDef]))
                if (o.authority.pid !== res.me.pid)
                    continue;
            o.lifetime.ms -= res.time.dt;
            if (o.lifetime.ms < 0) {
                em.addComponent(o.id, DeletedDef);
            }
        }
    }, "updateLifetimes");
}
//# sourceMappingURL=lifetime.js.map