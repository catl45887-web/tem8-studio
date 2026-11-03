import test from 'node:test'
import assert from 'node:assert/strict'
import {flatten, inflate, changes, remoteValues} from './sync-core.mjs'
import worker from './worker.mjs'

const records = {
  tem8_studio_web_v1: JSON.stringify({mistakes: ['q1'], bookmarks: ['q2'], wordbook: ['apple', 'book'], readingStates: {p1: {progress: 2}}, sessions: 1}),
  tem8_workflow_v2: JSON.stringify({history: [{type: 'lecture', year: 2022, finishedAt: 123, answers: {a: 'x'}}], session: null}),
  tem8_annotations_v1: JSON.stringify({v: 1, articles: {p1: {marks: [{i: 0, s: 2, e: 6, t: 'word', c: 'g'}], notes: [{id: 'n1', i: 0, text: 'remember', at: 123}]}}}),
  tem8_intensive_v1: JSON.stringify({year: 2025, section: 'B', corrections: {'2025-B-1': 42}})
}

test('all existing study record types survive flatten and restore', () => {
  const flat = flatten(records)
  const restored = inflate(Object.entries(flat).map(([item_key, value]) => ({item_key, value, deleted: 0})))
  assert.deepEqual(flatten(restored), flat)
  assert.deepEqual(JSON.parse(restored.tem8_studio_web_v1).wordbook.sort(), ['apple', 'book'])
  assert.equal(JSON.parse(restored.tem8_annotations_v1).articles.p1.notes[0].text, 'remember')
})

test('sets merge and deletions stay deleted on a stale device', () => {
  const old = flatten(records)
  const next = {...old}
  delete next[JSON.stringify(['main', 'wordbook', JSON.stringify('apple')])]
  next[JSON.stringify(['main', 'wordbook', JSON.stringify('cat')])] = JSON.stringify('cat')
  const delta = changes(next, old, [], true)
  assert.equal(delta.filter(item => item.deleted).length, 1)
  assert.equal(delta.filter(item => !item.deleted).length, 1)
  const tombstone = {...delta.find(item => item.deleted), revision: 100, device_id: 'device-one'}
  assert.equal(changes(old, old, [tombstone], true).length, 0)
  assert.equal(changes(old, {}, [tombstone], false).find(item => item.item_key === tombstone.item_key), undefined)
  assert.equal(remoteValues([tombstone])[tombstone.item_key], undefined)
})

class FakeDB {
  rows = new Map()
  prepare(sql) {
    const db = this
    return {bind(...args) {
      return {
        args,
        async all() {
          const [hash, cursor, limit] = args
          return {results: [...db.rows.values()].filter(row => row.sync_hash === hash && row.item_key > cursor).sort((a, b) => a.item_key.localeCompare(b.item_key)).slice(0, limit)}
        }
      }
    }}
  }
  async batch(statements) {
    for (const {args} of statements) {
      const [sync_hash, item_key, value, deleted, revision, device_id] = args
      const key = sync_hash + '\0' + item_key, old = this.rows.get(key)
      if (!old || revision > old.revision || (revision === old.revision && device_id > old.device_id)) this.rows.set(key, {sync_hash, item_key, value, deleted, revision, device_id})
    }
  }
}

test('Worker authenticates the code and preserves newer tombstones', async () => {
  const env = {DB: new FakeDB(), ALLOWED_ORIGIN: 'https://mytemtime.com'}
  const code = 'A'.repeat(26)
  const request = (method, body, headers = {}) => new Request('https://sync.example/v1/sync', {
    method, headers: {Origin: 'https://mytemtime.com', Authorization: `Bearer ${code}`, ...headers},
    body: body ? JSON.stringify(body) : undefined
  })
  const item_key = JSON.stringify(['main', 'wordbook', JSON.stringify('apple')])
  const revision = Date.now() - 1000
  const item = {item_key, value: JSON.stringify('apple'), deleted: false, revision, device_id: 'device-one'}
  assert.equal((await worker.fetch(request('OPTIONS'), env)).status, 204)
  assert.equal((await worker.fetch(request('POST', {items: [item]}, {'Content-Type': 'application/json'}), env)).status, 200)
  let rows = (await (await worker.fetch(request('GET'), env)).json()).items
  assert.equal(rows[0].value, JSON.stringify('apple'))
  const deleted = {...item, value: null, deleted: true, revision: revision + 2}
  await worker.fetch(request('POST', {items: [deleted]}, {'Content-Type': 'application/json'}), env)
  await worker.fetch(request('POST', {items: [item]}, {'Content-Type': 'application/json'}), env)
  rows = (await (await worker.fetch(request('GET'), env)).json()).items
  assert.equal(rows[0].deleted, 1)
  assert.equal((await worker.fetch(new Request('https://sync.example/v1/sync', {headers: {Origin: 'https://wrong.example', Authorization: `Bearer ${code}`}}), env)).status, 403)
  assert.equal((await worker.fetch(new Request('https://sync.example/v1/sync', {headers: {Origin: 'https://mytemtime.com', Authorization: 'Bearer weak'}}), env)).status, 401)
})
