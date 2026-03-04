/**
 * Search Relay - Background Service Worker
 *
 * 核心逻辑：
 * 1. 优先级1 - 划词搜索：检查页面选中文字
 * 2. 优先级2 - 关键词跳转：从搜索引擎URL提取关键词
 * 3. Fallback - 弹窗询问搜索词
 */

import { DEFAULT_ENGINES } from './config.js'

// ============================================
// i18n 辅助函数
// ============================================

/**
 * 获取国际化消息
 * @param {string} key - 消息键名
 * @param {string|string[]} [substitutions] - 替换内容
 * @returns {string} 国际化后的文本
 */
function i18n(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key
}

// ============================================
// 初始化
// ============================================

/**
 * 扩展安装或更新时初始化默认配置
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Search Relay] 扩展已安装/更新:', details.reason)

  // 获取现有配置
  const stored = await chrome.storage.sync.get(['targetEngine', 'engines'])

  // 如果没有配置，则写入默认值
  if (!stored.engines || stored.engines.length === 0) {
    await chrome.storage.sync.set({
      targetEngine: 'google',
      showBadge: false,
      engines: DEFAULT_ENGINES,
    })
    console.log('[Search Relay] 已写入默认配置')
  }

  // 更新 Badge 和 Context Menus
  await updateBadge()
  await updateContextMenus()

  // 扩展安装时打开 onboarding 页面
  if (details.reason === 'install') {
    // 动态获取当前环境的 Extension ID 并传递给引导页
    // 这样无论是在 Chrome, Edge 还是开发环境，网页端都能知道该连接哪个插件 ID
    const extensionId = chrome.runtime.id
    const ONBOARDING_URL = `https://search-relay.hk256.top/onboarding?ext_id=${extensionId}`
    chrome.tabs.create({ url: ONBOARDING_URL })
  }
})

/**
 * 监听来自外部网页的消息
 */
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    // 验证消息来源（manifest.json 中已配置 externally_connectable）
    // sender.url 将是你的托管页面 URL

    console.log('[Search Relay] 收到外部消息:', request)

    if (request.action === 'saveOnboardingSettings') {
      // 处理 onboarding 完成逻辑，例如保存设置
      // 使用 IIFE (立即调用异步函数) 来处理异步存储操作
      ;(async () => {
        try {
          if (request.settings) {
            await chrome.storage.sync.set(request.settings)
          }
          sendResponse({ success: true })
        } catch (error) {
          console.error('[Search Relay] 处理外部消息出错:', error)
          sendResponse({ success: false, error: error.message })
        }
      })()

      // 返回 true 表示我们将异步发送响应
      return true
    }

    if (request.action === 'setDefaultEngine') {
      ;(async () => {
        try {
          if (request.engineId) {
            await chrome.storage.sync.set({ targetEngine: request.engineId })
            console.log('[Search Relay] 已更新默认搜索引擎:', request.engineId)
            // Storage onChanged listener will handle badge updates
          }
          sendResponse({ success: true })
        } catch (error) {
          console.error('[Search Relay] 更新默认搜索引擎失败:', error)
          sendResponse({ success: false, error: error.message })
        }
      })()
      return true
    }
  },
)

/**
 * Service Worker 启动时更新
 */
chrome.runtime.onStartup.addListener(async () => {
  await updateBadge()
  await updateContextMenus()
})

// ============================================
// Badge & Context Menu 管理
// ============================================

/**
 * 根据当前目标搜索引擎更新图标 Badge
 */
async function updateBadge() {
  try {
    const { targetEngine, engines, showBadge } = await chrome.storage.sync.get([
      'targetEngine',
      'engines',
      'showBadge',
    ])

    if (!engines || !targetEngine) {
      return
    }

    // 如果设置关闭，则清除 Badge
    if (!showBadge) {
      await chrome.action.setBadgeText({ text: '' })
      return
    }

    const engine = engines.find((e) => e.id === targetEngine)

    if (engine) {
      await chrome.action.setBadgeText({
        text: engine.badge || engine.name.charAt(0),
      })
    }
  } catch (error) {
    console.error('[Search Relay] 更新 Badge 失败:', error)
  }
}

/**
 * 更新右键菜单
 */
