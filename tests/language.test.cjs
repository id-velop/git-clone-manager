const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function load(language, browserLanguage = 'en-US') {
  let storageListener;
  const context = {
    navigator: { language: browserLanguage },
    document: { querySelector: () => null, addEventListener() {} },
    chrome: {
      storage: {
        local: { async get() { return { language }; } },
        onChanged: { addListener(fn) { storageListener = fn; } }
      }
    }
  };
  vm.runInNewContext(fs.readFileSync('chrome-extension/i18n.js', 'utf8'), context);
  await context.QuickCloneI18n.ready;
  return { translate: context.QuickCloneI18n.translate, change: storageListener };
}

test('stored language wins over browser language after reopening', async () => {
  const { translate } = await load('en', 'zh-CN');
  assert.equal(translate('设置'), 'Settings');
});

test('first use defaults to English regardless of browser language', async () => {
  const { translate } = await load(undefined, 'zh-CN');
  assert.equal(translate('克隆仓库'), 'Clone repository');
});

test('language changes reach existing contexts and preserve error details and paths', async () => {
  const { translate, change } = await load('en');
  change({ language: { newValue: 'zh' } }, 'local');
  assert.equal(translate('Clone failed: Permission denied'), '克隆失败：Permission denied');
  assert.equal(translate('Cloned to Projects/My Repo'), '已克隆到 Projects/My Repo');
  assert.equal(translate('git@github.com:owner/repo.git'), 'git@github.com:owner/repo.git');
  change({ language: { newValue: 'en' } }, 'local');
  assert.equal(translate('克隆失败：Permission denied'), 'Clone failed: Permission denied');
});
