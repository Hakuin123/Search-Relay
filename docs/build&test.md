# 构建 Build

确保已安装 [Node.js](https://nodejs.org/) (v14+) 和 [npm](https://www.npmjs.com/)。
此外还需要全局安装 `web-ext` 工具用来打包扩展：

```bash
npm install --global web-ext
```

### 克隆仓库

```bash
git clone https://github.com/Hakuin123/Search-Relay.git
cd Search-Relay
```

### VS Code Task 自动化构建 (推荐)

1. 在 VS Code 中按下 `Ctrl+Shift+B` 将自动执行 **Build All** 任务，构建所有版本。
2. 若需单独构建某个版本，请点击菜单 `Terminal` -> `Run Task...`，然后从列表中选择。
3. 构建完成后，您可以在项目根目录下的 `web-ext-artifacts` 文件夹中找到生成的 `.zip` 文件。
   Chrome 版本储存在 `web-ext-artifacts/chrome/` 目录下，Firefox 版本储存在 `web-ext-artifacts/firefox/` 目录下。

### 命令行构建

如果您不使用 VS Code，也可以在终端中运行以下命令来手动构建。

#### Chrome / Edge:

```bash
web-ext build --source-dir src --artifacts-dir web-ext-artifacts/chrome --overwrite-dest
```

生成的 `.zip` 文件将位于 `web-ext-artifacts/chrome/` 目录下。

#### Firefox:

Firefox 构建需要先运行适配脚本再打包：

```cmd
node scripts/build-firefox.js
web-ext build --source-dir build/firefox --artifacts-dir web-ext-artifacts/firefox --overwrite-dest
```

生成的 `.zip` 文件将位于 `web-ext-artifacts/firefox/` 目录下。

> [!TIP]
> 注意:正式版 Firefox 禁止安装未签名的附加组件。[更多信息](https://support.mozilla.org/kb/add-ons-signing-firefox)
>
> 如果希望在正式版中测试未签名的开发版本，可以在about:debugging页面选择“此 Firefox”，点击“临时加载附加组件…”，然后选择 `build/firefox/manifest.json` 文件（可选择 manifest.json 文件或 .xpi/.zip 压缩包）。

---

# 测试 Test

## 使用 web-ext 启动测试 (推荐)

`web-ext` 提供了一个开发命令，可以自动在一个干净的浏览器实例中加载扩展，并在你修改代码时自动重新加载。

### Chrome / Edge / Chromium

可以直接启动 Chrome 或 Chromium 实例：

```bash
web-ext run --target=chromium
```

`web-ext-config.mjs`中已经配置了源目录为`src`。

### Firefox

你需要先构建 Firefox 版本才能使用 web-ext 启动测试。

```bash
node scripts/build-firefox.js
web-ext run --source-dir build/firefox
```

## 手动加载未打包的扩展 (Chrome / Edge)

如果您更习惯手动管理浏览器实例，或者需要调试特定于 Chrome/Edge 的功能：

在开发过程中，通常直接加载源代码目录进行测试，这样修改代码后只需刷新扩展即可生效。

1.  打开浏览器的扩展管理页面：
    - Chrome: 输入 `chrome://extensions`
    - Edge: 输入 `edge://extensions`
2.  开启右上角 (Chrome) 或左侧 (Edge) 的 **开发者模式 (Developer mode)**。
3.  点击 **加载已解压的扩展程序 (Load unpacked)** 按钮。
4.  选择项目根目录下的 `src` 文件夹。

此时扩展即安装成功。当你修改了 `src` 目录下的代码后，只需在扩展管理页面点击该扩展的刷新图标即可加载最新代码。

## 临时加载扩展 (Firefox)

Firefox 的加载方式略有不同，且需要先运行适配脚本生成 Firefox 专用的 manifest。

1.  运行 Firefox 构建脚本：
    ```bash
    node scripts/build-firefox.js
    ```
    这会在 `build/firefox` 目录下生成适配后的代码。
2.  打开 Firefox，输入 `about:debugging` 并回车。
3.  在左侧菜单点击 **此 Firefox (This Firefox)**。
4.  点击 **临时载入附加组件 (Load Temporary Add-on)**。
5.  选择 `build/firefox/manifest.json` 文件。

注意：临时加载的扩展在关闭 Firefox 后会消失，下次启动需要重新加载。
