// Convert existing browser records into independently mergeable values.
const SET_FIELDS = new Set(['mistakes', 'bookmarks', 'wordbook'])
const MAP_FIELDS = new Set(['readingStates', 'readingTools', 'practiceAnswers', 'practiceIndex', 'paperWork'])

const id = parts => JSON.stringify(parts)
const put = (out, parts, value) => { out[id(parts)] = JSON.stringify(value) }
const object = value => value && typeof value === 'object' && !Array.isArray(value)

export function flatten(records) {
  const out = {}
  for (const [storageKey, raw] of Object.entries(records)) {
    if (storageKey === 'tem8_lamp') { put(out, ['lamp'], raw); continue }
    let data
    try { data = JSON.parse(raw) } catch { continue }
    if (!object(data)) continue
    if (storageKey === 'tem8_studio_web_v1') {
      for (const [field, value] of Object.entries(data)) {
        if (SET_FIELDS.has(field) && Array.isArray(value)) {
          for (const item of value) put(out, ['main', field, JSON.stringify(item)], item)
        } else if (MAP_FIELDS.has(field) && object(value)) {
          for (const [key, entry] of Object.entries(value)) put(out, ['main', field, key], entry)
        } else put(out, ['main', field], value)
      }
    } else if (storageKey === 'tem8_workflow_v2') {
      for (const [field, value] of Object.entries(data)) {
        if (field === 'history' && Array.isArray(value)) {
          for (const run of value) put(out, ['workflow', 'history', `${run.finishedAt || 0}:${run.type || ''}:${run.year || ''}`], run)
        } else if (field === 'tools' && object(value)) {
          for (const [key, entry] of Object.entries(value)) put(out, ['workflow', 'tools', key], entry)
        } else put(out, ['workflow', field], value)
      }
    } else if (storageKey === 'tem8_annotations_v1') {
      for (const [field, value] of Object.entries(data)) {
        if (field !== 'articles' || !object(value)) { put(out, ['annotations', field], value); continue }
        for (const [articleId, article] of Object.entries(value)) {
          if (!object(article)) continue
          for (const [part, entries] of Object.entries(article)) {
            if (part === 'notes' && Array.isArray(entries)) {
              for (const note of entries) put(out, ['annotations', 'articles', articleId, 'notes', String(note.id || `${note.i}:${note.at}`)], note)
            } else if (part === 'marks' && Array.isArray(entries)) {
              for (const mark of entries) put(out, ['annotations', 'articles', articleId, 'marks', `${mark.i}:${mark.s}:${mark.e}`], mark)
            } else put(out, ['annotations', 'articles', articleId, part], entries)
          }
        }
      }
    } else if (storageKey === 'tem8_intensive_v1') {
      for (const [field, value] of Object.entries(data)) {
        if (field === 'corrections' && object(value)) {
          for (const [key, entry] of Object.entries(value)) put(out, ['intensive', 'corrections', key], entry)
        } else put(out, ['intensive', field], value)
      }
    }
  }
  return out
}

export function inflate(rows) {
  const result = {main: {}, workflow: {}, annotations: {articles: {}}, intensive: {}}
  let lamp
  for (const row of rows) {
    if (row.deleted) continue
    let path, value
    try { path = JSON.parse(row.item_key); value = JSON.parse(row.value) } catch { continue }
    if (!Array.isArray(path)) continue
    const [kind, field, key, part, itemId] = path
    if (kind === 'lamp') { lamp = value; continue }
    if (kind === 'main') {
      if (path.length === 3 && SET_FIELDS.has(field)) (result.main[field] ||= []).push(value)
      else if (path.length === 3 && MAP_FIELDS.has(field)) (result.main[field] ||= {})[key] = value
      else if (path.length === 2) result.main[field] = value
    } else if (kind === 'workflow') {
      if (field === 'history' && path.length === 3) (result.workflow.history ||= []).push(value)
      else if (field === 'tools' && path.length === 3) (result.workflow.tools ||= {})[key] = value
      else if (path.length === 2) result.workflow[field] = value
    } else if (kind === 'annotations') {
      if (field === 'articles' && path.length >= 4) {
        const article = result.annotations.articles[key] ||= {marks: [], notes: []}
        if (path.length === 5 && (part === 'marks' || part === 'notes')) article[part].push(value)
        else if (path.length === 4) article[part] = value
      } else if (path.length === 2) result.annotations[field] = value
    } else if (kind === 'intensive') {
      if (field === 'corrections' && path.length === 3) (result.intensive.corrections ||= {})[key] = value
      else if (path.length === 2) result.intensive[field] = value
    }
  }
  if (result.workflow.history) result.workflow.history.sort((a, b) => (a.finishedAt || 0) - (b.finishedAt || 0))
  for (const article of Object.values(result.annotations.articles)) {
    article.marks.sort((a, b) => (a.i - b.i) || (a.s - b.s))
    article.notes.sort((a, b) => (a.at || 0) - (b.at || 0))
  }
  const records = {}
  for (const [kind, storageKey] of [['main', 'tem8_studio_web_v1'], ['workflow', 'tem8_workflow_v2'], ['annotations', 'tem8_annotations_v1'], ['intensive', 'tem8_intensive_v1']]) {
    if (Object.keys(result[kind]).length && !(kind === 'annotations' && !Object.keys(result.annotations.articles).length && Object.keys(result.annotations).length === 1)) records[storageKey] = JSON.stringify(result[kind])
  }
  if (lamp !== undefined) records.tem8_lamp = lamp
  return records
}

export function changes(current, shadow, serverRows, initialized) {
  const server = new Map(serverRows.map(row => [row.item_key, row]))
  const keys = initialized ? new Set([...Object.keys(current), ...Object.keys(shadow)]) : new Set(Object.keys(current))
  const result = []
  for (const key of keys) {
    if (initialized && current[key] === shadow[key]) continue
    if (!initialized && server.has(key)) continue // Existing cloud deletion wins when joining a code.
    result.push({item_key: key, value: current[key] ?? null, deleted: current[key] === undefined})
  }
  return result
}

export function remoteValues(rows) {
  const out = {}
  for (const row of rows) if (!row.deleted) out[row.item_key] = row.value
  return out
}
