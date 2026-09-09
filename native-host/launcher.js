/**
 * Clone to Folder - Native Host Launcher
 *
 * Chrome auto-launches this via Native Messaging when the extension
 * calls chrome.runtime.connectNative('com.git_magager.host').
 *
 * This launcher:
 *   1. Spawns the HTTP server (server.js) on port 9456
 *   2. Keeps running to maintain the native messaging connection
 *   3. Handles basic native messages (health check, shutdown)
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const SCRIPT_DIR = __dirname;
let httpServer = null;
let serverStarted = false;

function checkHealth() {
  return new Promise(resolve => {
    const request = http.get('http://127.0.0.1:9456/health', response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve(response.statusCode === 200 && JSON.parse(body).status === 'ok'); }
        catch { resolve(false); }
      });
      response.on('error', () => resolve(false));
    });
    request.setTimeout(500, () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

async function startHttpServer() {
  if (await checkHealth()) return true;
  httpServer = spawn(process.execPath, [path.join(SCRIPT_DIR, 'server.js')], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env }
  });
  httpServer.on('error', err => {
    process.stderr.write(`[launcher] Failed to start server: ${err.message}\n`);
  });
  httpServer.unref();
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await checkHealth()) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

// --- Native Messaging protocol ---
function sendNativeMessage(message) {
  const json = JSON.stringify(message);
  const header = Buffer.alloc(4);
  header.writeUInt32LE(Buffer.byteLength(json, 'utf8'), 0);
  process.stdout.write(Buffer.concat([header, Buffer.from(json, 'utf8')]));
}

// Read native messages from stdin
let buffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (buffer.length >= 4) {
    const msgLen = buffer.readUInt32LE(0);
    if (buffer.length < 4 + msgLen) break;

    const msgData = buffer.slice(4, 4 + msgLen);
    buffer = buffer.slice(4 + msgLen);

    try {
      const message = JSON.parse(msgData.toString('utf8'));
      handleNativeMessage(message);
    } catch (e) {
      process.stderr.write(`[launcher] Invalid message: ${e.message}\n`);
    }
  }
});

async function handleNativeMessage(message) {
  switch (message.type) {
    case 'health':
      serverStarted = await startup;
      sendNativeMessage({
        type: 'health',
        status: 'ok',
        serverRunning: serverStarted,
        version: '1.1.5'
      });
      break;

    case 'shutdown':
      sendNativeMessage({ type: 'shutdown', status: 'ok' });
      if (httpServer) {
        httpServer.kill('SIGTERM');
      }
      process.exit(0);
      break;

    default:
      sendNativeMessage({
        type: 'error',
        error: `Unknown message type: ${message.type}`
      });
  }
}

// --- Startup ---
process.stderr.write('[launcher] Clone to Folder Native Host starting...\n');
const startup = startHttpServer();

// When Chrome disconnects (closes stdin), exit cleanly.
// The HTTP server is detached and will keep running independently.
process.stdin.on('end', () => {
  process.stderr.write('[launcher] Chrome disconnected, exiting (server stays alive)\n');
  process.exit(0);
});

// Keep stdin flowing
process.stdin.resume();