async function updateContextMenus() {
  try {
    // 清除现有菜单
    await chrome.contextMenus.removeAll()

    const { engines } = await chrome.storage.sync.get(['engines'])
    const allEngines = engines || DEFAULT_ENGINES

    // 筛选出作为目标引擎的引擎
    const targetEngines = allEngines.filter((e) => e.isTarget)

    if (targetEngines.length === 0) {
      console.log('[Search Relay] 没有可用的目标引擎，跳过菜单创建')
      return
    }

    // 创建父菜单
    chrome.contextMenus.create(
      {
        id: 'search_relay_root',
        title: i18n('contextMenuRoot'),
        contexts: ['action', 'selection'],
      },
      () => {
        if (chrome.runtime.lastError) {
          // 忽略重复ID错误，这种情况通常发生在快速重载或多次调用时
          console.debug(
            '[Search Relay] 创建根菜单提示:',
            chrome.runtime.lastError.message,
          )
        }
      },
    )

    // 为每个目标引擎创建子菜单
    targetEngines.forEach((engine) => {
      chrome.contextMenus.create(
        {
          id: `engine_${engine.id}`,
          parentId: 'search_relay_root',
          title: i18n('contextMenuUseEngine', engine.name),
          contexts: ['action', 'selection'],
        },
        () => {
          if (chrome.runtime.lastError) {
            console.debug(
              `[Search Relay] 创建子菜单提示 (${engine.id}):`,
              chrome.runtime.lastError.message,
            )
          }
        },
      )
    })

    console.log('[Search Relay] 右键菜单已更新')
  } catch (error) {
    console.error('[Search Relay] 更新右键菜单失败:', error)
  }
}

/**
 * 监听存储变化
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.targetEngine || changes.engines || changes.showBadge) {
      updateBadge()
    }
    if (changes.engines) {
      updateContextMenus()
    }
  }
})

// ============================================
// 核心搜索逻辑
// ============================================

/**
 * 统一的搜索处理流程
 * @param {chrome.tabs.Tab} tab - 当前标签页
 * @param {string} [specificEngineId] - 指定使用的搜索引擎ID（可选，右键菜单使用）
 */
async function handleSearchAction(tab, specificEngineId = null) {
  console.log(
    '[Search Relay] 执行搜索流程, specificEngineId:',
    specificEngineId,
  )

  try {
    // 权限检查：chrome:// 等特殊页面无法注入脚本
    const canInject = !(
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('moz-extension://')
    )

    // ========== 优先级 1: 划词搜索 ==========
    let selectedText = ''
    if (canInject) {
      try {
        const selectionResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection().toString().trim(),
        })
        selectedText = selectionResults[0]?.result
      } catch (e) {
        console.log('[Search Relay] 无法获取选中文本（可能是特殊页面）')
      }
    }

    if (selectedText) {
      console.log('[Search Relay] 检测到选中文字:', selectedText)
      await performSearch(selectedText, specificEngineId, tab.id, true, tab.url)
      return
    }

    // ========== 优先级 2: 从搜索引擎URL提取关键词 ==========
    const keyword = await extractKeywordFromUrl(tab.url)

    if (keyword) {
      console.log('[Search Relay] 从URL提取到关键词:', keyword)
      // 注意：如果只是点击图标跳转，逻辑是提取关键词-> 用目标引擎搜。
      // 右键菜单同理。
      await performSearch(keyword, specificEngineId, tab.id, false, tab.url)
      return
    }

    // ========== Fallback: 弹窗询问 ==========
    // 如果是特殊页面，弹窗脚本也会失败，这里加个 try-catch
    try {
      console.log('[Search Relay] 无选中文字且非搜索引擎页面，显示弹窗')
      await showPromptDialog(tab.id, specificEngineId, tab.url)
    } catch (e) {
      console.warn('[Search Relay] 无法显示弹窗:', e)
      // 极端情况：无法注入脚本的页面。可以直接打开空的目标搜索引擎主页？
      // 暂时不做额外处理，避免打扰。
    }
  } catch (error) {
    console.warn('[Search Relay] 执行搜索流程出错:', error)
  }
}

/**
 * 点击扩展图标时触发
 */
chrome.action.onClicked.addListener((tab) => {
  handleSearchAction(tab, null) // 使用默认配置的引擎
})

/**
 * 点击右键菜单时触发
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith('engine_')) {
    const engineId = info.menuItemId.replace('engine_', '')

    // 兼容：如果在页面右键选中了文字，info.selectionText 会有值
    // 我们可以直接用这个，不用再去 inject script 获取
    if (info.selectionText) {
      console.log(
        '[Search Relay] 右键菜单直接获取到选中文本:',
        info.selectionText,
      )
      performSearch(info.selectionText.trim(), engineId, tab.id, true, tab.url)
    } else {
      // 没选中文字，走通用流程（检查URL或弹窗）
      handleSearchAction(tab, engineId)
    }
  }
})

/**
 * Onboarding 页面的域名列表（用于特殊处理）
 */
