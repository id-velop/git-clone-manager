const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 9456;
const CONFIG_FILE = path.join(os.homedir(), '.git-magager.json');

// Default config
const DEFAULT_CONFIG = {
  cloneDirectory: path.join(os.homedir(), 'Projects'),
  openInTerminal: true,
  terminalApp: 'Terminal'
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

    const command = `git clone ${url} "${cloneDir}"`;

    exec(command, (error, stdout, stderr) => {
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

function openInTerminal(url, config) {
  return new Promise((resolve, reject) => {
    const cloneDir = config.cloneDirectory;
    ensureCloneDir(cloneDir);

    const terminalApp = config.terminalApp || 'Terminal';
    let command;

    if (terminalApp === 'iTerm') {
      command = `osascript -e '
        tell application "iTerm"
          activate
          create window with default profile
          tell current session of current window
            write text "cd \\"${cloneDir}\\" && git clone ${url} && cd \\"$(basename ${url} .git)\\""
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
          keystroke "cd \\"${cloneDir}\\" && git clone ${url} && cd \\"$(basename ${url} .git)\\""
          keystroke return
        end tell'`;
    } else {
      // Default macOS Terminal
      command = `osascript -e '
        tell application "Terminal"
          activate
          do script "cd \\"${cloneDir}\\" && git clone ${url} && cd \\"$(basename ${url} .git)\\""
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
  // CORS headers - allow all origins since we only listen on localhost
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
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
    res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
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

  // Choose folder endpoint - shows native macOS folder picker
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

  // Clone endpoint
  if (req.method === 'POST' && req.url === '/clone') {
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
        // Override clone directory if specified in request
        if (directory) {
          config.cloneDirectory = directory;
        }
        const shouldOpenTerminal = openTerminal !== undefined ? openTerminal : config.openInTerminal;

        if (shouldOpenTerminal) {
          const result = await openInTerminal(url, config);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } else {
          const result = await cloneRepo(url, config);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }
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
  console.log(`Git Magager Host running at http://127.0.0.1:${PORT}`);
  console.log(`Clone directory: ${loadConfig().cloneDirectory}`);
  console.log('Press Ctrl+C to stop');
});
