export function isStmt(stmt) {
    return stmt.kind === "stmt" || stmt.kind === "multi";
}
export function isStmtList(es) {
    if (!es || !es.length)
        return true;
    return isStmt(es[0]);
}
//# sourceMappingURL=bast.js.map