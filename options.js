/**
 * Search Relay - 设置页面逻辑
 * 
 * 功能：
 * 1. 加载和保存用户配置
 * 2. 管理目标搜索引擎
 * 3. 管理源搜索引擎规则
 */

// ============================================
// 默认配置（与 background.js 保持一致）
// ============================================

const DEFAULT_TARGET_ENGINES = [
    { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s', badge: 'G', isDefault: true },
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=%s', badge: 'B', isDefault: true },
    { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=%s', badge: 'Bing', isDefault: true },
    { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', badge: 'D', isDefault: true }
];

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
// DOM 元素引用
// ============================================

const elements = {
    // 目标引擎选择
    targetEngine: document.getElementById('targetEngine'),
    showBadge: document.getElementById('showBadge'),

    // 添加/编辑自定义目标引擎
    newEngineName: document.getElementById('newEngineName'),
    newEngineBadge: document.getElementById('newEngineBadge'),
    newEngineUrl: document.getElementById('newEngineUrl'),
    addTargetEngine: document.getElementById('addTargetEngine'),
    cancelEditEngine: document.getElementById('cancelEditEngine'),
    customEnginesSection: document.getElementById('customEnginesSection'),
    customEnginesList: document.getElementById('customEnginesList'),

    // 添加/编辑源规则
    newRuleDomain: document.getElementById('newRuleDomain'),
    newRuleParam: document.getElementById('newRuleParam'),
    addSourceRule: document.getElementById('addSourceRule'),
    cancelEditSourceRule: document.getElementById('cancelEditSourceRule'),
    sourceRulesList: document.getElementById('sourceRulesList'),
    sourceRulesDetails: document.querySelector('details'),

    // 其他
    resetDefaults: document.getElementById('resetDefaults'),
    statusMessage: document.getElementById('statusMessage')
};

// ============================================
// 状态管理
// ============================================

let state = {
    targetEngine: 'google',
    showBadge: false, // 默认关闭
    targetEngines: [...DEFAULT_TARGET_ENGINES],
    sourceRules: [...DEFAULT_SOURCE_RULES]
};

// 当前正在编辑的规则索引，-1 表示添加新规则
let editingRuleIndex = -1;
// 当前正在编辑的引擎ID，null 表示添加新引擎
let editingEngineId = null;

// ============================================
// 初始化
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    bindEvents();
    renderAll();
});

/**
 * 从 Chrome Storage 加载设置
 */
async function loadSettings() {
    try {
        const stored = await chrome.storage.sync.get(['targetEngine', 'targetEngines', 'sourceRules']);

        if (stored.targetEngine) {
            state.targetEngine = stored.targetEngine;
        }
        if (typeof stored.showBadge !== 'undefined') {
            state.showBadge = stored.showBadge;
        }
        if (stored.targetEngines && stored.targetEngines.length > 0) {
            state.targetEngines = stored.targetEngines;
        }
        if (stored.sourceRules && stored.sourceRules.length > 0) {
            state.sourceRules = stored.sourceRules;
        }

        console.log('[Search Relay Options] 配置已加载:', state);
    } catch (error) {
        console.error('[Search Relay Options] 加载配置失败:', error);
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
            targetEngines: state.targetEngines,
            sourceRules: state.sourceRules
        });

        showStatus('✓ 设置已保存');
        console.log('[Search Relay Options] 配置已保存:', state);
    } catch (error) {
        console.error('[Search Relay Options] 保存配置失败:', error);
        showStatus('✗ 保存失败', true);
    }
}

// ============================================
// 事件绑定
// ============================================

function bindEvents() {
    // 目标引擎选择变化
    elements.targetEngine.addEventListener('change', async (e) => {
        state.targetEngine = e.target.value;
        await saveSettings();
    });

    // Badge 显示开关
    elements.showBadge.addEventListener('change', async (e) => {
        state.showBadge = e.target.checked;
        await saveSettings();
    });

    // 添加/保存自定义目标引擎
    elements.addTargetEngine.addEventListener('click', handleCustomEngineSubmit);

    // 取消编辑自定义目标引擎
    elements.cancelEditEngine.addEventListener('click', resetEngineEditState);

    // 添加/保存源规则
    elements.addSourceRule.addEventListener('click', handleSourceRuleSubmit);

    // 取消编辑源规则
    elements.cancelEditSourceRule.addEventListener('click', resetEditState);

    // 恢复默认设置
    elements.resetDefaults.addEventListener('click', resetToDefaults);
}

// ============================================
// 渲染函数
// ============================================

/**
 * 渲染所有 UI 组件
 */
function renderAll() {
    renderSettings();
    renderTargetEngineSelect();
    renderCustomEnginesList();
    renderSourceRulesList();
}

/**
 * 渲染基本设置
 */
function renderSettings() {
    elements.showBadge.checked = state.showBadge;
}

/**
 * 渲染目标引擎下拉选择框
 */
