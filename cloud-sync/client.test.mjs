import test from 'node:test'
import assert from 'node:assert/strict'

test('browser client creates a code, uploads a word, then sends its deletion', async () => {
  const storage = new Map([['tem8_studio_web_v1', JSON.stringify({wordbook: ['apple']})]])
  const server = new Map(), listeners = new Map(), elements = new Map()
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  }
  const element = id => {
    if (!elements.has(id)) elements.set(id, {hidden: false, textContent: '', value: '', classList: {contains: value => id === 'my-view' && value === 'active'}, setAttribute() {}})
    return elements.get(id)
  }
  const document = {
    hidden: false,
    getElementById: element,
    querySelector: () => ({setAttribute() {}}),
    addEventListener: (type, listener) => listeners.set(type, listener),
    dispatchEvent: event => listeners.get(event.type)?.(event)
  }
  const original = {window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage, fetch: globalThis.fetch, location: globalThis.location}
  globalThis.window = {TEM8_SYNC_ENDPOINT: 'https://sync.example'}
  globalThis.document = document
  globalThis.localStorage = localStorage
  globalThis.location = {reload() { throw new Error('unexpected reload') }}
  globalThis.fetch = async (url, options) => {
    if (options.method === 'GET') return Response.json({items: [...server.values()], nextCursor: null})
    const payload = JSON.parse(options.body)
    for (const item of payload.items) {
      const old = server.get(item.item_key)
      if (!old || item.revision > old.revision) server.set(item.item_key, item)
    }
    return Response.json({ok: true, accepted: payload.items.length})
  }
  const waitFor = async condition => {
    for (let i = 0; i < 80; i++) {
      if (condition()) return
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error('condition was not reached')
  }
  try {
    await import('./client.mjs?smoke-test')
    listeners.get('click')({target: {closest: () => ({dataset: {syncCreate: ''}})}})
    await waitFor(() => JSON.parse(storage.get('tem8_sync_v1') || '{}').initialized)
    const meta = JSON.parse(storage.get('tem8_sync_v1'))
    assert.match(meta.code, /^[A-Z2-7]{26}$/)
    const wordKey = JSON.stringify(['main', 'wordbook', JSON.stringify('apple')])
    assert.equal(server.get(wordKey).value, JSON.stringify('apple'))
    storage.set('tem8_studio_web_v1', JSON.stringify({wordbook: []}))
    document.dispatchEvent(new Event('tem8:study-changed'))
    const deletionRevision = JSON.parse(storage.get('tem8_sync_v1')).pending[wordKey].revision
    await waitFor(() => server.get(wordKey)?.deleted === true)
    assert.equal(server.get(wordKey).revision, deletionRevision)
    assert.equal(JSON.parse(storage.get('tem8_sync_v1')).shadow[wordKey], undefined)
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})
