const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  const state = { cloned: [], errors: [], ready: true, messages: [], canOpen: true };
  const context = vm.createContext({
    window: { location: { href: 'https://git.example.com/team/repo' } },
    document: { getElementById: () => ({ disabled: false }) },
    chrome: { storage: { local: {} } },
    testHealth: async () => state.ready,
    testMessage: async message => { state.messages.push(message.type); return { success: state.canOpen }; },
    testClone: async url => { state.cloned.push(url); },
    testNotify: message => { state.errors.push(message); }
  });
  const source = fs.readFileSync('chrome-extension/content.js', 'utf8');
  vm.runInContext(source.slice(0, source.indexOf('  // Run on load')) + `
    getCloneUrls = () => ({ https: 'https://git.example.com/team/repo.git', ssh: 'git@git.example.com:team/repo.git' });
    checkServer = testHealth;
    sendMessageToBackground = testMessage;
    doClone = testClone;
    showNotification = testNotify;
    globalThis.start = startClone;
  })();`, context);
  return { state, start: context.start };
}

test('repository actions always use HTTPS', async () => {
  const h = harness();
  await h.start(); await h.start();
  assert.deepEqual(h.state.cloned, Array(2).fill('https://git.example.com/team/repo.git'));
});

test('unavailable service opens setup before cloning', async () => {
  const h = harness();
  h.state.ready = false;
  await h.start();
  assert.equal(h.state.cloned.length, 0);
  assert.equal(h.state.errors.length, 0);
  assert.deepEqual(h.state.messages, ['OPEN_SETUP']);
});

test('popup opening failure tells the user where to find setup', async () => {
  const h = harness();
  h.state.ready = false;
  h.state.canOpen = false;
  await h.start();
  assert.match(h.state.errors[0], /Chrome toolbar/);
  assert.equal(h.state.cloned.length, 0);
});
