/**
 * Search Relay - 设置页面逻辑
 *
 * 功能：
 * 1. 加载和保存用户配置
 * 2. 管理搜索引擎（使用 Grid.js 展示列表）
 */

import { DEFAULT_ENGINES } from './config.js'

// i18n() 函数由 i18n.js 提供

// ============================================
// DOM 元素引用
// ============================================

const elements = {
  // 目标引擎选择
  targetEngine: document.getElementById('targetEngine'),
  showBadge: document.getElementById('showBadge'),
  languageSelect: document.getElementById('languageSelect'),

  // 添加/编辑引擎表单
  newEngineName: document.getElementById('newEngineName'),
  newEngineBadge: document.getElementById('newEngineBadge'),
  newEngineUrl: document.getElementById('newEngineUrl'),
  newEngineDomain: document.getElementById('newEngineDomain'),
  newEngineParam: document.getElementById('newEngineParam'),
  newEngineIsTarget: document.getElementById('newEngineIsTarget'),
  addEngine: document.getElementById('addEngine'),
  cancelEditEngine: document.getElementById('cancelEditEngine'),
  enginesGrid: document.getElementById('engines-grid'),
  addEngineDetails: document.getElementById('addEngineDetails'),

  // 其他
  resetDefaults: document.getElementById('resetDefaults'),
  snackbarContainer: document.getElementById('snackbar-container'),
}

// ============================================
// 状态管理
// ============================================

let state = {
  targetEngine: 'google',
  showBadge: false,
  language: 'auto',
  engines: [...DEFAULT_ENGINES],
}

// 当前正在编辑的引擎ID，null 表示添加新引擎
let editingEngineId = null

// Grid.js 实例
let grid = null

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings()

  // 初始化语言
  if (typeof initLanguage === 'function') {
    await initLanguage(state.language)
  }

  // 初始化国际化
  if (typeof initI18n === 'function') {
    initI18n()
  }

  initGrid()
  bindEvents()
  renderAll()
  initVersion()
})

/**
 * 初始化版本号显示
 */
function initVersion() {
  const versionSpan = document.getElementById('extVersion')
  if (versionSpan) {
    const manifest = chrome.runtime.getManifest()
    versionSpan.textContent = `v${manifest.version}`
  }
}

/**
 * 从 Chrome Storage 加载设置
 */
async function loadSettings() {
  try {
    const stored = await chrome.storage.sync.get([
      'targetEngine',
      'showBadge',
      'language',
      'engines',
    ])

    if (stored.targetEngine) {
      state.targetEngine = stored.targetEngine
    }
    if (typeof stored.showBadge !== 'undefined') {
      state.showBadge = stored.showBadge
    }
    if (stored.language) {
      state.language = stored.language
    }
    if (stored.engines && stored.engines.length > 0) {
      state.engines = stored.engines
    }

    console.log('[Search Relay Options] 配置已加载:', state)
  } catch (error) {
    console.error('[Search Relay Options] 加载配置失败:', error)
  }
}

/**
 * 保存设置到 Chrome Storage
 */
async function saveSettings() {
  try {
    await chrome.storage.sync.set({
      targetEngine: state.targetEngine,
      showBadge: state.showBadge,
      language: state.language,
      engines: state.engines,
    })

    showStatus(i18n('statusSaved'))
    console.log('[Search Relay Options] 配置已保存:', state)
  } catch (error) {
    console.error('[Search Relay Options] 保存配置失败:', error)
    showStatus(i18n('statusSaveFailed'), true)
  }
}

// ============================================
// Grid.js 初始化与渲染
// ============================================

