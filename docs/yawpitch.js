import { defineSerializableComponent } from "./em_helpers.js";
import { EM } from "./entity-manager.js";
import { quat } from "./gl-matrix.js";
export const YawPitchDef = defineSerializableComponent(EM, "yawpitch", (yaw, pitch) => {
    return {
        yaw: yaw !== null && yaw !== void 0 ? yaw : 0,
        pitch: pitch !== null && pitch !== void 0 ? pitch : 0,
    };
}, (o, buf) => {
    buf.writeFloat32(o.yaw);
    buf.writeFloat32(o.pitch);
}, (o, buf) => {
    o.yaw = buf.readFloat32();
    o.pitch = buf.readFloat32();
});
export function yawpitchToQuat(out, yp) {
    quat.copy(out, quat.IDENTITY);
    quat.rotateY(out, out, yp.yaw);
    quat.rotateX(out, out, yp.pitch);
    return out;
}
//# sourceMappingURL=yawpitch.js.map