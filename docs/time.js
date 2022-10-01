import { EM } from "./entity-manager.js";
export const TimeDef = EM.defineComponent("time", () => ({
    time: 0,
    lastTime: 0,
    step: 0,
    dt: 0,
}));
export function tick(em, dt) {
    const time = em.ensureSingletonComponent(TimeDef);
    time.lastTime = time.time;
    time.time += dt;
    time.step += 1;
    time.dt = dt;
}
//# sourceMappingURL=time.js.map