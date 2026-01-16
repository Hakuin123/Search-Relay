/**
 * Search Relay - Background Service Worker
 * 
 * 核心逻辑：
 * 1. 优先级1 - 划词搜索：检查页面选中文字
 * 2. 优先级2 - 关键词跳转：从搜索引擎URL提取关键词
 * 3. Fallback - 弹窗询问搜索词
 */

// ============================================
// 默认配置
// ============================================

/** 默认的目标搜索引擎列表 */
const DEFAULT_TARGET_ENGINES = [
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s', badge: 'G' },
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=%s', badge: 'B' },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=%s', badge: 'Bi' },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', badge: 'D' }
];

/** 默认的源搜索引擎规则（用于提取关键词） */
const DEFAULT_SOURCE_RULES = [
  { domain: 'google.com', param: 'q' },
  { domain: 'baidu.com', param: 'wd' },
  { domain: 'bing.com', param: 'q' },
  { domain: 'cn.bing.com', param: 'q' },
  { domain: 'duckduckgo.com', param: 'q' },
  { domain: 'sogou.com', param: 'query' },
  { domain: 'so.com', param: 'q' },
  { domain: 'yandex.com', param: 'text' },
  { domain: 'search.yahoo.com', param: 'p' }
];

// ============================================
// 初始化
// ============================================

/**
 * 扩展安装或更新时初始化默认配置
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Search Relay] 扩展已安装/更新:', details.reason);

  // 获取现有配置
  const stored = await chrome.storage.sync.get(['targetEngine', 'targetEngines', 'sourceRules']);

  // 如果没有配置，则写入默认值
  if (!stored.targetEngines || stored.targetEngines.length === 0) {
    await chrome.storage.sync.set({
      targetEngine: 'google',
      showBadge: false, // 默认关闭
      targetEngines: DEFAULT_TARGET_ENGINES,
      sourceRules: DEFAULT_SOURCE_RULES
    });
    console.log('[Search Relay] 已写入默认配置');
  }

  // 更新 Badge 和 Context Menus
  await updateBadge();
  await updateContextMenus();
});

/**
 * Service Worker 启动时更新
 */
chrome.runtime.onStartup.addListener(async () => {
  await updateBadge();
  await updateContextMenus();
});

// ============================================
// Badge & Context Menu 管理
// ============================================

/**
 * 根据当前目标搜索引擎更新图标 Badge
 */
async function updateBadge() {
  try {
    const { targetEngine, targetEngines, showBadge } = await chrome.storage.sync.get(['targetEngine', 'targetEngines', 'showBadge']);

    if (!targetEngines || !targetEngine) {
      return;
    }

    // 如果设置关闭，则清除 Badge
    if (!showBadge) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }

    const engine = targetEngines.find(e => e.id === targetEngine);

    if (engine) {
      await chrome.action.setBadgeText({ text: engine.badge || engine.name.charAt(0) });
    }
  } catch (error) {
    console.error('[Search Relay] 更新 Badge 失败:', error);
  }
}

/**
 * 更新右键菜单
 */
async function updateContextMenus() {
  try {
    // 清除现有菜单
    await chrome.contextMenus.removeAll();

    const { targetEngines } = await chrome.storage.sync.get(['targetEngines']);
    const engines = targetEngines || DEFAULT_TARGET_ENGINES;

    // 创建父菜单
    chrome.contextMenus.create({
      id: "search_relay_root",
      title: "使用 Search Relay 搜索",
      contexts: ["action", "selection"]
    });

    // 为每个引擎创建子菜单
    engines.forEach(engine => {
      chrome.contextMenus.create({
        id: `engine_${engine.id}`,
        parentId: "search_relay_root",
        title: `使用 ${engine.name} 搜索`,
        contexts: ["action", "selection"]
      });
    });

    console.log('[Search Relay] 右键菜单已更新');
  } catch (error) {
    console.error('[Search Relay] 更新右键菜单失败:', error);
  }
}

/**
 * 监听存储变化
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.targetEngine || changes.targetEngines || changes.showBadge) {
      updateBadge();
    }
    if (changes.targetEngines) {
      updateContextMenus();
    }
  }
});

// ============================================
// 核心搜索逻辑
// ============================================

/**
 * 统一的搜索处理流程
 * @param {chrome.tabs.Tab} tab - 当前标签页
 * @param {string} [specificEngineId] - 指定使用的搜索引擎ID（可选，右键菜单使用）
 */
