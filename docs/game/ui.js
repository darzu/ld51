import { EM } from "../entity-manager.js";
export const TextDef = EM.defineComponent("text", () => {
    return {
        upperText: "",
        lowerText: "",
        debugText: "",
    };
});
export function registerUISystems(em) {
    em.addSingletonComponent(TextDef);
    const titleDiv = document.getElementById("title-div");
    const debugDiv = document.getElementById("debug-div");
    const lowerDiv = document.getElementById("lower-div");
    em.registerSystem(null, [TextDef], (_, res) => {
        // PERF NOTE: using ".innerText =" creates a new DOM element each frame, whereas
        //    using ".firstChild.nodeValue =" reuses the DOM element. Unfortunately this
        //    means we'll need to do more work to get line breaks.
        titleDiv.firstChild.nodeValue = res.text.upperText;
        debugDiv.firstChild.nodeValue = res.text.debugText;
        lowerDiv.firstChild.nodeValue = res.text.lowerText;
    }, "uiText");
}
//# sourceMappingURL=ui.js.map