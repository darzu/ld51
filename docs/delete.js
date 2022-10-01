import { EM } from "./entity-manager.js";
import { SyncDef } from "./net/components.js";
export const DeletedDef = EM.defineComponent("deleted", () => ({
    processed: false,
}));
EM.registerSerializerPair(DeletedDef, () => {
    return;
}, () => {
    return;
});
export function registerDeleteEntitiesSystem(em) {
    em.registerSystem([DeletedDef], [], (entities) => {
        for (let entity of entities) {
            if (!entity.deleted.processed) {
                // TODO: remove from renderer
                // TODO(@darzu): yuck, we just wrote a destructor. Also not sure
                //    this is serializable or network-able
                if (OnDeleteDef.isOn(entity))
                    entity.onDelete(entity.id);
                em.keepOnlyComponents(entity.id, [DeletedDef, SyncDef]);
                if (SyncDef.isOn(entity)) {
                    entity.sync.dynamicComponents = [];
                    entity.sync.fullComponents = [DeletedDef.id];
                }
                entity.deleted.processed = true;
            }
        }
    }, "delete");
}
// TODO(@darzu): uh oh. this seems like memory/life cycle management.
//    currently this is needed for entities that "own" other
//    entities but might be deleted in several ways
export const OnDeleteDef = EM.defineComponent("onDelete", (onDelete) => onDelete);
//# sourceMappingURL=delete.js.map