function initGrid() {
  grid = new gridjs.Grid({
    columns: [
      { id: 'name', name: i18n('gridColumnName'), sort: true, width: '10%' },
      {
        id: 'badge',
        name: i18n('gridColumnBadge'),
        width: '100px',
        formatter: (cell) =>
          gridjs.html(`<span class="cell-badge">${escapeHtml(cell)}</span>`),
      },
      {
        id: 'url',
        name: i18n('gridColumnUrl'),
        formatter: (cell) =>
          gridjs.html(
            `<span class="cell-url" title="${escapeHtml(cell)}">${escapeHtml(cell)}</span>`,
          ),
      },
      { id: 'param', name: i18n('gridColumnParam'), width: '100px' },
      {
        id: 'isTarget',
        name: i18n('gridColumnTarget'),
        sort: true,
        width: '10.5%',
        formatter: (cell, row) => {
          const id = row.cells[5].data // 获取隐藏的 ID 列
          return gridjs.html(`
                        <input type="checkbox" 
                               class="chk-target" 
                               data-id="${id}" 
                               ${cell ? 'checked' : ''} />
                    `)
        },
      },
      {
        id: 'actions',
        name: i18n('gridColumnActions'),
        sort: false,
        width: '8%',
        formatter: (cell, row) => {
          const id = row.cells[5].data
          const editTitle = i18n('editTooltip')
          const deleteTitle = i18n('deleteTooltip')
          const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>`

          return gridjs.html(`
                        <div style="display: flex; gap: 4px; justify-content: center;">
                            <button class="btn-icon btn-edit" data-id="${id}" title="${editTitle}">
                                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
                            </button>
                            <button class="btn-icon btn-delete" data-id="${id}" title="${deleteTitle}">
                                ${deleteIcon}
                            </button>
                        </div>
                    `)
        },
      },
      { id: 'id', name: 'ID', hidden: true },
    ],
    data: [],
    search: false,
    sort: true,
    resizable: true,
    style: {
      table: {
        width: '100%',
        'white-space': 'nowrap',
      },
    },
    language: {
      search: { placeholder: i18n('gridSearch') },
      pagination: {
        previous: i18n('gridPreviousPage'),
        next: i18n('gridNextPage'),
        showing: i18n('gridShowing'),
        results: () => i18n('gridResults'),
      },
      loading: i18n('gridLoading'),
      noRecordsFound: i18n('gridNoRecords'),
    },
  }).render(elements.enginesGrid)
}

/**
 * 刷新 Grid 数据
 */
function renderEnginesGrid() {
  if (!grid) return

  const data = state.engines.map((e) => ({
    name: e.name,
    badge: e.badge,
    url: e.url,
    param: e.param || '',
    isTarget: e.isTarget,
    id: e.id,
  }))

  grid
    .updateConfig({
      data: data,
    })
    .forceRender()
}

// ============================================
// 事件绑定
// ============================================

function bindEvents() {
  // 目标引擎选择变化
  elements.targetEngine.addEventListener('change', async (e) => {
    state.targetEngine = e.target.value
    await saveSettings()
  })

  // Badge 显示开关
  elements.showBadge.addEventListener('change', async (e) => {
    state.showBadge = e.target.checked
    await saveSettings()
  })

  // 语言选择
  elements.languageSelect.addEventListener('change', async (e) => {
    state.language = e.target.value
    await saveSettings()

    // 刷新页面以应用新语言
    location.reload()
  })

  // URL 输入变化时自动提取 domain 和 param
  elements.newEngineUrl.addEventListener('input', handleUrlInput)

  // 添加/保存引擎
  elements.addEngine.addEventListener('click', handleEngineSubmit)

  // 取消编辑
  elements.cancelEditEngine.addEventListener('click', resetEditState)

  // 恢复默认设置
  elements.resetDefaults.addEventListener('click', resetToDefaults)

  // Grid.js 事件委托
  elements.enginesGrid.addEventListener('click', handleGridClick)
  elements.enginesGrid.addEventListener('change', handleGridChange)
}

/**
 * 处理 Grid 点击事件 (编辑/删除)
 */
function handleGridClick(e) {
  const btnEdit = e.target.closest('.btn-edit')
  const btnDelete = e.target.closest('.btn-delete')

  if (btnEdit) {
    const id = btnEdit.dataset.id
    startEditEngine(id)
  } else if (btnDelete) {
    const id = btnDelete.dataset.id
    deleteEngine(id)
  }
}

/**
 * 处理 Grid 变更事件 (Checkbox)
 */
async function handleGridChange(e) {
  if (e.target.classList.contains('chk-target')) {
    const id = e.target.dataset.id
    const checked = e.target.checked
    await updateEngineState(id, { isTarget: checked })
  }
}

/**
 * 更新引擎状态
 */
async function updateEngineState(id, updates) {
  const index = state.engines.findIndex((e) => e.id === id)
  if (index !== -1) {
    state.engines[index] = { ...state.engines[index], ...updates }

    // 如果取消了 isTarget 且当前是选中目标，需要处理
    if (updates.isTarget === false && state.targetEngine === id) {
      // 尝试切换到其他目标
      const targetEngines = state.engines.filter((e) => e.isTarget)
      if (targetEngines.length > 0) {
        state.targetEngine = targetEngines[0].id
      } else {
        state.targetEngine = ''
      }
    }

    await saveSettings()
    // 重新渲染选择框（Grid 不需要重绘，因为 Checkbox 状态已经改变，除非需要排序更新）
    // 如果启用了排序，最好重新渲染以保持正确顺序，但为了体验流畅，可以暂不重绘 Grid
    // 但下拉框必须更新
    renderTargetEngineSelect()
  }
}

/**
 * 处理 URL 输入，自动提取 domain 和 param
 */
function handleUrlInput() {
  const urlValue = elements.newEngineUrl.value.trim()

  if (!urlValue) {
    return
  }

  try {
    // 临时替换 %s 以便解析 URL
    const testUrl = urlValue.replace('%s', 'TEST_KEYWORD')
    const url = new URL(testUrl)

    // 自动提取 domain（如果用户没有手动填写）
    if (!elements.newEngineDomain.value.trim()) {
      // 移除 www. 前缀
      let domain = url.hostname
      if (domain.startsWith('www.')) {
        domain = domain.substring(4)
      }
      elements.newEngineDomain.value = domain
    }

    // 自动提取 param（如果用户没有手动填写）
    if (!elements.newEngineParam.value.trim()) {
      // 找到值为 TEST_KEYWORD 的参数
      for (const [key, value] of url.searchParams) {
        if (value === 'TEST_KEYWORD') {
          elements.newEngineParam.value = key
          break
        }
      }
    }
  } catch (e) {
    // URL 解析失败，忽略
  }
}

// ============================================
// 渲染函数
// ============================================

/**
 * 渲染所有 UI 组件
 */
function renderAll() {
  renderSettings()
  renderTargetEngineSelect()
  renderEnginesGrid()
}

/**
 * 渲染基本设置
 */
function renderSettings() {
  elements.showBadge.checked = state.showBadge
  elements.languageSelect.value = state.language
}

/**
 * 渲染目标引擎下拉选择框（仅显示 isTarget: true 的引擎）
 */
function renderTargetEngineSelect() {
  elements.targetEngine.innerHTML = ''

  const targetEngines = state.engines.filter((e) => e.isTarget)

  if (targetEngines.length === 0) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = i18n('noTargetEngines')
    option.disabled = true
    elements.targetEngine.appendChild(option)
    return
  }

  targetEngines.forEach((engine) => {
    const option = document.createElement('option')
    option.value = engine.id
    option.textContent = `${engine.name} (${engine.badge})`
    option.selected = engine.id === state.targetEngine
    elements.targetEngine.appendChild(option)
  })

  // 如果当前选中的引擎不在目标列表中，自动切换到第一个
  if (
    !targetEngines.find((e) => e.id === state.targetEngine) &&
    targetEngines.length > 0
  ) {
    state.targetEngine = targetEngines[0].id
    saveSettings()
  }
}

// ============================================
// 操作函数
// ============================================

/**
 * 处理引擎提交（添加或更新）
 */
async function handleEngineSubmit() {
  const name = elements.newEngineName.value.trim()
  const badge = elements.newEngineBadge.value.trim() || name.charAt(0)
  const url = elements.newEngineUrl.value.trim()
  const domain = elements.newEngineDomain.value.trim()
  const param = elements.newEngineParam.value.trim()
  const isTarget = elements.newEngineIsTarget.checked

  // 验证输入
  if (!name) {
    showStatus(i18n('errorEngineName'), true)
    elements.newEngineName.focus()
    return
  }

  if (!url) {
    showStatus(i18n('errorEngineUrl'), true)
    elements.newEngineUrl.focus()
    return
  }

  if (!url.includes('%s')) {
    showStatus(i18n('errorUrlPlaceholder'), true)
    elements.newEngineUrl.focus()
    return
  }

  const engineData = {
    name,
    badge,
    url,
    domain,
    param,
    isTarget,
  }

  if (editingEngineId === null) {
    // === 添加新引擎 ===
    const id = 'custom_' + Date.now()
    state.engines.push({
      id,
      ...engineData,
    })
  } else {
    // === 更新现有引擎 ===
    const index = state.engines.findIndex((e) => e.id === editingEngineId)
    if (index !== -1) {
      state.engines[index] = {
        ...state.engines[index],
        ...engineData,
      }
    }
  }

  // 保存并刷新 UI
  await saveSettings()
  renderAll()
  resetEditState()
}

/**
 * 开始编辑引擎
 * @param {string} id - 引擎 ID
 */
function startEditEngine(id) {
  const engine = state.engines.find((e) => e.id === id)
  if (!engine) return

  editingEngineId = id

  // 展开编辑区域
  if (elements.addEngineDetails) {
    elements.addEngineDetails.open = true
  }

  // 填充表单
  elements.newEngineName.value = engine.name
  elements.newEngineBadge.value = engine.badge
  elements.newEngineUrl.value = engine.url
  elements.newEngineDomain.value = engine.domain || ''
  elements.newEngineParam.value = engine.param || ''
  elements.newEngineIsTarget.checked = engine.isTarget

  // 更新按钮状态
  elements.addEngine.textContent = i18n('saveChangesBtn')
  elements.cancelEditEngine.style.display = 'inline-flex'

  // 聚焦
  elements.newEngineName.focus()
  elements.newEngineName.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/**
 * 重置编辑状态
 */
function resetEditState() {
  editingEngineId = null

  // 清空表单
  elements.newEngineName.value = ''
  elements.newEngineBadge.value = ''
  elements.newEngineUrl.value = ''
  elements.newEngineDomain.value = ''
  elements.newEngineParam.value = ''
  elements.newEngineIsTarget.checked = true

  // 恢复按钮状态
  elements.addEngine.textContent = i18n('addEngineBtn')
  elements.cancelEditEngine.style.display = 'none'
}

/**
 * 删除引擎
 *
 * @param {string} engineId - 引擎 ID
 */
async function deleteEngine(engineId) {
  if (editingEngineId === engineId) {
    resetEditState()
  }

  if (!confirm(i18n('confirmDelete'))) {
    return
  }

  // 过滤掉要删除的引擎
  state.engines = state.engines.filter((e) => e.id !== engineId)

  // 如果删除的是当前选中的目标引擎，切换到第一个目标引擎
  if (state.targetEngine === engineId) {
    const targetEngines = state.engines.filter((e) => e.isTarget)
    if (targetEngines.length > 0) {
      state.targetEngine = targetEngines[0].id
    } else {
      state.targetEngine = ''
    }
  }

  await saveSettings()
  renderAll()
}

/**
 * 恢复默认设置
 */
async function resetToDefaults() {
  if (!confirm(i18n('confirmReset'))) {
    return
  }

  state = {
    targetEngine: 'google',
    showBadge: false,
    engines: [...DEFAULT_ENGINES],
  }

  resetEditState()
  await saveSettings()
  renderAll()
  showStatus(i18n('statusRestored'))

  // 延迟刷新页面以应用更改
  setTimeout(() => {
    location.reload()
  }, 1500)
}

// ============================================
// 工具函数
// ============================================

/**
 * 显示 SnackBar 消息
 *
 * @param {string} message - 消息内容
 * @param {boolean} isError - 是否为错误消息
 */
const ICONS = {
  SUCCESS: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>`,
  ERROR: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>`,
}

function showStatus(message, isError = false) {
  const container = elements.snackbarContainer
  if (!container) return

  const snackbar = document.createElement('div')
  snackbar.className = 'snackbar'

  const icon = isError ? ICONS.ERROR : ICONS.SUCCESS
  snackbar.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`

  if (isError) {
    snackbar.style.backgroundColor = 'var(--danger-color)'
    snackbar.style.color = '#ffffff'
  }

  container.appendChild(snackbar)

  // 触发重绘以确保动画执行
  requestAnimationFrame(() => {
    snackbar.classList.add('show')
  })

  // 3秒后自动移除
  setTimeout(() => {
    snackbar.classList.remove('show')

    // 等待过渡动画结束后从 DOM 移除
    snackbar.addEventListener('transitionend', () => {
      if (snackbar.parentNode) {
        snackbar.remove()
      }
    })
  }, 3000)
}

/**
 * HTML 转义，防止 XSS
 *
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  if (!str) return ''
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
