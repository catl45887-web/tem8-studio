const ALLOWED_ORIGIN = 'https://mytemtime.com'
const MAX_BODY = 512 * 1024
const MAX_VALUE = 128 * 1024
const PAGE_SIZE = 500

function response(data, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Vary': 'Origin'
    }
  })
}

function codeFrom(request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') || '')
  const code = match?.[1].replace(/[\s-]/g, '').toUpperCase() || ''
  return /^[A-Z2-7]{26}$/.test(code) ? code : ''
}

async function codeHash(code) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || ALLOWED_ORIGIN
    if (request.headers.get('Origin') && request.headers.get('Origin') !== origin) return response({error: 'origin_not_allowed'}, 403, origin)
    if (request.method === 'OPTIONS') return response({}, 204, origin)
    const url = new URL(request.url)
    if (url.pathname === '/health' && request.method === 'GET') return response({ok: !!env.DB}, env.DB ? 200 : 503, origin)
    if (url.pathname !== '/v1/sync') return response({error: 'not_found'}, 404, origin)
    if (!env.DB) return response({error: 'database_unavailable'}, 503, origin)
    const code = codeFrom(request)
    if (!code) return response({error: 'invalid_sync_code'}, 401, origin)
    const hash = await codeHash(code)

    try {
      if (request.method === 'GET') {
        const cursor = url.searchParams.get('cursor') || ''
        if (cursor.length > 400) return response({error: 'invalid_cursor'}, 400, origin)
        const query = await env.DB.prepare('SELECT item_key, value, deleted, revision, device_id FROM sync_items WHERE sync_hash = ? AND item_key > ? ORDER BY item_key LIMIT ?')
          .bind(hash, cursor, PAGE_SIZE + 1).all()
        const rows = query.results || []
        const nextCursor = rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].item_key : null
        return response({items: rows.slice(0, PAGE_SIZE), nextCursor}, 200, origin)
      }
      if (request.method === 'POST') {
        const raw = await request.text()
        if (raw.length > MAX_BODY) return response({error: 'payload_too_large'}, 413, origin)
        let payload
        try { payload = JSON.parse(raw) } catch { return response({error: 'invalid_json'}, 400, origin) }
        if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 50) return response({error: 'invalid_items'}, 400, origin)
        const statements = []
        for (const item of payload.items) {
          let path
          try { path = JSON.parse(item?.item_key) } catch { return response({error: 'invalid_item'}, 400, origin) }
          if (!item || typeof item.item_key !== 'string' || item.item_key.length > 400 || !Array.isArray(path) ||
              typeof item.revision !== 'number' || !Number.isSafeInteger(item.revision) || item.revision < 1 || item.revision > Date.now() + 300000 ||
              typeof item.device_id !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(item.device_id) ||
              typeof item.deleted !== 'boolean' || (!item.deleted && (typeof item.value !== 'string' || item.value.length > MAX_VALUE))) {
            return response({error: 'invalid_item'}, 400, origin)
          }
          statements.push(env.DB.prepare(`INSERT INTO sync_items (sync_hash, item_key, value, deleted, revision, device_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(sync_hash, item_key) DO UPDATE SET
              value = excluded.value, deleted = excluded.deleted, revision = excluded.revision, device_id = excluded.device_id
            WHERE excluded.revision > sync_items.revision
               OR (excluded.revision = sync_items.revision AND excluded.device_id > sync_items.device_id)`)
            .bind(hash, item.item_key, item.deleted ? null : item.value, item.deleted ? 1 : 0, item.revision, item.device_id))
        }
        await env.DB.batch(statements)
        return response({ok: true, accepted: statements.length}, 200, origin)
      }
      return response({error: 'method_not_allowed'}, 405, origin)
    } catch (error) {
      return response({error: 'sync_failed'}, 500, origin)
    }
  }
}
