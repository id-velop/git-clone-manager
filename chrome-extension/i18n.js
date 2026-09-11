// Shared language preference. Translate only extension-owned UI roots.
(() => {
  const messages = {
  "Language": "语言",
  "Settings": "设置",
  "← Back": "← 返回",
  "Checking": "检测中",
  "Connected": "已连接",
  "Offline": "未连接",
  "Starting": "启动中",
  "Connecting…": "连接中…",
  "Connecting...": "连接中…",
  "Clone protocol": "克隆协议",
  "Repository address (HTTPS)": "仓库地址（HTTPS）",
  "Repository address (SSH)": "仓库地址（SSH）",
  "Open Terminal after clone": "克隆后打开终端",
  "Default folder": "默认文件夹",
  "Terminal app": "终端应用",
  "macOS Terminal": "macOS 终端",
  "Save changes": "保存设置",
  "Version 1.1.5": "版本 1.1.5",
  "Icon created by Lagot Design from the Noun Project": "图标由 Noun Project 的 Lagot Design 创作",
  "Set up local companion": "安装本地服务",
  "Run this in Terminal, then reconnect.": "在终端运行以下命令，然后重新连接。",
  "Run this in PowerShell, then reconnect.": "在 PowerShell 运行以下命令，然后重新连接。",
  "Loading install command…": "正在生成安装命令…",
  "Copy command": "复制命令",
  "Reconnect": "重新连接",
  "macOS · Installs Node.js and Git if needed. May ask for your Mac password.": "适用于 macOS · 自动安装缺少的 Node.js 和 Git，可能需要输入 Mac 密码。",
  "Windows · Installs Node.js and Git if needed. No manual configuration required.": "适用于 Windows · 自动安装缺少的 Node.js 和 Git，无需手动配置。",
  "Open the installed extension to get your command.": "请打开已安装的扩展获取命令。",
  "Copied. Paste into Terminal.": "已复制，请粘贴到终端运行。",
  "Copied. Paste into PowerShell.": "已复制，请粘贴到 PowerShell 运行。",
  "Select the command above and copy it manually.": "请选择上方命令并手动复制。",
  "Failed to launch server": "无法启动本地服务",
  "The companion started but did not respond.": "本地服务已启动，但未响应。",
  "Companion not found. Run the command above first.": "未找到本地服务，请先运行上方命令。",
  "Failed to start the companion.": "无法启动本地服务。",
  "Could not load your protocol. Reopen the popup to retry.": "无法读取协议偏好，请重新打开弹窗。",
  "Could not save. Try again.": "保存失败，请重试。",
  "Choose a folder…": "请选择文件夹…",
  "Choose folder...": "请选择文件夹…",
  "Clone failed": "克隆失败",
  "Repository cloned": "仓库已克隆",
  "Loading…": "加载中…",
  "Saving…": "保存中…",
  "Saved.": "已保存。",
  "Try again.": "请重试。",
  "Go back and connect the companion, then reopen Settings.": "请返回并连接本地服务，再打开设置。",
  "Connect the companion to edit settings.": "连接本地服务后可修改设置。",
  "Destination": "保存位置",
  "Default clone directory": "默认克隆目录",
  "You can still choose a different folder from Quick Clone.": "克隆时仍可选择其他文件夹。",
  "Terminal": "终端",
  "Preferred application": "默认应用",
  "Open after clone": "克隆后打开",
  "Preferences saved.": "设置已保存。",
  "Failed to save": "保存失败",
  "macOS setup": "macOS 安装",
  "Install companion": "安装本地服务",
  "Run this in Terminal, then reconnect from the extension.": "在终端运行以下命令，然后在扩展中重新连接。",
  "Settings | Quick Clone": "设置 | Quick Clone",
  "Set up your Mac | Quick Clone": "配置 Mac | Quick Clone",
  "Cloning…": "克隆中…",
  "Cloned!": "已克隆",
  "No Server": "服务未连接",
  "Failed": "失败",
  "Unknown error": "未知错误",
  "Could not start clone": "无法开始克隆",
  "Could not read clone status": "无法读取克隆状态",
  "Click Quick Clone in the Chrome toolbar to install the companion.": "请点击 Chrome 工具栏中的 Quick Clone 安装本地服务。",
  "Could not select clone method. Please reload the extension.": "无法选择克隆方式，请重新加载扩展。",
  "Server not running. Click the extension icon and press \"Start Server\".": "本地服务未运行，请打开扩展并点击“重新连接”。",
  "Extension updated. Refresh this page and try again.": "扩展已更新，请刷新当前页面后重试。",
  "Cannot connect to extension. Refresh this page and try again.": "无法连接扩展，请刷新当前页面后重试。"
};
  const reverse = new Map(Object.entries(messages).map(([en, zh]) => [zh, en]));
  const prefixes = [['Clone failed: ', '克隆失败：'], ['Could not save: ', '保存失败：'], ['Folder selection failed: ', '文件夹选择失败：'], ['Cloned to ', '已克隆到 ']];
  let language = 'en';
  const roots = new Set();
  function translate(text) {
    const trimmed = text.trim();
    const en = reverse.get(trimmed) || trimmed;
    let result = language === 'zh' ? (messages[en] || en) : en;
    for (const [english, chinese] of prefixes) {
      if (trimmed.startsWith(english) || trimmed.startsWith(chinese)) {
        const prefix = trimmed.startsWith(english) ? english : chinese;
        result = (language === 'zh' ? chinese : english) + translate(trimmed.slice(prefix.length));
        break;
      }
    }
    return text.replace(trimmed, result);
  }
  function render(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest('script, style, code, pre, textarea, [data-language-option]')) continue;
      const value = translate(node.nodeValue);
      if (value !== node.nodeValue) node.nodeValue = value;
    }
    for (const element of root.querySelectorAll('[aria-label], [title]')) {
      for (const attribute of ['aria-label', 'title']) {
        if (!element.hasAttribute(attribute)) continue;
        const value = translate(element.getAttribute(attribute));
        if (value !== element.getAttribute(attribute)) element.setAttribute(attribute, value);
      }
    }
  }
  function refresh() {
    for (const root of roots) render(root);
    if (document.documentElement) document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll?.('[data-language-option]').forEach(button => {
      const selected = button.dataset.languageOption === language;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('active', selected);
    });
  }
  function observe(root) {
    roots.add(root);
    render(root);
    const observer = new MutationObserver(() => render(root));
    observer.observe(root, {subtree: true, childList: true, characterData: true});
    return () => { observer.disconnect(); roots.delete(root); };
  }
  const ready = (async () => {
    try {
      const stored = await chrome.storage.local.get('language');
      if (['en', 'zh'].includes(stored.language)) language = stored.language;
    } catch (_) { /* English is the default. */ }
    refresh();
  })();
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area === 'local' && ['en', 'zh'].includes(changes.language?.newValue)) {
      language = changes.language.newValue;
      refresh();
    }
  });
  globalThis.QuickCloneI18n = {translate, observe, ready};
  document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('[data-language-option]')) return;
    await ready;
    observe(document.documentElement);
    refresh();
    document.querySelectorAll('[data-language-option]').forEach(button => {
      button.addEventListener('click', async () => {
        const nextLanguage = button.dataset.languageOption;
        document.querySelectorAll('[data-language-option]').forEach(option => { option.disabled = true; });
        try {
          await chrome.storage.local.set({language: nextLanguage});
          language = nextLanguage;
          refresh();
        } catch (_) {
          const status = document.getElementById('language-status');
          if (status) status.textContent = translate('Could not save. Try again.');
        } finally {
          document.querySelectorAll('[data-language-option]').forEach(option => { option.disabled = false; });
        }
      });
    });
  });
})();