function renderTargetEngineSelect() {
    elements.targetEngine.innerHTML = '';

    state.targetEngines.forEach(engine => {
        const option = document.createElement('option');
        option.value = engine.id;
        option.textContent = `${engine.name} (${engine.badge})`;
        option.selected = engine.id === state.targetEngine;
        elements.targetEngine.appendChild(option);
    });
}

/**
 * 渲染自定义引擎列表（仅显示用户添加的引擎）
 */
function renderCustomEnginesList() {
    // 过滤出用户添加的自定义引擎
    const customEngines = state.targetEngines.filter(e => !e.isDefault);

    if (customEngines.length === 0) {
        elements.customEnginesSection.style.display = 'none';
        return;
    }

    elements.customEnginesSection.style.display = 'block';
    elements.customEnginesList.innerHTML = '';

    customEngines.forEach(engine => {
        const item = createListItem({
            badge: engine.badge,
            title: engine.name,
            subtitle: engine.url,
            onDelete: () => deleteTargetEngine(engine.id),
            onEdit: () => startEditCustomEngine(engine.id)
        });
        elements.customEnginesList.appendChild(item);
    });
}

/**
 * 渲染源规则列表
 */
function renderSourceRulesList() {
    elements.sourceRulesList.innerHTML = '';

    if (state.sourceRules.length === 0) {
        elements.sourceRulesList.innerHTML = '<div class="list-empty">暂无规则</div>';
        return;
    }

    state.sourceRules.forEach((rule, index) => {
        const item = createListItem({
            badge: rule.param,
            title: rule.domain,
            subtitle: `参数: ${rule.param}`,
            onDelete: () => deleteSourceRule(index),
            onEdit: () => startEditSourceRule(index)
        });
        elements.sourceRulesList.appendChild(item);
    });
}

/**
 * 创建列表项 DOM 元素
 * 
 * @param {Object} options - 列表项配置
 * @param {string} options.badge - Badge 文字
 * @param {string} options.title - 标题
 * @param {string} options.subtitle - 副标题
 * @param {Function} options.onDelete - 删除回调
 * @param {Function} [options.onEdit] - 编辑回调（可选）
 * @returns {HTMLElement} 列表项元素
 */
function createListItem({ badge, title, subtitle, onDelete, onEdit }) {
    const item = document.createElement('div');
    item.className = 'list-item';

    let actionsHtml = '';
    if (onEdit) {
        actionsHtml += `<button class="btn btn-secondary btn-sm edit-btn">编辑</button>`;
    }
    actionsHtml += `<button class="btn btn-danger btn-sm delete-btn">删除</button>`;

    item.innerHTML = `
    <div class="list-item-content">
      <span class="list-item-badge">${escapeHtml(badge)}</span>
      <div class="list-item-info">
        <div class="list-item-title">${escapeHtml(title)}</div>
        <div class="list-item-subtitle">${escapeHtml(subtitle)}</div>
      </div>
    </div>
    <div class="list-item-actions">
      ${actionsHtml}
    </div>
  `;

    // 绑定事件
    item.querySelector('.delete-btn').addEventListener('click', onDelete);

    if (onEdit) {
        item.querySelector('.edit-btn').addEventListener('click', onEdit);
    }

    return item;
}

// ============================================
// 操作函数
// ============================================

/**
 * 处理自定义目标引擎提交
 */
async function handleCustomEngineSubmit() {
    const name = elements.newEngineName.value.trim();
    const badge = elements.newEngineBadge.value.trim() || name.charAt(0);
    const url = elements.newEngineUrl.value.trim();

    // 验证输入
    if (!name) {
        showStatus('请输入引擎名称', true);
        elements.newEngineName.focus();
        return;
    }

    if (!url) {
        showStatus('请输入搜索 URL', true);
        elements.newEngineUrl.focus();
        return;
    }

    if (!url.includes('%s')) {
        showStatus('URL 必须包含 %s 作为关键词占位符', true);
        elements.newEngineUrl.focus();
        return;
    }

    if (editingEngineId === null) {
        // === 添加新引擎 ===
        const id = 'custom_' + Date.now();
        state.targetEngines.push({
            id,
            name,
            badge,
            url,
            isDefault: false
        });
    } else {
        // === 更新现有引擎 ===
        const index = state.targetEngines.findIndex(e => e.id === editingEngineId);
        if (index !== -1) {
            state.targetEngines[index] = {
                ...state.targetEngines[index],
                name,
                badge,
                url
            };
        }
    }

    // 保存并刷新 UI
    await saveSettings();
    renderAll();
    resetEngineEditState();
}

/**
 * 开始编辑自定义目标引擎
 * @param {string} id - 引擎 ID
 */
