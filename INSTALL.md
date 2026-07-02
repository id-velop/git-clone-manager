# Git Magager - 安装指南

## 🎯 目标

让用户只需在 Chrome 中添加插件就能直接使用，无需手动启动服务器。

## ✅ 已实现的改进

我们已经将架构从 **HTTP 服务器** 迁移到 **Chrome Native Messaging**，这意味着：

- ✅ **无需手动启动服务器** - Chrome 会自动管理本地进程
- ✅ **自动启停** - 需要时自动启动，空闲时自动停止
- ✅ **更安全** - 使用 Chrome 原生通信协议
- ✅ **更简单** - 一次性安装，永久使用

## 📦 安装步骤

### 前置要求

1. **Node.js** (v14+)
2. **Git**
3. **Google Chrome**

### 第一步：安装 Node.js

#### 方法 A：使用 Homebrew（推荐）

```bash
# 如果还没安装 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Node.js
brew install node
```

#### 方法 B：从官网下载

访问 [https://nodejs.org](https://nodejs.org) 下载并安装 LTS 版本

验证安装：
```bash
node --version
npm --version
```

### 第二步：加载 Chrome 扩展

1. 打开 Chrome，访问 `chrome://extensions`
2. 开启右上角的 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**
4. 选择项目中的 `chrome-extension` 文件夹
5. **复制扩展 ID**（32位字符串，类似：`abcdefghijklmnopqrstuvwx`）

### 第三步：运行安装脚本

打开终端，执行：

```bash
cd git-clone-manager/native-host
chmod +x quick-install.sh
./quick-install.sh
```

按照提示：
1. 粘贴你在第二步中复制的 **扩展 ID**
2. 脚本会自动完成所有配置

安装脚本会：
- ✅ 注册 Native Messaging Host
- ✅ 创建默认配置文件 `~/.git-magager.json`
- ✅ 设置正确的权限

### 第四步：开始使用

1. 回到 `chrome://extensions`
2. 找到 "Git Magager"，点击 **重新加载** 按钮 ↻
3. 访问任意 GitHub 或 GitLab 仓库
4. 点击页面上的 **Clone** 按钮
5. 选择克隆目录
6. 完成！🎉

## 🔍 工作原理

```
用户点击 Clone 按钮
    ↓
Chrome Extension (content.js)
    ↓
Background Script (background.js)
    ↓
Chrome Native Messaging API
    ↓
Native Host Process (native-server.js) ← Chrome 自动启动
    ↓
执行 Git 命令
    ↓
返回结果给扩展
```

**关键优势：**
- Native Host 进程由 Chrome 自动管理
- 不需要手动 `node server.js`
- 首次使用时自动启动
- 空闲时自动停止，不占用资源

## ⚙️ 配置

配置文件位于：`~/.git-magager.json`

```json
{
  "cloneDirectory": "~/Projects",
  "openInTerminal": true,
  "terminalApp": "Terminal"
}
```

### 配置项说明

- **cloneDirectory**: 默认克隆目录
- **openInTerminal**: 是否在终端中打开（true/false）
- **terminalApp**: 使用的终端应用
  - `"Terminal"` - macOS 默认终端
  - `"iTerm"` - iTerm2
  - `"Warp"` - Warp 终端

## ❓ 常见问题

### Q: 提示 "Native host not available"？

**解决方案：**
1. 确认 Node.js 已安装：`node --version`
2. 重新运行安装脚本：`./quick-install.sh`
3. 确保扩展 ID 正确匹配
4. 重新加载扩展

### Q: 如何查看扩展 ID？

1. 访问 `chrome://extensions`
2. 找到 "Git Magager"
3. 扩展卡片上会显示 ID

### Q: 可以更改克隆目录吗？

可以！编辑 `~/.git-magager.json` 文件，或者在克隆时通过文件夹选择器选择其他目录。

### Q: 支持哪些平台？

- ✅ GitHub
- ✅ GitLab.com
- ✅ 自建 GitLab 实例
- ✅ Example Git

### Q: 如何卸载？

1. 在 Chrome 中移除扩展
2. 删除 Native Host 注册：
   ```bash
   rm ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.git-magager.host.json
   ```
3. 删除配置文件（可选）：
   ```bash
   rm ~/.git-magager.json
   ```

## 🛠️ 开发者说明

### 项目结构

```
git-magager/
├── chrome-extension/          # Chrome 扩展
│   ├── manifest.json         # 扩展配置（含 nativeMessaging 权限）
│   ├── background.js         # 使用 chrome.runtime.sendNativeMessage
│   ├── content.js            # 页面交互
│   └── ...
├── native-host/              # Native Messaging Host
│   ├── native-server.js      # 主服务逻辑（stdio 协议）
│   ├── native-host.sh        # 包装脚本
│   ├── com.git-magager.host.json  # Chrome 注册清单
│   └── quick-install.sh      # 一键安装脚本
└── README.md
```

### 技术栈

- **Chrome Extension Manifest V3**
- **Native Messaging Protocol** (stdio)
- **Node.js** (无外部依赖)
- **macOS AppleScript** (终端集成)

### 调试

查看 Native Host 日志：
```bash
# 在 terminal 中运行 native-server.js 手动测试
cd native-host
node native-server.js
```

发送测试消息（JSON 格式，带长度前缀）。

## 📝 更新日志

### v1.1.0 (当前版本)

- ✨ 迁移到 Chrome Native Messaging
- ✨ 无需手动启动服务器
- ✨ 添加一键安装脚本
- ✨ 改进错误处理
- 📝 完善文档

### v1.0.x

- 基于 HTTP 服务器的初始版本
- 需要手动运行 `node server.js`

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
