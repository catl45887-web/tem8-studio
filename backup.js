(() => {
  'use strict'

  const DATA_KEYS = ['tem8_studio_web_v1', 'tem8_workflow_v2', 'tem8_annotations_v1', 'tem8_intensive_v1', 'tem8_lamp', 'tem8_dict_v1', 'tem8_time_v1']
  const JSON_KEYS = DATA_KEYS.filter(key => key !== 'tem8_lamp')
  const META_KEY = 'tem8_backup_meta_v1'
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const MAX_FILE_SIZE = 12 * 1024 * 1024
  const $ = id => document.getElementById(id)

  function readJSON(key, fallback = {}) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback } catch { return fallback }
  }
  function meta() { return readJSON(META_KEY) }
  function saveMeta(next) { localStorage.setItem(META_KEY, JSON.stringify(next)) }
  function records() {
    const result = {}
    for (const key of DATA_KEYS) {
      const value = localStorage.getItem(key)
      if (value !== null) result[key] = value
    }
    return result
  }
  function hasStudyRecords() {
    const main = readJSON(DATA_KEYS[0])
    if (main.sessions || main.attempted || main.draft || main.lastResult) return true
    if (['mistakes', 'bookmarks', 'wordbook'].some(key => main[key]?.length)) return true
    if (['readingStates', 'readingTools', 'practiceAnswers', 'practiceIndex', 'paperWork'].some(key => Object.keys(main[key] || {}).length)) return true
    const workflow = readJSON(DATA_KEYS[1])
    if (workflow.session || workflow.history?.length || Object.keys(workflow.tools || {}).length) return true
    const annotations = readJSON(DATA_KEYS[2])
    if (Object.values(annotations.articles || {}).some(article => article.marks?.length || article.notes?.length)) return true
    return Object.keys(readJSON(DATA_KEYS[3])).length > 0
  }
  function message(text) { $('backup-message').textContent = text }
  function refresh() {
    const hasData = hasStudyRecords()
    $('backup-summary').textContent = hasData ? '当前浏览器已有学习记录。' : '当前浏览器暂未发现学习记录。'
    const last = Number(meta().lastBackupAt)
    $('backup-last').textContent = last ? `上次导出：${new Date(last).toLocaleString('zh-CN')}` : '还没有导出过备份。'
  }
  function remind() {
    const banner = $('backup-reminder')
    if (!hasStudyRecords()) { banner.hidden = true; return }
    const info = meta(), now = Date.now()
    if (now - Number(info.lastBackupAt || 0) <= WEEK || now - Number(info.lastReminderAt || 0) <= WEEK) {
      banner.hidden = true
      return
    }
    banner.hidden = false
    saveMeta({ ...info, lastReminderAt: now })
  }
  function exportBackup() {
    try {
      document.dispatchEvent(new Event('tem8:flush-records'))
      const backup = { format: 'tem8-study-backup', version: 1, createdAt: new Date().toISOString(), records: records() }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `拾页-学习记录-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      saveMeta({ ...meta(), lastBackupAt: Date.now() })
      $('backup-reminder').hidden = true
      refresh()
      message('备份文件已开始下载。请确认文件已保存在设备上。')
    } catch (error) {
      message(/[\u4e00-\u9fff]/.test(error?.message||'') ? `导出失败：${error.message}` : '导出没有成功，请再试一次。')
    }
  }
  function validateBackup(data) {
    if (!data || data.format !== 'tem8-study-backup' || data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) throw new Error('文件不是受支持的拾页备份。')
    if (!Object.keys(data.records).length) throw new Error('备份文件中没有学习记录。')
    for (const [key, value] of Object.entries(data.records)) {
      if (!DATA_KEYS.includes(key) || typeof value !== 'string') throw new Error('备份文件包含无效记录。')
      if (JSON_KEYS.includes(key)) {
        const parsed = JSON.parse(value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('备份文件中有损坏的记录。')
        if (key === DATA_KEYS[0] && ['mistakes', 'bookmarks', 'wordbook'].some(field => parsed[field] !== undefined && !Array.isArray(parsed[field]))) throw new Error('备份中的错题、收藏或生词格式无效。')
        if (key === DATA_KEYS[1] && parsed.history !== undefined && !Array.isArray(parsed.history)) throw new Error('备份中的练习历史格式无效。')
        if (key === DATA_KEYS[2] && parsed.articles !== undefined && (!parsed.articles || typeof parsed.articles !== 'object' || Array.isArray(parsed.articles))) throw new Error('备份中的标注数据格式无效。')
      } else if (value !== 'on' && value !== 'off') throw new Error('备份文件中有无效设置。')
    }
  }
  async function importBackup(file) {
    if (!file) return
    try {
      if (file.size > MAX_FILE_SIZE) throw new Error('文件超过 12 MB，请确认选择的是学习记录备份。')
      const data = JSON.parse(await file.text())
      validateBackup(data)
      const current = records()
      const confirmText = Object.keys(current).length
        ? '导入会替换这个浏览器现有的学习记录。请先导出当前记录作为备份。确定继续吗？'
        : '导入备份后将恢复其中的学习记录。确定继续吗？'
      if (!window.confirm(confirmText)) return
      try {
        for (const key of DATA_KEYS) {
          if (Object.hasOwn(data.records, key)) localStorage.setItem(key, data.records[key])
          else localStorage.removeItem(key)
        }
      } catch (error) {
        for (const key of DATA_KEYS) {
          try {
            if (Object.hasOwn(current, key)) localStorage.setItem(key, current[key])
            else localStorage.removeItem(key)
          } catch {}
        }
        throw error
      }
      saveMeta({ ...meta(), lastBackupAt: Date.parse(data.createdAt) || Date.now() })
      localStorage.removeItem('tem8_sync_v1')
      message('导入成功，正在刷新页面以显示恢复的记录。')
      window.TEM8_IMPORTING_BACKUP = true
      location.reload()
    } catch (error) {
      message(/[\u4e00-\u9fff]/.test(error?.message||'') ? `导入失败：${error.message}` : '这个文件读不出来，请确认选的是从这里导出的备份。')
    }
  }
  async function persistence(request = false) {
    const status = $('backup-persistence')
    if (!navigator.storage?.persisted) {
      status.textContent = '当前浏览器不支持持久存储申请；请定期导出备份。'
      return
    }
    try {
      let granted = await navigator.storage.persisted()
      if (!granted && request && navigator.storage.persist) granted = await navigator.storage.persist()
      status.textContent = granted ? '浏览器已授予持久存储。手动清理网站数据仍会删除记录，请继续定期备份。' : '浏览器尚未授予持久存储。记录仍保存在本机，请定期导出备份。'
    } catch {
      status.textContent = '无法确认存储状态，请定期导出备份。'
    }
  }
  function storageAvailable() {
    try {
      const key = 'tem8_storage_probe'
      localStorage.setItem(key, '1')
      localStorage.removeItem(key)
      return true
    } catch { return false }
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('button')
    if (!target) return
    if (target.dataset.backupExport !== undefined) exportBackup()
    if (target.dataset.backupImport !== undefined) $('backup-file').click()
    if (target.dataset.backupPersist !== undefined) persistence(true)
    if (target.dataset.backupDismiss !== undefined) $('backup-reminder').hidden = true
    if (target.dataset.view === 'my') setTimeout(refresh, 0)
  })
  $('backup-file').addEventListener('change', event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    importBackup(file)
  })
  if (storageAvailable()) {
    refresh()
    remind()
    persistence(true)
  } else {
    $('backup-summary').textContent = '当前浏览器无法写入学习记录。'
    $('backup-persistence').textContent = '浏览器存储不可用；无痕模式或隐私设置可能导致记录丢失。'
  }
})()
