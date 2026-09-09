const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');

async function run(selected, openTerminal = false) {
  let handler;
  const calls = [];
  const context = vm.createContext({
    require(name) {
      if (name === 'http') return { createServer(fn) { handler = fn; return { listen() {} }; } };
      return require(name);
    }, process, console, setTimeout,
    choose: async () => selected,
    clone: async (url, config) => { calls.push({ url, config, terminal: false }); return { success: true }; },
    terminal: async (url, config) => { calls.push({ url, config, terminal: true }); return { success: true }; }
  });
  vm.runInContext(fs.readFileSync('native-host/server.js', 'utf8') + `
    loadConfig = () => ({ cloneDirectory: '/default', openInTerminal: false });
    chooseFolder = choose; cloneRepo = clone; openInTerminal = terminal;
  `, context);
  const req = new EventEmitter();
  Object.assign(req, { method: 'POST', url: '/clone-with-picker', headers: { host: '127.0.0.1:9456' } });
  const result = new Promise(resolve => {
    handler(req, { setHeader() {}, writeHead() {}, end(body) { resolve(JSON.parse(body)); } });
  });
  req.emit('data', JSON.stringify({ url: 'https://github.com/example/repo.git', directory: '/ignored', openTerminal }));
  req.emit('end');
  return { result: await result, calls };
}

test('popup clone uses the selected folder instead of the default or supplied path', async () => {
  const { result, calls } = await run('/selected');
  assert.equal(result.success, true);
  assert.equal(calls[0].config.cloneDirectory, '/selected');
});
test('cancelled picker never clones', async () => {
  const { result, calls } = await run(null);
  assert.equal(result.cancelled, true);
  assert.equal(calls.length, 0);
});
test('terminal preference uses the chosen directory', async () => {
  const { calls } = await run('/selected', true);
  assert.equal(calls[0].terminal, true);
  assert.equal(calls[0].config.cloneDirectory, '/selected');
});
