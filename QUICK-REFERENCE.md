# Quick Clone - 快速参考

## 🚀 快速开始（3步）

```bash
# 1. 运行安装向导
./get-started.sh

# 2. 按照提示操作
#    - 加载 Chrome 扩展
#    - 复制扩展 ID
#    - 粘贴到安装脚本

# 3. 完成！访问 GitHub/GitLab 即可使用
```

## 📋 常用命令

### 安装相关

```bash
# 一键安装（推荐）
./get-started.sh

# 仅安装 Native Host
cd native-host && ./quick-install.sh

# 测试安装
./test-installation.sh
```

### 配置相关

```bash
# 编辑配置文件
nano ~/.quick-clone.json

# 查看当前配置
cat ~/.quick-clone.json
```

### 调试相关

```bash
# 手动测试 Native Host
cd native-host
node native-server.js

# 查看 Chrome 扩展日志
# chrome://extensions → 点击 "检查视图"

# 重新加载扩展
# chrome://extensions → 点击 Reload 按钮 ↻
```

## 🔧 配置文件

位置：`~/.quick-clone.json`

```json
{
  "cloneDirectory": "~/Projects",
  "openInTerminal": true,
  "terminalApp": "Terminal"
}
```

### 配置项

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| cloneDirectory | string | ~/Projects | 克隆目录 |
| openInTerminal | boolean | true | 是否在终端打开 |
| terminalApp | string | Terminal | 终端应用 (Terminal/iTerm/Warp) |

## ❓ 常见问题速查

### Q: 提示 "Native host not available"

```bash
# 解决方案
./test-installation.sh  # 检查安装
cd native-host && ./quick-install.sh  # 重新安装
```

### Q: 找不到 Clone 按钮

1. 确认在 GitHub/GitLab 仓库页面
2. 重新加载扩展
3. 刷新页面

### Q: 如何卸载

```bash
# 1. Chrome 中移除扩展
# 2. 删除 Native Host
rm ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.quick_clone.host.json

# 3. 删除配置（可选）
rm ~/.quick-clone.json
```

## 📁 项目结构

```
quick-clone/
├── get-started.sh              # 一键开始 ⭐
├── test-installation.sh        # 测试安装
├── README.md                   # 主文档
├── INSTALL.md                  # 安装指南
├── MIGRATION.md                # 架构说明
├── IMPROVEMENTS.md             # 改进总结
├── QUICK-REFERENCE.md          # 本文档
│
├── chrome-extension/           # Chrome 扩展
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.*
│   └── options.*
│
└── native-host/                # Native Host
    ├── native-server.js        # 主服务
    ├── native-host.sh          # 包装脚本
    ├── com.quick_clone.host.json  # 注册清单
    ├── quick-install.sh        # 快速安装 ⭐
    └── install-native-host.sh  # 完整安装
```

## 🔗 相关链接

- **Chrome 扩展管理：** `chrome://extensions`
- **Chrome Native Messaging：** [官方文档](https://developer.chrome.com/docs/extensions/mv3/nativeMessaging/)
- **Node.js 下载：** https://nodejs.org
- **Git 下载：** https://git-scm.com

## 💡 提示

- ✅ Native Host 由 Chrome 自动管理，无需手动启动
- ✅ 首次使用时会自动启动进程
- ✅ 空闲时会自动停止，不占用资源
- ✅ 每次加载未打包扩展会生成新 ID，需要重新安装 Native Host
- ✅ 发布到 Chrome Web Store 后 ID 固定，只需安装一次

## 🆘 获取帮助

1. 查看文档：`README.md`, `INSTALL.md`
2. 运行测试：`./test-installation.sh`
3. 查看迁移说明：`MIGRATION.md`
4. 提交 Issue：GitHub Issues

---

**记住：只需运行 `./get-started.sh` 即可完成所有设置！** 🎉
