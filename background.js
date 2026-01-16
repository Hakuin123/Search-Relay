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
  { domain: 'google.com.hk', param: 'q' },
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
      targetEngines: DEFAULT_TARGET_ENGINES,
      sourceRules: DEFAULT_SOURCE_RULES
    });
    console.log('[Search Relay] 已写入默认配置');
  }
  
  // 更新 Badge
  await updateBadge();
});

/**
 * Service Worker 启动时更新 Badge
 */
chrome.runtime.onStartup.addListener(async () => {
  await updateBadge();
});

// ============================================
// Badge 管理
// ============================================

/**
 * 根据当前目标搜索引擎更新图标 Badge
 */
async function updateBadge() {
  try {
    const { targetEngine, targetEngines } = await chrome.storage.sync.get(['targetEngine', 'targetEngines']);
    
    if (!targetEngines || !targetEngine) {
      console.log('[Search Relay] 配置未就绪，跳过 Badge 更新');
      return;
    }
    
    // 查找当前目标引擎
    const engine = targetEngines.find(e => e.id === targetEngine);
    
    if (engine) {
      // 设置 Badge 文字和颜色
      await chrome.action.setBadgeText({ text: engine.badge || engine.name.charAt(0) });
      await chrome.action.setBadgeBackgroundColor({ color: '#4285f4' }); // Google 蓝
      console.log('[Search Relay] Badge 已更新:', engine.badge);
    }
  } catch (error) {
    console.error('[Search Relay] 更新 Badge 失败:', error);
  }
}

/**
 * 监听存储变化，自动更新 Badge
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && (changes.targetEngine || changes.targetEngines)) {
    console.log('[Search Relay] 检测到配置变化，更新 Badge');
    updateBadge();
  }
});

// ============================================
// 核心搜索逻辑
// ============================================

/**
 * 点击扩展图标时触发
 * 
 * 执行优先级：
 * 1. 检查页面是否有选中文字 → 划词搜索
 * 2. 检查当前URL是否为已知搜索引擎 → 提取关键词跳转
 * 3. Fallback → 弹窗询问
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Search Relay] 图标被点击，当前标签:', tab.url);
  
  try {
    // ========== 优先级 1: 划词搜索 ==========
    // 使用 scripting API 在页面中执行脚本获取选中文字
    const selectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString().trim()
    });
    
    const selectedText = selectionResults[0]?.result;
    
    if (selectedText) {
      console.log('[Search Relay] 检测到选中文字:', selectedText);
      await performSearch(selectedText);
      return;
    }
    
    // ========== 优先级 2: 从搜索引擎URL提取关键词 ==========
    const keyword = await extractKeywordFromUrl(tab.url);
    
    if (keyword) {
      console.log('[Search Relay] 从URL提取到关键词:', keyword);
      await performSearch(keyword);
      return;
    }
    
    // ========== Fallback: 弹窗询问 ==========
    console.log('[Search Relay] 无选中文字且非搜索引擎页面，显示弹窗');
    await showPromptDialog(tab.id);
    
  } catch (error) {
    console.error('[Search Relay] 执行搜索时出错:', error);
    
    // 如果是权限问题（如 chrome:// 页面），直接显示弹窗
    if (error.message?.includes('Cannot access') || error.message?.includes('chrome://')) {
      // 无法在特殊页面执行脚本，通知用户
      console.log('[Search Relay] 无法在此页面执行脚本');
    }
  }
});

/**
 * 从URL中提取搜索关键词
 * 
 * @param {string} urlString - 当前页面URL
 * @returns {string|null} - 提取到的关键词，未匹配则返回 null
 * 
 * 解析逻辑：
 * 1. 解析URL获取域名（hostname）
 * 2. 遍历源规则列表，检查域名是否匹配
 * 3. 如果匹配，从URL的查询参数中提取对应的关键词
 */
async function extractKeywordFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname; // 例如: www.baidu.com
    
    // 获取用户配置的源规则
    const { sourceRules } = await chrome.storage.sync.get(['sourceRules']);
    const rules = sourceRules || DEFAULT_SOURCE_RULES;
    
    // 遍历规则，查找匹配的域名
    for (const rule of rules) {
      // 检查域名是否匹配（支持子域名，如 www.google.com 匹配 google.com）
      // 使用 endsWith 确保 "www.google.com" 能匹配规则 "google.com"
      // 同时确保不会误匹配，如 "fakegoogle.com" 不应匹配 "google.com"
      if (hostname === rule.domain || hostname.endsWith('.' + rule.domain)) {
        // 从URL查询参数中提取关键词
        // 例如: https://www.baidu.com/s?wd=测试 → 提取 wd 参数的值 "测试"
        const keyword = url.searchParams.get(rule.param);
        
        if (keyword) {
          console.log(`[Search Relay] 匹配规则 ${rule.domain}，参数 ${rule.param}，关键词: ${keyword}`);
          return keyword;
        }
      }
    }
    
    return null; // 未匹配任何规则
  } catch (error) {
    console.error('[Search Relay] URL 解析失败:', error);
    return null;
  }
}

/**
 * 执行搜索：使用目标搜索引擎打开新标签页
 * 
 * @param {string} keyword - 要搜索的关键词
 */
async function performSearch(keyword) {
  try {
    // 获取用户配置的目标搜索引擎
    const { targetEngine, targetEngines } = await chrome.storage.sync.get(['targetEngine', 'targetEngines']);
    const engines = targetEngines || DEFAULT_TARGET_ENGINES;
    const engineId = targetEngine || 'google';
    
    // 查找目标引擎配置
    const engine = engines.find(e => e.id === engineId);
    
    if (!engine) {
      console.error('[Search Relay] 未找到目标搜索引擎配置:', engineId);
      return;
    }
    
    // 构建搜索URL
    // 将模板中的 %s 替换为编码后的关键词
    // encodeURIComponent 确保特殊字符（如空格、中文）被正确编码
    const searchUrl = engine.url.replace('%s', encodeURIComponent(keyword));
    
    console.log('[Search Relay] 打开搜索URL:', searchUrl);
    
    // 在新标签页打开搜索结果
    await chrome.tabs.create({ url: searchUrl });
    
  } catch (error) {
    console.error('[Search Relay] 执行搜索失败:', error);
  }
}

/**
 * 显示弹窗询问用户输入搜索词
 * 
 * @param {number} tabId - 当前标签页ID
 */
async function showPromptDialog(tabId) {
  try {
    // 在页面中注入并执行 prompt 弹窗
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return prompt('请输入要搜索的关键词：', '');
      }
    });
    
    const userInput = results[0]?.result;
    
    if (userInput && userInput.trim()) {
      console.log('[Search Relay] 用户输入关键词:', userInput);
      await performSearch(userInput.trim());
    } else {
      console.log('[Search Relay] 用户取消或未输入');
    }
  } catch (error) {
    console.error('[Search Relay] 显示弹窗失败:', error);
  }
}

// 初始化时立即更新 Badge
updateBadge();
