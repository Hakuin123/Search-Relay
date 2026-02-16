# 发布流程 Release Process

本文档说明了如何发布 Search Relay 的新版本。发布流程基于 GitHub Actions 自动化进行。

## 触发方式

目前支持两种触发发布流程的方式：手动触发和通过 Commit Message 触发。

### 1. 手动触发 (推荐)

这是最直接的发布方式，适用于想要明确控制版本升级级别（Patch/Minor/Major）的场景。

1.  打开 GitHub 仓库页面。
2.  进入 **Actions** 标签页。
3.  在左侧工作流列表中选择 **Release Extension**。
4.  点击右侧的 **Run workflow** 按钮。
5.  在 **Bump Level** 下拉菜单中选择版本升级级别：
    - **patch**: 修补程序版本 (例如 1.0.0 -> 1.0.1)
    - **minor**: 次要版本 (例如 1.0.0 -> 1.1.0)
    - **major**: 主要版本 (例如 1.0.0 -> 2.0.0)
6.  点击绿色的 **Run workflow** 按钮。

**执行过程：**

- 系统会自动根据选择的级别增加 `src/manifest.json` 中的版本号。
- 自动创建 Git Tag。
- 自动生成 Changelog。
- 打包扩展并在 GitHub Releases 中创建新发布。
- 构建 Firefox 版本并发布到 Firefox Add-ons。
- 发布到 Microsoft Edge Add-ons。

### 2. 通过 Commit Message 触发

你也可以在提交代码时通过特定的 Commit Message 来触发发布流程。

**条件：**

- Commit 必须推送到 `main` 分支。
- Commit Message 中必须包含 `bump version` 关键词。

**用法：**

- **指定具体版本：**
  如果在 Commit Message 中包含 `bump version to x.y.z` (例如 `chore: bump version to 1.2.0`)，系统会将版本号更新为指定的 `1.2.0`。

- **自动 Patch 升级：**
  如果 Commit Message 仅包含 `bump version` 但没有指定具体版本号，系统默认执行 Patch 级别的版本升级 (例如 1.0.0 -> 1.0.1)。

**注意：**
Action 会检测 `src/manifest.json` 是否已变更。如果你的 Commit 中已经包含了修改后的 `manifest.json`，Action 会使用该版本；否则它会帮你修改并提交。

## 发布产物

流程执行成功后，会产生以下结果：

1.  **GitHub Release**: 在仓库的 Releases 页面会生成一个新的 Release，包含：
    - 自动生成的更新日志 (Changelog)。
    - `.zip` 格式的扩展安装包 (Artifacts)。
2.  **Firefox Add-ons**: 自动提交新版本到 Firefox 扩展商店。
3.  **Edge Add-ons**: 自动提交新版本到 Microsoft Edge 扩展商店。
