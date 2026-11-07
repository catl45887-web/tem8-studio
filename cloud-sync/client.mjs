import {flatten, inflate, changes, remoteValues} from './sync-core.mjs'

const ENDPOINT = String(window.TEM8_SYNC_ENDPOINT || '').replace(/\/$/, '')
const META_KEY = 'tem8_sync_v1'
const DATA_KEYS = ['tem8_studio_web_v1', 'tem8_workflow_v2', 'tem8_annotations_v1', 'tem8_intensive_v1', 'tem8_lamp']
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const $ = id => document.getElementById(id)
let busy = false, queued = false, timer = 0, userInteracted = false, generation = 0

function readMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || 'null') || {} } catch { return {} }
}
function saveMeta(data) { localStorage.setItem(META_KEY, JSON.stringify(data)) }
function readRecords() {
  const out = {}
  for (const key of DATA_KEYS) {
    const value = localStorage.getItem(key)
    if (value !== null) out[key] = value
  }
  return out
}
function equal(a, b) {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key])
}
function captureLocalChanges() {
  const meta = readMeta()
  if (!meta.code) return
  const current = flatten(readRecords())
  const observed = meta.observed || meta.shadow || {}
  const pending = {...(meta.pending || {})}
  let clock = Number(meta.clock) || 0
  for (const key of new Set([...Object.keys(current), ...Object.keys(observed)])) {
    if (current[key] === observed[key]) continue
    clock = Math.max(Date.now(), clock + 1)
    pending[key] = {item_key: key, value: current[key] ?? null, deleted: current[key] === undefined, revision: clock, device_id: meta.deviceId}
  }
  saveMeta({...meta, observed: current, pending, clock})
}
function normalize(code) { return String(code || '').replace(/[\s-]/g, '').toUpperCase() }
function createCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let bits = 0, buffer = 0, result = ''
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) { result += ALPHABET[(buffer >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits) result += ALPHABET[(buffer << (5 - bits)) & 31]
  return result
}
function displayCode(code) { return code.match(/.{1,4}/g)?.join('-') || '' }
function status(text) { $('sync-status').textContent = text }
function showLastSuccess(meta = readMeta()) {
  const time = Number(meta.lastSuccessAt)
  $('sync-last-success').textContent = time && Number.isFinite(time)
    ? `本设备最近成功同步：${new Date(time).toLocaleString('zh-CN')}`
    : '尚未成功同步'
}
function render() {
  const connected = !!readMeta().code
  $('sync-disconnected').hidden = connected
  $('sync-connected').hidden = !connected
  showLastSuccess()
  if (connected) $('sync-code-display').textContent = displayCode(readMeta().code)
  if (!ENDPOINT) {
    status('云端服务尚未接通，当前仍使用本机记录。')
    for (const key of ['sync-create', 'sync-join', 'sync-now']) document.querySelector(`[data-${key}]`)?.setAttribute('disabled', '')
  } else if (!connected) status('尚未开启同步。已有备份仍可在上方导入。')
}
async function api(method, code, path = '', body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(`${ENDPOINT}/v1/sync${path}`, {
      method,
      headers: {'Authorization': `Bearer ${code}`, ...(body ? {'Content-Type': 'application/json'} : {})},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit', cache: 'no-store', signal: controller.signal,
      keepalive: method === 'POST' && document.hidden && JSON.stringify(body).length < 60000
    })
    if (!response.ok) throw new Error(`服务返回 ${response.status}`)
    return response.json()
  } finally { clearTimeout(timeout) }
}
async function fetchAll(code) {
  const items = []
  let cursor = ''
  do {
    const data = await api('GET', code, cursor ? `?cursor=${encodeURIComponent(cursor)}` : '')
    if (!Array.isArray(data.items)) throw new Error('云端数据格式无效')
    items.push(...data.items)
    cursor = data.nextCursor || ''
    if (items.length > 10000) throw new Error('云端记录过多，请联系维护者')
  } while (cursor)
  return items
}
async function upload(code, items) {
  let chunk = [], size = 0
  const send = async () => { if (chunk.length) await api('POST', code, '', {items: chunk}); chunk = []; size = 0 }
  for (const item of items) {
    const bytes = JSON.stringify(item).length
    if (chunk.length >= 40 || size + bytes > (document.hidden ? 50000 : 400000)) await send()
    chunk.push(item)
    size += bytes
  }
  await send()
}
function applyRemote(records, meta) {
  const previous = readRecords()
  try {
    for (const key of DATA_KEYS) {
      if (Object.hasOwn(records, key)) localStorage.setItem(key, records[key])
      else localStorage.removeItem(key)
    }
    saveMeta(meta)
  } catch (error) {
    for (const key of DATA_KEYS) {
      try {
        if (Object.hasOwn(previous, key)) localStorage.setItem(key, previous[key])
        else localStorage.removeItem(key)
      } catch {}
    }
    throw error
  }
  window.TEM8_IMPORTING_BACKUP = true
  location.reload()
}
function canApply() {
  if (document.hidden) return false
  if ($('my-view').classList.contains('active')) return true
  return !userInteracted && $('home-view').classList.contains('active')
}
async function sync() {
  if (!ENDPOINT || !readMeta().code) return
  if (busy) { queued = true; return }
  busy = true
  const token = generation, meta = readMeta(), code = meta.code
  try {
    window.TEM8_SYNC_FLUSHING = true
    document.dispatchEvent(new Event('tem8:flush-records'))
    window.TEM8_SYNC_FLUSHING = false
    const current = flatten(readRecords())
    const shadow = meta.shadow || {}
    let serverRows = await fetchAll(code)
    if (token !== generation) return
    let clock = Number(meta.clock) || 0
    const pending = changes(current, shadow, serverRows, !!meta.initialized)
      .map(item => {
        const captured = meta.pending?.[item.item_key]
        if (captured && captured.value === item.value && captured.deleted === item.deleted) return captured
        clock = Math.max(Date.now(), clock + 1)
        return {...item, revision: clock, device_id: meta.deviceId}
      })
    if (pending.length) {
      await upload(code, pending)
      serverRows = await fetchAll(code)
    }
    if (token !== generation) return
    const latest = flatten(readRecords())
    if (!equal(current, latest)) { queued = true; return }
    const remote = remoteValues(serverRows)
    const updated = {...meta, initialized: true, lastSuccessAt: Date.now(), clock: Math.max(clock, ...serverRows.map(row => Number(row.revision) || 0)), shadow: remote, observed: remote, pending: {}}
    if (!equal(current, remote)) {
      if (canApply()) {
        status('已取得云端更新，正在刷新页面…')
        applyRemote(inflate(serverRows), updated)
        return
      }
      status('云端有新记录。做题完成后打开「我的」，即可安全应用更新。')
      return
    }
    saveMeta(updated)
    showLastSuccess(updated)
    status(pending.length ? '学习记录已同步。' : '已是最新记录。')
  } catch (error) {
    status('暂时连不上云端，做题记录都在本机，不受影响。')
  } finally {
    window.TEM8_SYNC_FLUSHING = false
    busy = false
    if (queued) { queued = false; schedule(1000) }
  }
}
function schedule(delay = 1500) {
  if (!readMeta().code || !ENDPOINT) return
  clearTimeout(timer)
  timer = setTimeout(sync, delay)
}
async function connect(code) {
  code = normalize(code)
  if (!/^[A-Z2-7]{26}$/.test(code)) { status('同步码格式不正确，请检查后重试。'); return }
  const current = readMeta()
  if (current.code === code) { status('这台设备已经在使用这个同步码。'); return }
  if (current.code && !confirm('绑定这个同步码？这台设备会改用新码，现有学习记录会与新码下的记录合并。原同步码下的其他设备不会再收到这台设备的新记录。')) return
  saveMeta({code, deviceId: current.deviceId || crypto.randomUUID(), clock: 0, shadow: {}, observed: flatten(readRecords()), pending: {}, initialized: false})
  generation++
  render()
  $('sync-code-input').value = ''
  status('正在连接云端并合并本机记录…')
  await sync()
}

document.addEventListener('pointerdown', () => { userInteracted = true }, {once: true})
document.addEventListener('keydown', () => { userInteracted = true }, {once: true})
document.addEventListener('tem8:study-changed', () => { captureLocalChanges(); schedule() })
document.addEventListener('visibilitychange', () => { if (readMeta().code) document.hidden ? sync() : schedule(500) })
document.addEventListener('click', event => {
  const target = event.target.closest('button')
  if (!target) return
  if (target.dataset.syncCreate !== undefined) connect(createCode())
  if (target.dataset.syncJoin !== undefined) connect($('sync-code-input').value)
  if (target.dataset.syncNow !== undefined) sync()
  if (target.dataset.syncCopy !== undefined) {
    navigator.clipboard.writeText(displayCode(readMeta().code)).then(() => status('同步码已复制，请妥善保管。')).catch(() => status('复制失败，请手动选中同步码。'))
  }
  if (target.dataset.syncStop !== undefined && confirm('停止本设备同步？云端记录不会删除，之后仍可用同步码重新连接。')) {
    generation++
    localStorage.removeItem(META_KEY)
    render()
  }
  if (target.dataset.view === 'my' && readMeta().code) schedule(0)
})

render()
if (readMeta().code) schedule(0)