const ONBOARDING_HOSTS = ['127.0.0.1', 'localhost', 'search-relay.hk256.top']

/**
 * 检查是否为 onboarding 页面
 * @param {URL} url - URL 对象
 * @returns {boolean}
 */
function isOnboardingPage(url) {
  // 本地开发环境需要检查端口
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
    return url.port === '3000'
  }
  // 生产环境直接检查域名
  return ONBOARDING_HOSTS.includes(url.hostname)
}

/**
 * 从URL中提取搜索关键词
 */
async function extractKeywordFromUrl(urlString) {
  try {
    const url = new URL(urlString)
    const { hostname } = url

    // 特殊处理：Onboarding 页面使用 's' 参数
    if (isOnboardingPage(url)) {
      const keyword = url.searchParams.get('s')
      if (keyword) {
        console.log(
          '[Search Relay] 检测到 Onboarding 页面，提取关键词:',
          keyword,
        )
        return keyword
      }
    }

    const { engines } = await chrome.storage.sync.get(['engines'])
    const allEngines = engines || DEFAULT_ENGINES

    for (const engine of allEngines) {
      if (
        hostname === engine.domain ||
        hostname.endsWith('.' + engine.domain)
      ) {
        // 支持多个参数名，用逗号分隔
        const params = engine.param.split(',').map((p) => p.trim())

        for (const param of params) {
          if (!param) continue
          const keyword = url.searchParams.get(param)
          if (keyword) {
            return keyword
          }
        }
      }
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * 执行搜索
 * @param {string} keyword - 关键词
 * @param {string} [specificEngineId] - 指定引擎ID，为 null 则使用默认
 * @param {number} [sourceTabId] - 触发搜索的源标签页ID（可选，用于通知 onboarding 页面）
 * @param {boolean} [isSelectionSearch] - 是否为划词搜索
 * @param {string} [sourceUrl] - 源标签页的 URL（可选，用于检测 onboarding 页面）
 */
async function performSearch(
  keyword,
  specificEngineId = null,
  sourceTabId = null,
  isSelectionSearch = false,
  sourceUrl = null,
) {
  try {
    const { targetEngine, engines } = await chrome.storage.sync.get([
      'targetEngine',
      'engines',
    ])
    const allEngines = engines || DEFAULT_ENGINES

    // 确定使用的引擎 ID
    const engineId = specificEngineId || targetEngine || 'google'

    // 从所有引擎中查找（不仅限于 isTarget，因为可能通过右键菜单临时选择）
    const engine = allEngines.find((e) => e.id === engineId)

    if (!engine) {
      console.error('[Search Relay] 未找到目标搜索引擎配置:', engineId)
      return
    }

    const searchUrl = engine.url.replace('%s', encodeURIComponent(keyword))
    console.log('[Search Relay] 打开搜索:', engine.name, searchUrl)

    // 检测是否来自 onboarding 页面
    let isFromOnboarding = false
    if (sourceUrl) {
      try {
        const url = new URL(sourceUrl)
        isFromOnboarding = isOnboardingPage(url)
      } catch (e) {
        // 忽略 URL 解析错误
      }
    }

    // 通知 onboarding 页面（如果有源标签页）
    if (sourceTabId) {
      try {
        const eventType = isSelectionSearch
          ? 'EXTENSION_SELECTION_TRIGGERED'
          : 'EXTENSION_RELAY_TRIGGERED'
        await chrome.scripting.executeScript({
          target: { tabId: sourceTabId },
          func: (type) => {
            window.postMessage({ type: type }, '*')
          },
          args: [eventType],
        })
        console.log('[Search Relay] 已通知 onboarding 页面:', eventType)
      } catch (notifyError) {
        // 忽略通知失败（可能不是 onboarding 页面或无权限）
        console.debug(
          '[Search Relay] 无法通知页面（非 onboarding 页面或无权限）:',
          notifyError.message,
        )
      }
    }

    await chrome.tabs.create({ url: searchUrl })
  } catch (error) {
    console.error('[Search Relay] 执行搜索失败:', error)
  }
}

/**
 * 显示弹窗询问
 */
async function showPromptDialog(tabId, specificEngineId, tabUrl = null) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => prompt(chrome.i18n.getMessage('promptKeyword'), ''),
  })

  const userInput = results[0]?.result

  if (userInput && userInput.trim()) {
    await performSearch(
      userInput.trim(),
      specificEngineId,
      tabId,
      false,
      tabUrl,
    )
  }
}
