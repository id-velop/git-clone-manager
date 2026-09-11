const http = require('http');
const { exec, execFile } = require('child_process');
const { randomUUID } = require('crypto');
const cloneJobs = new Map();
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 9456;
const EXTENSION_ID = process.env.GM_EXTENSION_ID || process.argv[2] || '';
const GIT_BIN = process.env.GM_GIT_BIN || process.argv[3] || 'git';
if (EXTENSION_ID && !/^[a-p]{32}$/.test(EXTENSION_ID)) throw new Error('Invalid extension ID');
const CONFIG_FILE = path.join(os.homedir(), '.git-magager.json');

// Default config
const DEFAULT_CONFIG = {
  cloneDirectory: path.join(os.homedir(), 'Projects'),
  openInTerminal: false,
  terminalApp: process.platform === 'win32' ? 'WindowsTerminal' : 'Terminal'
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load config:', e.message);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save config:', e.message);
    return false;
  }
}

function ensureCloneDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cloneRepo(url, config) {
  return new Promise((resolve, reject) => {
    const cloneDir = config.cloneDirectory;
    ensureCloneDir(cloneDir);

    console.log(`Cloning ${url} into ${cloneDir}...`);
    execFile(GIT_BIN, ['clone', '--', url], {
      cwd: cloneDir,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      maxBuffer: 16 * 1024 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Clone failed: ${error.message}`);
        reject({ success: false, error: error.message, stderr: stderr });
      } else {
        console.log(`Clone succeeded: ${stdout || 'done'}`);
        resolve({ success: true, output: stdout, stderr: stderr });
      }
    });
  });
}

function repositoryName(url) {
  return url.replace(/[\\/]+$/, '').split(/[\\/:]/).pop().replace(/\.git$/, '');
}

function openTerminalAt(directory, config) {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      let settled = false;
      const finish = result => { if (!settled) { settled = true; resolve(result); } };
      const child = require('child_process').spawn('wt.exe', ['-d', directory], { detached: true, stdio: 'ignore' });
      child.once('spawn', () => { child.unref(); finish({ success: true }); });
      child.once('error', () => {
        const fallback = require('child_process').spawn('cmd.exe', ['/d', '/k', 'cd', '/d', directory], {
          detached: true, stdio: 'ignore', windowsHide: false
        });
        fallback.once('spawn', () => { fallback.unref(); finish({ success: true }); });
        fallback.once('error', error => reject({ success: false, error: error.message }));
      });
      return;
    }

    const terminalApp = config.terminalApp || 'Terminal';
    let command;

    if (terminalApp === 'iTerm') {
      command = `osascript -e '
        tell application "iTerm"
          activate
          create window with default profile
          tell current session of current window
            write text "cd \\"${directory}\\""
          end tell
        end tell'`;
    } else if (terminalApp === 'Warp') {
      command = `osascript -e '
        tell application "Warp"
          activate
        end tell' && osascript -e '
        tell application "System Events"
          keystroke "t" using command down
          delay 0.3
          keystroke "cd \\"${directory}\\""
          keystroke return
        end tell'`;
    } else {
      // Default macOS Terminal
      command = `osascript -e '
        tell application "Terminal"
          activate
          do script "cd \\"${directory}\\""
        end tell'`;
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ success: false, error: error.message });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
}

function chooseFolder(defaultPath) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const ps = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
        "$dialog.Description = 'Choose a folder to clone into'",
        defaultPath && fs.existsSync(defaultPath) ? `$dialog.SelectedPath = '${defaultPath.replace(/'/g, "''")}'` : '',
        'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }'
      ].filter(Boolean).join('; ');
      execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', ps], { windowsHide: true }, (error, stdout) => {
        resolve(error ? null : (stdout.trim() || null));
      });
      return;
    }
    const escapedPath = (defaultPath || '~').replace(/'/g, "'\\''");

    // Only set default location if the directory actually exists
    // (AppleScript 'as alias' fails for non-existent paths)
    let script;
    if (defaultPath && fs.existsSync(defaultPath)) {
      script = `osascript -e '
        set defaultLocation to POSIX file "${escapedPath}" as alias
        set chosenFolder to choose folder with prompt "Choose a folder to clone into:" default location defaultLocation
        return POSIX path of (chosenFolder as alias)
      '`;
    } else {
      // No default location or path doesn't exist
      script = `osascript -e '
        set chosenFolder to choose folder with prompt "Choose a folder to clone into:"
        return POSIX path of (chosenFolder as alias)
      '`;
    }

    exec(script, (error, stdout, stderr) => {
      if (error) {
        // User cancelled or error
        console.log('Folder selection cancelled or failed:', error.message);
        resolve(null);
      } else {
        const folderPath = stdout.trim();
        console.log('Selected folder:', folderPath);
        resolve(folderPath || null);
      }
    });
  });
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  const allowedOrigin = EXTENSION_ID ? `chrome-extension://${EXTENSION_ID}` : null;
  const validDevelopmentOrigin = /^chrome-extension:\/\/[a-p]{32}$/.test(origin || '');
  if (req.headers.host !== `127.0.0.1:${PORT}` || (origin && origin !== allowedOrigin && !(allowedOrigin === null && validDevelopmentOrigin))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '1.1.5' }));
    return;
  }

  // Get config
  if (req.method === 'GET' && req.url === '/config') {
    const config = loadConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config));
    return;
  }

  // Update config
  if (req.method === 'POST' && req.url === '/config') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const newConfig = JSON.parse(body);
        const config = loadConfig();
        const merged = { ...config, ...newConfig };
        if (saveConfig(merged)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, config: merged }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Failed to save config' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Choose folder endpoint - shows the operating system's native folder picker.
  if (req.method === 'POST' && req.url === '/choose-folder') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { defaultPath } = body ? JSON.parse(body) : {};
        const config = loadConfig();
        const folder = await chooseFolder(defaultPath || config.cloneDirectory);
        if (folder) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, path: folder }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, cancelled: true, error: 'User cancelled' }));
        }
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Short requests let the extension poll without a long-lived HTTP connection.
  if (req.method === 'POST' && req.url === '/clone-jobs') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { url, directory } = JSON.parse(body);
        if (typeof url !== 'string' || !url.trim()) throw new Error('URL is required');
        const config = loadConfig();
        if (directory) config.cloneDirectory = directory;
        const id = randomUUID();
        const job = { id, status: 'running' };
        cloneJobs.set(id, job);
        void (async () => {
          try {
            await cloneRepo(url, config);
            job.status = 'complete';
          } catch (error) {
            job.status = 'failed';
            job.error = error.error || error.message || 'Clone failed';
          } finally {
            setTimeout(() => cloneJobs.delete(id), 60 * 60 * 1000).unref();
          }
        })();
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(job));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/clone-jobs/')) {
    const job = cloneJobs.get(req.url.slice('/clone-jobs/'.length));
    res.writeHead(job ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(job || { error: 'Clone status unavailable. The local server may have restarted.' }));
    return;
  }

  // Clone endpoint
  if (req.method === 'POST' && (req.url === '/clone' || req.url === '/clone-with-picker')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { url, openTerminal, directory } = JSON.parse(body);
        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'URL is required' }));
          return;
        }

        const config = loadConfig();
        // Keep selection and cloning in the companion: opening the system picker
        // can dismiss Chrome's popup and disconnect its message response channel.
        if (req.url === '/clone-with-picker') {
          const selectedFolder = await chooseFolder(config.cloneDirectory);
          if (!selectedFolder) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, cancelled: true }));
            return;
          }
          config.cloneDirectory = selectedFolder;
        }
        // Override clone directory if specified in request
        if (directory && req.url !== '/clone-with-picker') {
          config.cloneDirectory = directory;
        }
        const shouldOpenTerminal = openTerminal !== undefined ? openTerminal : config.openInTerminal;

        const result = await cloneRepo(url, config);
        if (shouldOpenTerminal) {
          await openTerminalAt(path.join(config.cloneDirectory, repositoryName(url)), config);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: e.error || e.message || 'Clone failed'
        }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Quick Clone Host running at http://127.0.0.1:${PORT}`);
  console.log(`Clone directory: ${loadConfig().cloneDirectory}`);
  console.log('Press Ctrl+C to stop');
});
