/**
 * Search Relay - 设置页面逻辑
 * 
 * 功能：
 * 1. 加载和保存用户配置
 * 2. 管理搜索引擎（统一目标引擎和源引擎）
 */

import { DEFAULT_ENGINES } from './config.js';

// ============================================
// DOM 元素引用
// ============================================

const elements = {
    // 目标引擎选择
    targetEngine: document.getElementById('targetEngine'),
    showBadge: document.getElementById('showBadge'),

    // 添加/编辑引擎表单
    newEngineName: document.getElementById('newEngineName'),
    newEngineBadge: document.getElementById('newEngineBadge'),
    newEngineUrl: document.getElementById('newEngineUrl'),
    newEngineDomain: document.getElementById('newEngineDomain'),
    newEngineParam: document.getElementById('newEngineParam'),
    newEngineIsTarget: document.getElementById('newEngineIsTarget'),
    newEngineIsSource: document.getElementById('newEngineIsSource'),
    addEngine: document.getElementById('addEngine'),
    cancelEditEngine: document.getElementById('cancelEditEngine'),
    enginesList: document.getElementById('enginesList'),

    // 其他
    resetDefaults: document.getElementById('resetDefaults'),
    statusMessage: document.getElementById('statusMessage')
};

// ============================================
// 状态管理
// ============================================

let state = {
    targetEngine: 'google',
    showBadge: false,
    engines: [...DEFAULT_ENGINES]
};

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
        const stored = await chrome.storage.sync.get(['targetEngine', 'showBadge', 'engines']);

        if (stored.targetEngine) {
            state.targetEngine = stored.targetEngine;
        }
        if (typeof stored.showBadge !== 'undefined') {
            state.showBadge = stored.showBadge;
        }
        if (stored.engines && stored.engines.length > 0) {
            state.engines = stored.engines;
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
            engines: state.engines
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

    // URL 输入变化时自动提取 domain 和 param
    elements.newEngineUrl.addEventListener('input', handleUrlInput);

    // 添加/保存引擎
    elements.addEngine.addEventListener('click', handleEngineSubmit);

    // 取消编辑
    elements.cancelEditEngine.addEventListener('click', resetEditState);

    // 恢复默认设置
    elements.resetDefaults.addEventListener('click', resetToDefaults);
}

/**
 * 处理 URL 输入，自动提取 domain 和 param
 */
