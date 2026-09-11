const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(preference) {
  const state = { preference, cloned: [], errors: [], ready: true, messages: [], canOpen: true };
  const context = vm.createContext({
    window: { location: { href: 'https://git.example.com/team/repo' } },
    document: { getElementById: () => ({ disabled: false }) },
    chrome: { storage: { local: {
      get: async () => ({ cloneProtocol: state.preference }),
      async set(value) { state.preference = value.cloneProtocol; }
    } } },
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
    globalThis.start = startCloneWithPreference;
  })();`, context);
  return { state, start: context.start };
}

test('no preference uses HTTPS immediately', async () => {
  const h = harness(undefined);
  await h.start(); await h.start();
  assert.deepEqual(h.state.cloned, Array(2).fill('https://git.example.com/team/repo.git'));
});

test('saved SSH is used without an on-page chooser', async () => {
  const h = harness('ssh');
  await h.start(); await h.start();
  assert.deepEqual(h.state.cloned, Array(2).fill('git@git.example.com:team/repo.git'));
});

test('popup changes are read on the next click', async () => {
  const h = harness('https');
  await h.start();
  h.state.preference = 'ssh';
  await h.start();
  h.state.preference = '';
  await h.start();
  assert.deepEqual(h.state.cloned, ['https://git.example.com/team/repo.git', 'git@git.example.com:team/repo.git', 'https://git.example.com/team/repo.git']);
});

test('unavailable service opens setup before protocol selection', async () => {
  const h = harness(undefined);
  h.state.ready = false;
  await h.start();
  assert.equal(h.state.cloned.length, 0);
  assert.equal(h.state.errors.length, 0);
  assert.deepEqual(h.state.messages, ['OPEN_SETUP']);
});

test('popup opening failure tells the user where to find setup', async () => {
  const h = harness(undefined);
  h.state.ready = false;
  h.state.canOpen = false;
  await h.start();
  assert.match(h.state.errors[0], /Chrome toolbar/);
  assert.equal(h.state.cloned.length, 0);
});
