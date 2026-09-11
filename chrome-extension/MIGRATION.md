# Quick Clone - 架构升级说明

## 🎯 问题

之前的版本需要用户手动启动本地服务器：
```bash
cd native-host && node server.js
```

这对普通用户来说太复杂了，不符合"安装即用"的期望。

## ✅ 解决方案

我们将架构从 **HTTP Server** 迁移到 **Chrome Native Messaging**。

### 旧架构（v1.0.x）

```
User Action → Chrome Extension → HTTP Request → Manual Node Server → Git Commands
                                    ↑
                              需要用户手动启动！❌
```

**问题：**
- ❌ 用户需要手动运行 `node server.js`
- ❌ 需要配置 launchd 或保持终端窗口打开
- ❌ 服务器可能意外停止
- ❌ 端口冲突问题

### 新架构（v1.1.0+）

```
User Action → Chrome Extension → Native Messaging API → Auto-started Node Process → Git Commands
                                                         ↑
                                                   Chrome 自动管理！✅
```

**优势：**
- ✅ Chrome 自动启动和管理进程
- ✅ 按需启动，空闲时停止
- ✅ 无需手动操作
- ✅ 更安全的通信通道
- ✅ 符合 Chrome 扩展最佳实践

## 📋 变更清单

### 1. 新增文件

#### `native-host/native-server.js`
- 使用 stdio 协议代替 HTTP
- 实现 Native Messaging 消息格式
- 保持原有的 Git 操作逻辑

#### `native-host/native-host.sh`
- Bash 包装脚本
- Chrome 调用此脚本来启动 Node.js 进程

#### `native-host/com.quick_clone.host.json`
- Native Host 注册清单
- 包含扩展 ID 白名单

#### `native-host/quick-install.sh`
- 一键安装脚本
- 自动注册 Native Host
- 引导用户完成设置

#### `INSTALL.md`
- 详细的安装指南
- 常见问题解答

### 2. 修改文件

#### `chrome-extension/manifest.json`
```json
{
  "permissions": [
    "nativeMessaging",  // ← 新增
    ...
  ]
}
```

#### `chrome-extension/background.js`
```javascript
// 旧代码：HTTP fetch
fetch('http://127.0.0.1:9456/clone', {...})

// 新代码：Native Messaging
chrome.runtime.sendNativeMessage('com.quick_clone.host', {
  type: 'clone',
  url: message.url
}, callback)
```

#### `chrome-extension/content.js`
```javascript
// 旧代码：直接 fetch
const res = await fetch(`${SERVER_URL}/clone`, {...})

// 新代码：通过 background script
const result = await sendMessageToBackground({ 
  type: 'CLONE', 
  url 
})
```

### 3. 保留文件

以下文件保持不变，继续用于向后兼容：
- `native-host/server.js` - 旧的 HTTP 服务器（可选）
- `native-host/setup.sh` - 旧的 launchd 安装脚本（可选）

## 🔧 技术细节

### Native Messaging 协议

Chrome Native Messaging 使用标准输入/输出（stdio）进行通信：

**消息格式：**
```
[4字节长度][JSON消息]
```

**示例：**
```javascript
// 发送消息
const json = JSON.stringify({ type: 'health' });
const buffer = Buffer.alloc(4 + json.length);
buffer.writeUInt32LE(json.length, 0);  // 小端序长度
buffer.write(json, 4);                  // JSON 内容
process.stdout.write(buffer);

// 接收消息
process.stdin.on('data', (chunk) => {
  // 解析长度前缀
  const length = buffer.readUInt32LE(0);
  const message = JSON.parse(buffer.toString('utf8', 4));
});
```

### 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| `health` | Extension → Host | 健康检查 |
| `getConfig` | Extension → Host | 获取配置 |
| `setConfig` | Extension → Host | 更新配置 |
| `chooseFolder` | Extension → Host | 选择文件夹 |
| `clone` | Extension → Host | 克隆仓库 |
| `ready` | Host → Extension | 主机就绪 |
| `config` | Host → Extension | 配置数据 |
| `folderSelected` | Host → Extension | 文件夹选择结果 |
| `cloneResult` | Host → Extension | 克隆结果 |
| `error` | Host → Extension | 错误信息 |

### 安全机制

1. **扩展 ID 白名单**
   - Native Host 只接受来自特定扩展 ID 的消息
   - 在 `com.quick_clone.host.json` 中配置

2. **本地执行**
   - 所有操作在用户本地机器上执行
   - 不通过网络传输敏感数据

3. **权限控制**
   - 需要用户明确授权才能访问文件系统
   - 文件夹选择使用系统原生对话框

## 📊 性能对比

| 指标 | HTTP Server | Native Messaging |
|------|-------------|------------------|
| 启动时间 | 需手动启动 | 自动（~100ms） |
| 资源占用 | 持续运行 | 按需启动 |
| 内存使用 | ~50MB | ~50MB（仅使用时） |
| 用户操作 | 3步 | 1步 |
| 可靠性 | 中等 | 高 |

## 🚀 用户体验改进

### 之前（v1.0.x）

```
1. 安装 Node.js
2. 克隆项目
3. cd native-host
4. node server.js
5. 保持终端窗口打开
6. 安装 Chrome 扩展
7. 配置扩展 ID
8. 才能使用
```

### 现在（v1.1.0+）

```
1. 安装 Node.js
2. 运行 ./quick-install.sh
3. 粘贴扩展 ID
4. 完成！✅
```

**减少了 5 个步骤！**

## 🔄 迁移指南

如果你正在使用旧版本：

### 选项 A：全新安装（推荐）

1. 卸载旧扩展
2. 停止旧服务器：`Ctrl+C` 或 `launchctl unload ...`
3. 按照 INSTALL.md 重新安装

### 选项 B：保留两者

旧版本的 `server.js` 和 `setup.sh` 仍然保留，可以继续使用。
新版本和旧版本互不影响。

## 🐛 已知限制

1. **仅限 macOS**
   - 当前实现使用 AppleScript
   - Windows/Linux 支持需要额外开发

2. **需要 Node.js**
   - 这是唯一的依赖
   - 未来可以考虑打包成独立二进制

3. **扩展 ID 绑定**
   - 每次加载未打包扩展都会生成新 ID
   - 需要重新运行安装脚本
   - 发布到 Chrome Web Store 后固定 ID

## 🔮 未来计划

- [ ] 支持 Windows
- [ ] 支持 Linux
- [ ] 打包为独立应用（pkg/nexe）
- [ ] 发布到 Chrome Web Store
- [ ] 添加进度条显示
- [ ] 支持批量克隆
- [ ] SSH Key 管理

## 📚 参考资料

- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/mv3/nativeMessaging/)
- [Native Messaging Protocol](https://developer.chrome.com/docs/extensions/mv3/nativeMessaging/#native-messaging-protocol)
- [sendNativeMessage API](https://developer.chrome.com/docs/extensions/reference/runtime/#method-sendNativeMessage)

---

**总结：** 通过迁移到 Native Messaging，我们实现了真正的"安装即用"体验，大幅降低了用户使用门槛！🎉