async function handleSearchAction(tab, specificEngineId = null) {
  console.log('[Search Relay] 执行搜索流程, specificEngineId:', specificEngineId);

  try {
    // 权限检查：chrome:// 等页面无法注入脚本
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      // 如果有特定引擎（右键菜单），直接无法执行选中获取，只能尝试弹窗（但弹窗也注入不了）
      // 在这种特殊页面，只能通知用户无法操作，或者只弹窗（如果支持的话）
      // 这里简单处理：如果无法注入，尝试获取 Tab URL 参数（如果是已知引擎），否则无解
    }

    // ========== 优先级 1: 划词搜索 ==========
    let selectedText = '';
    try {
      const selectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString().trim()
      });
      selectedText = selectionResults[0]?.result;
    } catch (e) {
      console.log('[Search Relay] 无法获取选中文本（可能是特殊页面）');
    }

    if (selectedText) {
      console.log('[Search Relay] 检测到选中文字:', selectedText);
      await performSearch(selectedText, specificEngineId);
      return;
    }

    // ========== 优先级 2: 从搜索引擎URL提取关键词 ==========
    const keyword = await extractKeywordFromUrl(tab.url);

    if (keyword) {
      console.log('[Search Relay] 从URL提取到关键词:', keyword);
      // 注意：如果只是点击图标跳转，逻辑是提取关键词->用目标引擎搜。
      // 右键菜单同理。
      await performSearch(keyword, specificEngineId);
      return;
    }

    // ========== Fallback: 弹窗询问 ==========
    // 如果是特殊页面，弹窗脚本也会失败，这里加个 try-catch
    try {
      console.log('[Search Relay] 无选中文字且非搜索引擎页面，显示弹窗');
      await showPromptDialog(tab.id, specificEngineId);
    } catch (e) {
      console.warn('[Search Relay] 无法显示弹窗:', e);
      // 极端情况：无法注入脚本的页面。可以直接打开空的目标搜索引擎主页？
      // 暂时不做额外处理，避免打扰。
    }

  } catch (error) {
    console.warn('[Search Relay] 执行搜索流程出错:', error);
  }
}

/**
 * 点击扩展图标时触发
 */
chrome.action.onClicked.addListener((tab) => {
  handleSearchAction(tab, null); // 使用默认配置的引擎
});

/**
 * 点击右键菜单时触发
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith('engine_')) {
    const engineId = info.menuItemId.replace('engine_', '');

    // 兼容：如果在页面右键选中了文字，info.selectionText 会有值
    // 我们可以直接用这个，不用再去 inject script 获取
    if (info.selectionText) {
      console.log('[Search Relay] 右键菜单直接获取到选中文本:', info.selectionText);
      performSearch(info.selectionText.trim(), engineId);
    } else {
      // 没选中文字，走通用流程（检查URL或弹窗）
      handleSearchAction(tab, engineId);
    }
  }
});

/**
 * 从URL中提取搜索关键词
 */
async function extractKeywordFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;

    const { sourceRules } = await chrome.storage.sync.get(['sourceRules']);
    const rules = sourceRules || DEFAULT_SOURCE_RULES;

    for (const rule of rules) {
      if (hostname === rule.domain || hostname.endsWith('.' + rule.domain)) {
        const keyword = url.searchParams.get(rule.param);
        if (keyword) {
          return keyword;
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 执行搜索
 * @param {string} keyword - 关键词
 * @param {string} [specificEngineId] - 指定引擎ID，为 null 则使用默认
 */
async function performSearch(keyword, specificEngineId = null) {
  try {
    const { targetEngine, targetEngines } = await chrome.storage.sync.get(['targetEngine', 'targetEngines']);
    const engines = targetEngines || DEFAULT_TARGET_ENGINES;

    // 确定使用的引擎 ID
    const engineId = specificEngineId || targetEngine || 'google';

    const engine = engines.find(e => e.id === engineId);

    if (!engine) {
      console.error('[Search Relay] 未找到目标搜索引擎配置:', engineId);
      return;
    }

    const searchUrl = engine.url.replace('%s', encodeURIComponent(keyword));
    console.log('[Search Relay] 打开搜索:', engine.name, searchUrl);

    await chrome.tabs.create({ url: searchUrl });

  } catch (error) {
    console.error('[Search Relay] 执行搜索失败:', error);
  }
}

/**
 * 显示弹窗询问
 */
async function showPromptDialog(tabId, specificEngineId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => prompt('请输入要搜索的关键词：', '')
  });

  const userInput = results[0]?.result;

  if (userInput && userInput.trim()) {
    await performSearch(userInput.trim(), specificEngineId);
  }
}
