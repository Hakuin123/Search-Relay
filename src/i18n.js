/**
 * i18n 辅助函数 - 支持手动语言切换
 */

// 存储当前语言和所有语言包
let currentLocale = 'auto'
let messagesCache = {}

/**
 * 加载指定语言的消息文件
 * @param {string} locale - 语言代码 (zh_CN, en)
 */
async function loadMessages(locale) {
  if (messagesCache[locale]) {
    return messagesCache[locale]
  }

  try {
    const response = await fetch(
      chrome.runtime.getURL(`_locales/${locale}/messages.json`),
    )
    const messages = await response.json()
    messagesCache[locale] = messages
    return messages
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error)
    return null
  }
}

/**
 * 获取国际化消息
 * @param {string} key - 消息键名
 * @param {string|string[]} [substitutions] - 替换内容
 * @returns {string} 国际化后的文本
 */
function i18n(key, substitutions) {
  // 如果是auto模式,使用Chrome默认的i18n
  if (currentLocale === 'auto') {
    return chrome.i18n.getMessage(key, substitutions) || key
  }

  // 手动语言模式,从缓存中读取
  const messages = messagesCache[currentLocale]
  if (!messages || !messages[key]) {
    return key
  }

  let message = messages[key].message

  // 处理占位符替换
  if (substitutions) {
    const subs = Array.isArray(substitutions) ? substitutions : [substitutions]

    // 支持 $1, $2 等占位符
    message = message.replace(/\$(\d+)/g, (match, index) => {
      const i = parseInt(index) - 1
      return subs[i] !== undefined ? subs[i] : match
    })

    // 支持命名占位符 $ENGINE$
    if (messages[key].placeholders) {
      Object.keys(messages[key].placeholders).forEach((placeholderKey) => {
        const placeholder = messages[key].placeholders[placeholderKey]
        const regex = new RegExp(`\\$${placeholderKey}\\$`, 'g')
        const contentMatch = placeholder.content.match(/\$(\d+)/)
        if (contentMatch) {
          const index = parseInt(contentMatch[1]) - 1
          message = message.replace(regex, subs[index] || '')
        }
      })
    }
  }

  return message
}

/**
 * 初始化页面中所有带 data-i18n 属性的元素
 */
function initI18n() {
  // 处理所有带 data-i18n 属性的元素（设置 textContent）
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n')
    if (key) {
      element.textContent = i18n(key)
    }
  })

  // 处理所有带 data-i18n-placeholder 属性的元素
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder')
    if (key) {
      element.placeholder = i18n(key)
    }
  })

  // 处理所有带 data-i18n-title 属性的元素
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    const key = element.getAttribute('data-i18n-title')
    if (key) {
      element.title = i18n(key)
    }
  })
}

/**
 * 切换语言
 * @param {string} locale - 语言代码 ('auto', 'zh_CN', 'en')
 */
async function switchLanguage(locale) {
  currentLocale = locale

  // 如果不是auto,预加载对应语言包
  if (locale !== 'auto') {
    await loadMessages(locale)
  }

  // 重新初始化页面文本
  initI18n()
}

/**
 * 初始化语言设置
 * @param {string} savedLocale - 保存的语言设置
 */
async function initLanguage(savedLocale) {
  currentLocale = savedLocale || 'auto'

  // 预加载所有语言包
  if (currentLocale !== 'auto') {
    await loadMessages(currentLocale)
  }
}

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { i18n, initI18n, switchLanguage, initLanguage }
}
