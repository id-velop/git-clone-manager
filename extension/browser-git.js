// Browser-native Git clone support for Git Magager.
// Requires the vendored `git` (isomorphic-git) and `LightningFS` globals.

(function (global) {
  'use strict';

  const TEMP_DIR = '/repository';
  let cloneInProgress = false;

  function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  async function collectBody(body) {
    if (!body) return null;

    const chunks = [];
    let size = 0;
    for await (const chunk of body) {
      const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      chunks.push(bytes);
      size += bytes.byteLength;
    }

    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytesToBase64(result);
  }

  function createResponseBody(port) {
    const queued = [];
    const waiting = [];
    let ended = false;
    let failure = null;

    function acknowledge() {
      try {
        port.postMessage({ type: 'ack' });
      } catch (error) {
        // The background request has already ended.
      }
    }

    function deliver(bytes) {
      if (waiting.length > 0) {
        waiting.shift().resolve({ done: false, value: bytes });
        acknowledge();
      } else {
        queued.push(bytes);
      }
    }

    function finish() {
      ended = true;
      while (waiting.length > 0) {
        waiting.shift().resolve({ done: true, value: undefined });
      }
    }

    function fail(error) {
      failure = error;
      while (waiting.length > 0) {
        waiting.shift().reject(error);
      }
    }

    const iterator = {
      next() {
        if (queued.length > 0) {
          const value = queued.shift();
          acknowledge();
          return Promise.resolve({ done: false, value });
        }
        if (failure) return Promise.reject(failure);
        if (ended) return Promise.resolve({ done: true, value: undefined });
        return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
      },
      return() {
        ended = true;
        try {
          port.postMessage({ type: 'cancel' });
          port.disconnect();
        } catch (error) {
          // The request may already be complete.
        }
        finish();
        return Promise.resolve({ done: true, value: undefined });
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };

    return { iterator, deliver, finish, fail };
  }

  function createHttpClient() {
    return {
      async request({ url, method = 'GET', headers = {}, body }) {
        const port = chrome.runtime.connect({ name: 'git-http' });
        const responseBody = createResponseBody(port);

        const response = new Promise((resolve, reject) => {
          let responseStarted = false;
          let responseFinished = false;

          port.onMessage.addListener(message => {
            if (message.type === 'response') {
              responseStarted = true;
              resolve({
                url: message.url,
                method: message.method,
                statusCode: message.statusCode,
                statusMessage: message.statusMessage,
                headers: message.headers,
                body: responseBody.iterator
              });
              return;
            }

            if (message.type === 'chunk') {
              responseBody.deliver(base64ToBytes(message.data));
              return;
            }

            if (message.type === 'done') {
              responseFinished = true;
              responseBody.finish();
              port.disconnect();
              return;
            }

            if (message.type === 'error') {
              responseFinished = true;
              const error = new Error(message.error || 'Git network request failed');
              if (!responseStarted) reject(error);
              responseBody.fail(error);
              port.disconnect();
            }
          });

          port.onDisconnect.addListener(() => {
            if (responseFinished) return;
            const error = new Error('Git network request was interrupted');
            if (!responseStarted) reject(error);
            responseBody.fail(error);
          });
        });

        port.postMessage({
          type: 'start',
          url,
          method,
          headers,
          body: await collectBody(body)
        });

        return response;
      }
    };
  }

  function normalizeCloneUrl(value) {
    const input = value.trim();
    const scpMatch = input.match(/^git@([^:]+):(.+)$/);
    if (scpMatch) return `https://${scpMatch[1]}/${scpMatch[2]}`;

    if (input.startsWith('ssh://')) {
      const sshUrl = new URL(input);
      sshUrl.protocol = 'https:';
      sshUrl.username = '';
      sshUrl.password = '';
      sshUrl.port = '';
      return sshUrl.toString();
    }

    const url = new URL(input);
    if (url.protocol !== 'https:') {
      throw new Error('Browser clone currently supports HTTPS repositories only');
    }
    url.hash = '';
    url.search = '';
    return url.toString();
  }

  function getRepositoryName(url) {
    const pathname = new URL(url).pathname.replace(/\/+$/, '');
    const rawName = decodeURIComponent(pathname.split('/').pop() || 'repository');
    const name = rawName.replace(/\.git$/i, '').replace(/[\\/:*?"<>|]/g, '-').trim();
    return name || 'repository';
  }

  async function getEmptyDestination(parentHandle, repositoryName) {
    try {
      await parentHandle.getDirectoryHandle(repositoryName);
      throw new Error(`Folder "${repositoryName}" already exists`);
    } catch (error) {
      if (error.name !== 'NotFoundError') throw error;
      const handle = await parentHandle.getDirectoryHandle(repositoryName, { create: true });
      return { handle, created: true };
    }
  }

  async function writeFile(directoryHandle, name, data) {
    const fileHandle = await directoryHandle.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(data);
    } finally {
      await writable.close();
    }
  }

  async function copyVirtualDirectory(fs, sourcePath, destinationHandle, progress) {
    const names = await fs.promises.readdir(sourcePath);
    let copied = 0;

    for (const name of names) {
      const source = `${sourcePath}/${name}`;
      const stat = await fs.promises.lstat(source);

      if (stat.isDirectory()) {
        const child = await destinationHandle.getDirectoryHandle(name, { create: true });
        await copyVirtualDirectory(fs, source, child, progress);
      } else if (stat.isSymbolicLink()) {
        // File System Access cannot create native symlinks. Writing the link target
        // mirrors Git's core.symlinks=false checkout behavior.
        const target = await fs.promises.readlink(source);
        await writeFile(destinationHandle, name, target);
      } else {
        const data = await fs.promises.readFile(source);
        await writeFile(destinationHandle, name, data);
      }

      copied += 1;
      if (progress && copied % 25 === 0) progress(copied);
    }
  }

  function formatProgress(event) {
    if (!event || !event.phase) return 'Cloning repository...';
    if (event.total > 0) {
      const percentage = Math.min(100, Math.round((event.loaded / event.total) * 100));
      return `${event.phase} ${percentage}%`;
    }
    return event.phase;
  }

  async function deleteTemporaryFileSystem(fs, databaseName) {
    try {
      await fs.promises.flush();
      if (typeof fs.promises._deactivate === 'function') {
        await fs.promises._deactivate();
      }
    } catch (error) {
      console.warn('[Git Magager] Could not close temporary filesystem:', error);
    }

    try {
      indexedDB.deleteDatabase(databaseName);
    } catch (error) {
      console.warn('[Git Magager] Could not delete temporary filesystem:', error);
    }
  }

  async function cloneRepository(value, { onStatus } = {}) {
    if (cloneInProgress) throw new Error('Another clone is already in progress');
    if (!global.showDirectoryPicker) {
      throw new Error('Folder selection is not supported by this browser. Use the latest Chrome or Edge.');
    }
    if (!global.git || !global.LightningFS) {
      throw new Error('Browser Git engine failed to load');
    }

    const url = normalizeCloneUrl(value);
    const repositoryName = getRepositoryName(url);

    // This must remain the first awaited browser operation so the picker keeps
    // the transient user activation from the Clone button click.
    const parentHandle = await global.showDirectoryPicker({
      id: 'git-magager-clone',
      mode: 'readwrite',
      startIn: 'downloads'
    });

    cloneInProgress = true;
    let destination = null;
    let databaseName = null;
    let fs = null;

    try {
      destination = await getEmptyDestination(parentHandle, repositoryName);
      databaseName = `git-magager-${crypto.randomUUID()}`;
      fs = new global.LightningFS(databaseName, { wipe: true });

      onStatus?.('Connecting to repository...');
      await global.git.clone({
        fs,
        http: createHttpClient(),
        dir: TEMP_DIR,
        url,
        singleBranch: true,
        depth: 1,
        noTags: true,
        onProgress(event) {
          onStatus?.(formatProgress(event));
        }
      });

      // The browser API cannot preserve POSIX modes or native symlinks.
      // Tell desktop Git to ignore those filesystem capability differences.
      await global.git.setConfig({ fs, dir: TEMP_DIR, path: 'core.filemode', value: false });
      await global.git.setConfig({ fs, dir: TEMP_DIR, path: 'core.symlinks', value: false });

      onStatus?.('Saving repository files...');
      await copyVirtualDirectory(fs, TEMP_DIR, destination.handle, count => {
        onStatus?.(`Saving repository files... ${count}`);
      });

      return {
        success: true,
        repositoryName,
        destinationName: `${parentHandle.name}/${repositoryName}`
      };
    } catch (error) {
      if (destination?.created) {
        try {
          await parentHandle.removeEntry(repositoryName, { recursive: true });
        } catch (cleanupError) {
          console.warn('[Git Magager] Could not remove incomplete clone:', cleanupError);
        }
      }
      throw error;
    } finally {
      cloneInProgress = false;
      if (fs && databaseName) await deleteTemporaryFileSystem(fs, databaseName);
    }
  }

  global.GitMagagerBrowser = {
    cloneRepository,
    normalizeCloneUrl,
    getRepositoryName
  };
})(globalThis);