function startEditCustomEngine(id) {
    const engine = state.targetEngines.find(e => e.id === id);
    if (!engine) return;

    editingEngineId = id;

    // 填充表单
    elements.newEngineName.value = engine.name;
    elements.newEngineBadge.value = engine.badge;
    elements.newEngineUrl.value = engine.url;

    // 更新按钮状态
    elements.addTargetEngine.textContent = '保存修改';
    elements.cancelEditEngine.style.display = 'inline-flex';

    // 聚焦
    elements.newEngineName.focus();
    elements.newEngineName.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * 重置引擎编辑状态
 */
function resetEngineEditState() {
    editingEngineId = null;

    // 清空表单
    elements.newEngineName.value = '';
    elements.newEngineBadge.value = '';
    elements.newEngineUrl.value = '';

    // 恢复按钮状态
    elements.addTargetEngine.textContent = '添加目标引擎';
    elements.cancelEditEngine.style.display = 'none';
}

/**
 * 删除目标引擎
 * 
 * @param {string} engineId - 引擎 ID
 */
async function deleteTargetEngine(engineId) {
    if (editingEngineId === engineId) {
        resetEngineEditState();
    }

    // 过滤掉要删除的引擎
    state.targetEngines = state.targetEngines.filter(e => e.id !== engineId);

    // 如果删除的是当前选中的引擎，切换到第一个
    if (state.targetEngine === engineId && state.targetEngines.length > 0) {
        state.targetEngine = state.targetEngines[0].id;
    }

    await saveSettings();
    renderAll();
}

/**
 * 处理源规则提交（添加或保存修改）
 */
async function handleSourceRuleSubmit() {
    const domain = elements.newRuleDomain.value.trim().toLowerCase();
    const param = elements.newRuleParam.value.trim();

    // 验证输入
    if (!domain) {
        showStatus('请输入域名', true);
        elements.newRuleDomain.focus();
        return;
    }

    if (!param) {
        showStatus('请输入参数名', true);
        elements.newRuleParam.focus();
        return;
    }

    if (editingRuleIndex === -1) {
        // === 添加新规则 ===
        const exists = state.sourceRules.some(r => r.domain === domain);
        if (exists) {
            showStatus('该域名规则已存在', true);
            return;
        }
        state.sourceRules.push({ domain, param });
    } else {
        // === 更新现有规则 ===
        const exists = state.sourceRules.some((r, idx) => r.domain === domain && idx !== editingRuleIndex);
        if (exists) {
            showStatus('该域名规则已存在', true);
            return;
        }
        state.sourceRules[editingRuleIndex] = { domain, param };
    }

    await saveSettings();
    renderSourceRulesList();
    resetEditState();
}

/**
 * 开始编辑源规则
 * @param {number} index - 规则索引
 */
function startEditSourceRule(index) {
    const rule = state.sourceRules[index];
    if (!rule) return;

    editingRuleIndex = index;

    // 填充表单
    elements.newRuleDomain.value = rule.domain;
    elements.newRuleParam.value = rule.param;

    // 更新按钮状态
    elements.addSourceRule.textContent = '保存修改';
    elements.cancelEditSourceRule.style.display = 'inline-flex';

    if (elements.sourceRulesDetails && !elements.sourceRulesDetails.open) {
        elements.sourceRulesDetails.open = true;
    }

    elements.newRuleDomain.focus();
    elements.newRuleDomain.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * 重置编辑状态
 */
function resetEditState() {
    editingRuleIndex = -1;

    // 清空表单
    elements.newRuleDomain.value = '';
    elements.newRuleParam.value = '';

    // 恢复按钮状态
    elements.addSourceRule.textContent = '添加规则';
    elements.cancelEditSourceRule.style.display = 'none';
}

/**
 * 删除源规则
 * 
 * @param {number} index - 规则索引
 */
async function deleteSourceRule(index) {
    if (editingRuleIndex === index) {
        resetEditState();
    } else if (editingRuleIndex > index) {
        editingRuleIndex--;
    }

    state.sourceRules.splice(index, 1);
    await saveSettings();
    renderSourceRulesList();
}

/**
 * 恢复默认设置
 */
async function resetToDefaults() {
    if (!confirm('确定要恢复默认设置吗？这将清除所有自定义配置。')) {
        return;
    }

    state = {
        targetEngine: 'google',
        showBadge: false,
        targetEngines: [...DEFAULT_TARGET_ENGINES],
        sourceRules: [...DEFAULT_SOURCE_RULES]
    };

    resetEditState();
    resetEngineEditState();
    await saveSettings();
    renderAll();
    showStatus('已恢复默认设置');
}

// ============================================
// 工具函数
// ============================================

/**
 * 显示状态消息
 * 
 * @param {string} message - 消息内容
 * @param {boolean} isError - 是否为错误消息
 */
function showStatus(message, isError = false) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
    elements.statusMessage.classList.add('show');

    setTimeout(() => {
        elements.statusMessage.classList.remove('show');
    }, 2000);
}

/**
 * HTML 转义，防止 XSS
 * 
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
