"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUuid = isUuid;
exports.resolveUuidToId = resolveUuidToId;
exports.resolveTenantSlugToId = resolveTenantSlugToId;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Verifica se o valor é um UUID válido */
function isUuid(value) {
    return !!value?.trim() && UUID_REGEX.test(value.trim());
}
/** Resolve uuid para id (integer) de uma tabela. Retorna null se não encontrar. */
async function resolveUuidToId(pool, table, uuid) {
    if (!isUuid(uuid))
        return null;
    const result = await pool.query(`SELECT id FROM ${table} WHERE uuid = $1`, [uuid]);
    return result.rowCount && result.rowCount > 0 ? result.rows[0].id : null;
}
/** Resolve slug para id (integer) de tenants. Retorna null se não encontrar. */
async function resolveTenantSlugToId(pool, slug) {
    if (!slug?.trim())
        return null;
    const result = await pool.query("SELECT id FROM tenants WHERE slug = $1", [slug.trim()]);
    return result.rowCount && result.rowCount > 0 ? result.rows[0].id : null;
}
