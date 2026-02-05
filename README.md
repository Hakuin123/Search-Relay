<h1 align="center">
  <img src="src/icons/icon128.png" alt="Logo" height="42" style="vertical-align: middle;"> Search Relay
</h1>

<div align="center">
  一个简单的浏览器扩展，快速在不同搜索引擎之间跳转/比对搜索结果<br>
  支持一键提取关键词切换搜索引擎、划词搜索、右键菜单搜索
</div>
<br>
<p align="center">
   <a href="https://microsoftedge.microsoft.com/addons/detail/pnemkcglehklmoljjkkkejhplaignejo">
      <img src="docs/images/badges/Chinese_(Simplified)_Get_it_from_Microsoft_Edge.png" alt="Edge Add-ons" height="45">
   </a>
  &nbsp;
  <a href="https://addons.mozilla.org/firefox/addon/search-relay/">
    <img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" alt="Firefox Add-ons" height="45">
  </a>
</p>

## 功能 Features

### 一键切换搜索引擎

在某个搜索引擎中，若对搜索结果不满意，点击扩展图标，使用选定的搜索引擎一键重新搜索

Search Relay 会**自动提取当前搜索结果页的搜索关键词**

![示例](docs/images/一键切换搜索引擎.gif)

> 也可以右键扩展图标，选择希望使用的搜索引擎<br>
> <img src="docs/images/右键菜单.gif" width="450" alt="示例">

### 划词搜索

选中页面上的文字，通过右键菜单选项快速选择搜索引擎进行搜索；也可划词后点击扩展图标搜索关键词
![示例](docs/images/划词搜索.gif)

## 更多用法 More Usages

### 自定义搜索引擎

在设置页中可以按照说明自行添加搜索引擎，比如可以添加哔哩哔哩为搜索引擎，快捷搜索b站视频
![示例](docs/images/自定义搜索引擎.png)

> [!TIP]
> 关于 **源引擎** 和 **目标引擎**
>
> **源引擎**：当您停留在这些网站的搜索结果页时，Search Relay 能读懂 URL，提取其中的关键词，准备传给下一个引擎
>
> 举例：如果您把 `Bilibili` 设为**源引擎**，当您在B站搜索“教程”时，Search Relay 就能识别出关键词是“教程”
>
> **目标引擎**：这是您点击 Search Relay 图标或使用右键菜单时，最终打开的新搜索引擎
>
> 举例：如果您把 `Google` 设为**目标引擎**，在右键菜单中，就可以选择用 `Google` 来搜索关键词；目标引擎也可以被设为默认搜索引擎，在点击 Search Relay 图标时使用 `Google` 来搜索关键词

### 拓展：划词翻译

1. 勾选需要的翻译引擎，也可自行添加
   ![示例](docs/images/划词翻译-1.png)

2. 浏览网页时选中关键词

3. 右键选择翻译引擎
   ![示例](docs/images/划词翻译-3.png)

4. 插件将打开对应的翻译引擎页面，完成翻译
   ![示例](docs/images/划词翻译-4.png)

## 安装 Installation

### 商店下载

- Chrome Web Store: [计划中]
- Edge Add-ons: [点此获取](https://microsoftedge.microsoft.com/addons/detail/pnemkcglehklmoljjkkkejhplaignejo)
- Firefox Add-ons: [点此获取](https://addons.mozilla.org/firefox/addon/search-relay/)

### 手动安装 (开发者模式)

1.  下载本项目源码或 Release 包，并解压
2.  打开浏览器扩展管理页：`chrome://extensions/` 或 `edge://extensions/`
3.  打开右上角的“开发者模式”
4.  点击“加载已解压的扩展程序”，选择解压目录

## 构建 Build

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

**Chrome / Edge:**

```bash
web-ext build --source-dir src --artifacts-dir web-ext-artifacts/chrome --overwrite-dest
```

生成的 `.zip` 文件将位于 `web-ext-artifacts/chrome/` 目录下。

**Firefox:**

Firefox 构建需要先运行适配脚本再打包：

```cmd
node scripts/build-firefox.js
web-ext build --source-dir build/firefox --artifacts-dir web-ext-artifacts/firefox --overwrite-dest
```

生成的 `.zip` 文件将位于 `web-ext-artifacts/firefox/` 目录下。

注意:正式版 Firefox 禁止安装未签名的附加组件。[更多信息](https://support.mozilla.org/kb/add-ons-signing-firefox)

如果希望在正式版中测试未签名的开发版本，可以在about:debugging页面选择“此 Firefox”，点击“临时加载附加组件…”，然后选择 `build/firefox/manifest.json` 文件（可选择 manifest.json 文件或 .xpi/.zip 压缩包）。

## 隐私声明 Policy

本扩展**不收集任何用户数据**。Search Relay 仅利用浏览器本地存储保存您的设置和搜索引擎数据，不会传输或收集任何私人浏览信息。

## 开源许可证 License

GNU General Public License v3.0

> 我们希望通过GPLv3许可证，确保 Search Relay 及其衍生作品始终保持开源，以更好地保护用户隐私。

Search Relay 的图标采用了 [icon8](https://icons8.com/icon/WwWusvLMTFd7/search) 的素材