function handleUrlInput() {
    const urlValue = elements.newEngineUrl.value.trim();

    if (!urlValue) {
        return;
    }

    try {
        // 临时替换 %s 以便解析 URL
        const testUrl = urlValue.replace('%s', 'TEST_KEYWORD');
        const url = new URL(testUrl);

        // 自动提取 domain（如果用户没有手动填写）
        if (!elements.newEngineDomain.value.trim()) {
            // 移除 www. 前缀
            let domain = url.hostname;
            if (domain.startsWith('www.')) {
                domain = domain.substring(4);
            }
            elements.newEngineDomain.value = domain;
        }

        // 自动提取 param（如果用户没有手动填写）
        if (!elements.newEngineParam.value.trim()) {
            // 找到值为 TEST_KEYWORD 的参数
            for (const [key, value] of url.searchParams) {
                if (value === 'TEST_KEYWORD') {
                    elements.newEngineParam.value = key;
                    break;
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
    renderSettings();
    renderTargetEngineSelect();
    renderEnginesList();
}

/**
 * 渲染基本设置
 */
function renderSettings() {
    elements.showBadge.checked = state.showBadge;
}

/**
 * 渲染目标引擎下拉选择框（仅显示 isTarget: true 的引擎）
 */
function renderTargetEngineSelect() {
    elements.targetEngine.innerHTML = '';

    const targetEngines = state.engines.filter(e => e.isTarget);

    if (targetEngines.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '（无可用目标引擎）';
        option.disabled = true;
        elements.targetEngine.appendChild(option);
        return;
    }

    targetEngines.forEach(engine => {
        const option = document.createElement('option');
        option.value = engine.id;
        option.textContent = `${engine.name} (${engine.badge})`;
        option.selected = engine.id === state.targetEngine;
        elements.targetEngine.appendChild(option);
    });

    // 如果当前选中的引擎不在目标列表中，自动切换到第一个
    if (!targetEngines.find(e => e.id === state.targetEngine) && targetEngines.length > 0) {
        state.targetEngine = targetEngines[0].id;
        saveSettings();
    }
}

/**
 * 渲染引擎列表
 */
function renderEnginesList() {
    elements.enginesList.innerHTML = '';

    if (state.engines.length === 0) {
        elements.enginesList.innerHTML = '<div class="list-empty">暂无引擎</div>';
        return;
    }

    state.engines.forEach(engine => {
        const item = createEngineListItem(engine);
        elements.enginesList.appendChild(item);
    });
}

/**
 * 创建引擎列表项 DOM 元素
 * 
 * @param {Object} engine - 引擎对象
 * @returns {HTMLElement} 列表项元素
 */
function createEngineListItem(engine) {
    const item = document.createElement('div');
    item.className = 'list-item';

    // 生成角色标签
    const roles = [];
    if (engine.isTarget) roles.push('目标');
    if (engine.isSource) roles.push('源');
    const roleText = roles.length > 0 ? roles.join(' / ') : '未启用';

    item.innerHTML = `
    <div class="list-item-content">
      <span class="list-item-badge">${escapeHtml(engine.badge)}</span>
      <div class="list-item-info">
        <div class="list-item-title">${escapeHtml(engine.name)} <span class="role-tag">${escapeHtml(roleText)}</span></div>
        <div class="list-item-subtitle">${escapeHtml(engine.domain || '无域名')} · 参数: ${escapeHtml(engine.param || '无')}</div>
      </div>
    </div>
    <div class="list-item-actions">
      <button class="btn btn-secondary btn-sm edit-btn">编辑</button>
      <button class="btn btn-danger btn-sm delete-btn">删除</button>
    </div>
  `;

    // 绑定事件
    item.querySelector('.edit-btn').addEventListener('click', () => startEditEngine(engine.id));
    item.querySelector('.delete-btn').addEventListener('click', () => deleteEngine(engine.id));

    return item;
}

// ============================================
// 操作函数
// ============================================

/**
 * 处理引擎提交（添加或更新）
 */
async function handleEngineSubmit() {
    const name = elements.newEngineName.value.trim();
    const badge = elements.newEngineBadge.value.trim() || name.charAt(0);
    const url = elements.newEngineUrl.value.trim();
    const domain = elements.newEngineDomain.value.trim();
    const param = elements.newEngineParam.value.trim();
    const isTarget = elements.newEngineIsTarget.checked;
    const isSource = elements.newEngineIsSource.checked;

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

    if (!isTarget && !isSource) {
        showStatus('至少需要勾选一个角色（目标引擎或源引擎）', true);
        return;
    }

    const engineData = {
        name,
        badge,
        url,
        domain,
        param,
        isTarget,
        isSource
    };

    if (editingEngineId === null) {
        // === 添加新引擎 ===
        const id = 'custom_' + Date.now();
        state.engines.push({
            id,
            ...engineData
        });
    } else {
        // === 更新现有引擎 ===
        const index = state.engines.findIndex(e => e.id === editingEngineId);
        if (index !== -1) {
            state.engines[index] = {
                ...state.engines[index],
                ...engineData
            };
        }
    }

    // 保存并刷新 UI
    await saveSettings();
    renderAll();
    resetEditState();
}

/**
 * 开始编辑引擎
 * @param {string} id - 引擎 ID
 */
function startEditEngine(id) {
    const engine = state.engines.find(e => e.id === id);
    if (!engine) return;

    editingEngineId = id;

    // 填充表单
    elements.newEngineName.value = engine.name;
    elements.newEngineBadge.value = engine.badge;
    elements.newEngineUrl.value = engine.url;
    elements.newEngineDomain.value = engine.domain || '';
    elements.newEngineParam.value = engine.param || '';
    elements.newEngineIsTarget.checked = engine.isTarget;
    elements.newEngineIsSource.checked = engine.isSource;

    // 更新按钮状态
    elements.addEngine.textContent = '保存修改';
    elements.cancelEditEngine.style.display = 'inline-flex';

    // 聚焦
    elements.newEngineName.focus();
    elements.newEngineName.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * 重置编辑状态
 */
function resetEditState() {
    editingEngineId = null;

    // 清空表单
    elements.newEngineName.value = '';
    elements.newEngineBadge.value = '';
    elements.newEngineUrl.value = '';
    elements.newEngineDomain.value = '';
    elements.newEngineParam.value = '';
    elements.newEngineIsTarget.checked = true;
    elements.newEngineIsSource.checked = false;

    // 恢复按钮状态
    elements.addEngine.textContent = '添加引擎';
    elements.cancelEditEngine.style.display = 'none';
}

/**
 * 删除引擎
 * 
 * @param {string} engineId - 引擎 ID
 */
async function deleteEngine(engineId) {
    if (editingEngineId === engineId) {
        resetEditState();
    }

    // 过滤掉要删除的引擎
    state.engines = state.engines.filter(e => e.id !== engineId);

    // 如果删除的是当前选中的目标引擎，切换到第一个目标引擎
    if (state.targetEngine === engineId) {
        const targetEngines = state.engines.filter(e => e.isTarget);
        if (targetEngines.length > 0) {
            state.targetEngine = targetEngines[0].id;
        } else {
            state.targetEngine = '';
        }
    }

    await saveSettings();
    renderAll();
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
        engines: [...DEFAULT_ENGINES]
    };

    resetEditState();
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
