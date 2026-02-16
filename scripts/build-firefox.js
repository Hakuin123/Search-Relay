const fs = require('fs')
const path = require('path')

const SOURCE_DIR = path.join(__dirname, '../src')
const BUILD_DIR = path.join(__dirname, '../build/firefox')

// 1. 清理并创建构建目录
console.log(`Cleaning build directory: ${BUILD_DIR}`)
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true, force: true })
}
fs.mkdirSync(BUILD_DIR, { recursive: true })

// 2. 复制源文件
console.log('Copying files from src to build/firefox...')
fs.cpSync(SOURCE_DIR, BUILD_DIR, { recursive: true })

// 3. 读取并修改 manifest.json
const manifestPath = path.join(BUILD_DIR, 'manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

console.log('Transforming manifest for Firefox...')

// 3.1 适配 Background 字段
// Chrome (MV3): "background": { "service_worker": "background.js", "type": "module" }
// Firefox (MV3): "background": { "scripts": ["background.js"], "type": "module" }
if (manifest.background && manifest.background.service_worker) {
  const script = manifest.background.service_worker
  const type = manifest.background.type

  manifest.background = {
    scripts: [script],
  }
  // Firefox 112+ 支持 background.type: "module"
  if (type) {
    manifest.background.type = type
  }
  console.log(
    `Converted background.service_worker to background.scripts: ${script}`,
  )
}

// 3.2 清理 Firefox 不支持或过时的字段
if (manifest.applications) {
  console.log('Removing deprecated "applications" key.')
  delete manifest.applications
}

if (manifest.offline_enabled) {
  console.log('Removing unsupported "offline_enabled" key.')
  delete manifest.offline_enabled
}

// 3.3 注入 Browser Specific Settings
// 确保 browser_specific_settings 结构存在
if (!manifest.browser_specific_settings) {
  manifest.browser_specific_settings = {}
}
if (!manifest.browser_specific_settings.gecko) {
  manifest.browser_specific_settings.gecko = {}
}

// 设置最低支持版本 (支持 ES Module background scripts 需要 Firefox 112+, options_page 需要 126+)
if (!manifest.browser_specific_settings.gecko.strict_min_version) {
  manifest.browser_specific_settings.gecko.strict_min_version = '126.0'
}

// 设置数据收集权限 (2025/11 后强制要求)
if (!manifest.browser_specific_settings.gecko.data_collection_permissions) {
  manifest.browser_specific_settings.gecko.data_collection_permissions = {
    required: ['none'], // 必须包含至少一项，如果不收集数据则填 "none"
    optional: [],
  }
}

// 注入 Extension ID
const extId = 'search-relay@hakuin123'
console.log(`Injecting Extension ID: ${extId}`)
manifest.browser_specific_settings.gecko.id = extId

// 4. 写回 manifest.json
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

console.log('Firefox build prepared successfully in build/firefox')
