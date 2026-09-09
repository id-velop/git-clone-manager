const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

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

    const command = `cd "${cloneDir}" && git clone ${url}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ success: false, error: error.message, stderr: stderr });
      } else {
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

    let script;
    if (defaultPath && fs.existsSync(defaultPath)) {
      script = `osascript -e '
        set defaultLocation to POSIX file "${escapedPath}" as alias
        set chosenFolder to choose folder with prompt "Choose a folder to clone into:" default location defaultLocation
        return POSIX path of (chosenFolder as alias)
      '`;
    } else {
      script = `osascript -e '
        set chosenFolder to choose folder with prompt "Choose a folder to clone into:"
        return POSIX path of (chosenFolder as alias)
      '`;
    }

    exec(script, (error, stdout, stderr) => {
      if (error) {
        console.log('Folder selection cancelled or failed:', error.message);
        resolve(null);
      } else {
        const folderPath = stdout.trim();
        resolve(folderPath || null);
      }
    });
  });
}

// Native Messaging protocol helpers
function sendMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.alloc(4 + json.length);
  buffer.writeUInt32LE(json.length, 0);
  buffer.write(json, 4);
  process.stdout.write(buffer);
}

async function handleMessage(message) {
  try {
    switch (message.type) {
      case 'health':
        sendMessage({ type: 'health', status: 'ok', version: '1.1.5' });
        break;

      case 'getConfig':
        const getConfig = loadConfig();
        sendMessage({ type: 'config', config: getConfig });
        break;

      case 'setConfig':
        const currentConfig = loadConfig();
        const merged = { ...currentConfig, ...message.config };
        if (saveConfig(merged)) {
          sendMessage({ type: 'configSaved', success: true, config: merged });
        } else {
          sendMessage({ type: 'configSaved', success: false, error: 'Failed to save config' });
        }
        break;

      case 'chooseFolder':
        const chooseFolderConfig = loadConfig();
        const folder = await chooseFolder(message.defaultPath || chooseFolderConfig.cloneDirectory);
        if (folder) {
          sendMessage({ type: 'folderSelected', success: true, path: folder });
        } else {
          sendMessage({ type: 'folderSelected', success: false, cancelled: true });
        }
        break;

      case 'clone':
        const cloneConfig = loadConfig();
        if (message.directory) {
          cloneConfig.cloneDirectory = message.directory;
        }
        const shouldOpenTerminal = message.openTerminal !== undefined ? message.openTerminal : cloneConfig.openInTerminal;

        if (shouldOpenTerminal) {
          const result = await openInTerminal(message.url, cloneConfig);
          sendMessage({ type: 'cloneResult', ...result });
        } else {
          const result = await cloneRepo(message.url, cloneConfig);
          sendMessage({ type: 'cloneResult', ...result });
        }
        break;

      default:
        sendMessage({ type: 'error', error: 'Unknown message type' });
    }
  } catch (error) {
    sendMessage({ type: 'error', error: error.message });
  }
}

// Read messages from stdin
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  
  while (buffer.length >= 4) {
    const length = buffer.charCodeAt(0) | 
                   (buffer.charCodeAt(1) << 8) | 
                   (buffer.charCodeAt(2) << 16) | 
                   (buffer.charCodeAt(3) << 24);
    
    if (buffer.length < 4 + length) {
      break;
    }
    
    const messageStr = buffer.substring(4, 4 + length);
    buffer = buffer.substring(4 + length);
    
    try {
      const message = JSON.parse(messageStr);
      handleMessage(message);
    } catch (e) {
      sendMessage({ type: 'error', error: 'Invalid JSON' });
    }
  }
});

// Send initial health check
sendMessage({ type: 'ready', status: 'ok' });
