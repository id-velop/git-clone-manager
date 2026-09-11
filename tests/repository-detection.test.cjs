const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('chrome-extension/content.js', 'utf8');

function page(url, platform = 'gitlab', project = true) {
  const buttons = new Map();
  const actionBar = { querySelector: () => null, appendChild: button => buttons.set(button.id, button) };
  const document = {
    querySelector(selector) {
      if (selector.startsWith('[data-project-id]')) return project ? {} : null;
      if (selector.startsWith('.project-repo-buttons')) return platform === 'gitlab' ? actionBar : null;
      if (selector.startsWith('.file-navigation')) return platform === 'github' ? actionBar : null;
      return null;
    },
    querySelectorAll: () => [],
    getElementById: id => buttons.get(id),
    createElement: () => ({ addEventListener() {}, remove() { buttons.delete(this.id); } })
  };
  const context = vm.createContext({
    window: { location: new URL(url) }, document,
    chrome: { runtime: { getURL: path => `chrome-extension://test/${path}` } }
  });
  // Expose the production helpers without starting timers or clone operations.
  vm.runInContext(source.slice(0, source.indexOf('  // Run on load')) +
    'globalThis.api = { getCloneUrls, isRepoPage, injectPageButton }; })();', context);
  return { ...context, buttons };
}

for (const host of ['gitlab.com', 'git.example.com']) {
  for (const suffix of ['', '/', '/-/tree/main', '/-/blob/main/README.md', '/-/pipelines']) {
    test(`${host}: nested repository ${suffix || 'root'}`, () => {
      const p = page(`https://${host}/example-org/example-team/clone-manager${suffix}`);
      assert.equal(p.api.getCloneUrls().https, `https://${host}/example-org/example-team/clone-manager.git`);
      assert.equal(p.api.getCloneUrls().ssh, `git@${host}:example-org/example-team/clone-manager.git`);
      p.api.injectPageButton();
      p.api.injectPageButton();
      assert.equal(p.buttons.size, 1);
    });
  }
}

test('namespace names starting with tree or pipelines are preserved', () => {
  const p = page('https://gitlab.com/tree-team/pipelines-tools/project/-/tree/main');
  assert.equal(p.api.getCloneUrls().https, 'https://gitlab.com/tree-team/pipelines-tools/project.git');
});

test('GitLab group and sign-in pages do not get a Quick Clone button', () => {
  for (const path of ['/groups/example-org/team', '/users/sign_in', '/dashboard/projects']) {
    const p = page(`https://git.example.com${path}`, 'gitlab', false);
    p.api.injectPageButton();
    assert.equal(p.buttons.size, 0);
  }
});

test('GitHub button and clone URL still work', () => {
  const p = page('https://github.com/id-velop/quick-clone', 'github');
  p.api.injectPageButton();
  assert.equal(p.buttons.size, 1);
  assert.equal(p.api.getCloneUrls().https, 'https://github.com/id-velop/quick-clone.git');
});

test('icon is accessible on all content-script hosts', () => {
  const manifest = JSON.parse(fs.readFileSync('chrome-extension/manifest.json', 'utf8'));
  assert.ok(manifest.web_accessible_resources[0].resources.includes('icons/icon.svg'));
  for (const match of manifest.content_scripts[0].matches) {
    assert.ok(manifest.web_accessible_resources[0].matches.includes(match));
  }
});
