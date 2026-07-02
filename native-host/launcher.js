/**
 * Git Magager - Native Host Launcher
 *
 * Chrome auto-launches this via Native Messaging when the extension
 * calls chrome.runtime.connectNative('com.git-magager.host').
 *
 * This launcher:
 *   1. Spawns the HTTP server (server.js) on port 9456
 *   2. Keeps running to maintain the native messaging connection
 *   3. Handles basic native messages (health check, shutdown)
 */

const { spawn } = require('child_process');
const path = require('path');

const SCRIPT_DIR = __dirname;
let httpServer = null;
let serverStarted = false;

// --- Start HTTP server (always spawn, if already running the new one just fails) ---
function startHttpServer() {
  const serverPath = path.join(SCRIPT_DIR, 'server.js');

  httpServer = spawn('node', [serverPath], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env }
  });

  // NOTE: Do NOT call unref() — it causes the child to be killed when parent exits.
  // Instead, we explicitly process.exit(0) when Chrome closes stdin.
  // detached: true ensures the child survives parent exit.

  httpServer.on('error', (err) => {
    process.stderr.write(`[launcher] Failed to start server: ${err.message}\n`);
  });

  httpServer.on('close', (code) => {
    process.stderr.write(`[launcher] HTTP server exited with code ${code}\n`);
    httpServer = null;
  });

  serverStarted = true;
  process.stderr.write('[launcher] HTTP server spawned on port 9456\n');
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

function handleNativeMessage(message) {
  switch (message.type) {
    case 'health':
      sendNativeMessage({
        type: 'health',
        status: 'ok',
        serverRunning: serverStarted,
        version: '2.1.0'
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
process.stderr.write('[launcher] Git Magager Native Host starting...\n');
startHttpServer();

// When Chrome disconnects (closes stdin), exit cleanly.
// The HTTP server is detached and will keep running independently.
process.stdin.on('end', () => {
  process.stderr.write('[launcher] Chrome disconnected, exiting (server stays alive)\n');
  process.exit(0);
});

// Keep stdin flowing
process.stdin.resume();
