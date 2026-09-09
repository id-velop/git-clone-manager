const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(preference, choice, failSave = false) {
  const state = { preference, prompts: 0, cloned: [], errors: [], ready: true };
  const context = vm.createContext({
    window: { location: { href: 'https://git.example.com/team/repo' } },
    document: { getElementById: () => ({ disabled: false }) },
    chrome: { storage: { local: {
      get: async () => ({ cloneProtocol: state.preference }),
      async set(value) {
        if (failSave) throw new Error('Storage failed');
        state.preference = value.cloneProtocol;
      }
    } } },
    testHealth: async () => state.ready,
    testChoose: async () => { state.prompts++; return choice; },
    testClone: async url => { state.cloned.push(url); },
    testNotify: message => { state.errors.push(message); }
  });
  const source = fs.readFileSync('chrome-extension/content.js', 'utf8');
  vm.runInContext(source.slice(0, source.indexOf('  // Run on load')) + `
    getCloneUrls = () => ({ https: 'https://git.example.com/team/repo.git', ssh: 'git@git.example.com:team/repo.git' });
    chooseCloneProtocol = testChoose;
    checkServer = testHealth;
    doClone = testClone;
    showNotification = testNotify;
    globalThis.start = startCloneWithPreference;
  })();`, context);
  return { state, start: context.start };
}

test('no preference asks each time and leaves storage unchanged', async () => {
  const h = harness(undefined, { protocol: 'https', remember: false });
  await h.start(); await h.start();
  assert.equal(h.state.prompts, 2);
  assert.equal(h.state.preference, undefined);
  assert.deepEqual(h.state.cloned, Array(2).fill('https://git.example.com/team/repo.git'));
});

test('remembered SSH skips the chooser on later clicks', async () => {
  const h = harness(undefined, { protocol: 'ssh', remember: true });
  await h.start(); await h.start();
  assert.equal(h.state.prompts, 1);
  assert.equal(h.state.preference, 'ssh');
  assert.deepEqual(h.state.cloned, Array(2).fill('git@git.example.com:team/repo.git'));
});

test('popup changes are read on the next click', async () => {
  const h = harness('https', { protocol: 'https', remember: false });
  await h.start();
  h.state.preference = 'ssh';
  await h.start();
  h.state.preference = '';
  await h.start();
  assert.deepEqual(h.state.cloned, ['https://git.example.com/team/repo.git', 'git@git.example.com:team/repo.git', 'https://git.example.com/team/repo.git']);
  assert.equal(h.state.prompts, 1);
});

test('cancel does not clone or save', async () => {
  const h = harness(undefined, null);
  await h.start();
  assert.equal(h.state.cloned.length, 0);
  assert.equal(h.state.preference, undefined);
});

test('storage failure reports error without cloning or locking later clicks', async () => {
  const h = harness(undefined, { protocol: 'ssh', remember: true }, true);
  await h.start(); await h.start();
  assert.equal(h.state.cloned.length, 0);
  assert.equal(h.state.errors.length, 2);
  assert.equal(h.state.prompts, 2);
});

test('unavailable service reports an error before protocol selection', async () => {
  const h = harness(undefined, { protocol: 'https', remember: false });
  h.state.ready = false;
  await h.start();
  assert.equal(h.state.prompts, 0);
  assert.equal(h.state.cloned.length, 0);
  assert.equal(h.state.errors.length, 1);
});
