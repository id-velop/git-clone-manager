# Clone Manager

Clone GitHub and GitLab repositories to a chosen local folder with one click.

## ✨ Features

- 🚀 Instant Clone action on GitHub and GitLab repository pages
- 🔀 HTTPS and SSH clone methods with a remembered preference
- ⏳ Visible progress for long-running clones
- 📁 Native folder picker for selecting clone location
- 💻 Automatic terminal opening (optional)
- ⚙️ Configurable clone directory and terminal app
- 🔒 Local execution through a registered Chrome companion

## 📦 Installation

Install the extension from Chrome Web Store when the listing is published, then install the separate Clone Manager local companion.

The steps below are for local development builds.

### Prerequisites

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org)
- **Google Chrome** browser
- **Git** installed on your system

### Development Quick Start

**The easiest way:** Run the interactive setup script!

```bash
cd /path/to/git-magager
chmod +x get-started.sh
./get-started.sh
```

This script will:
- ✅ Check prerequisites (Node.js, Git)
- ✅ Guide you through extension installation
- ✅ Automatically run the native host installer

---

**Or follow manual steps below:**

#### Step 1: Install Node.js

If you haven't installed Node.js yet:

```bash
# Using Homebrew (recommended)
brew install node

# Or download from https://nodejs.org
```

Verify installation:
```bash
node --version
npm --version
```

#### Step 2: Load the Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder from this project
5. Copy the **Extension ID** (looks like: `abcdefghijklmnopqrstuvwx`)

#### Step 3: Install Native Host

Open Terminal and run:

```bash
cd /path/to/git-magager/native-host
chmod +x install-native-host.sh
./install-native-host.sh
```

When prompted, paste your **Extension ID** from Step 2.

The script will:
- ✅ Register the native messaging host with Chrome
- ✅ Create default configuration
- ✅ Set up automatic startup (no manual server needed!)

#### Step 4: Start Cloning!

1. Visit any GitHub or GitLab repository
2. Look for the **Clone** button (floating or in the page header)
3. Click it and choose a folder
4. The repository will be cloned automatically! 🎉

## 🔧 Configuration

Configuration is stored in `~/.git-magager.json`:

```json
{
  "cloneDirectory": "~/Projects",
  "openInTerminal": false,
  "terminalApp": "Terminal"
}
```

### Options

- **cloneDirectory**: Default directory for cloning repositories
- **openInTerminal**: Whether to open terminal after clone (default: false)
- **terminalApp**: Terminal application to use (`Terminal`, `iTerm`, or `Warp`)

You can modify this file manually, or use the extension's options page.

## 🛠️ Architecture

This extension uses **Chrome Native Messaging** to start a local Node.js HTTP server. Clone and configuration requests then use `http://127.0.0.1:9456`:

```
Chrome Extension → Native Messaging Launcher → Local HTTP Server → Git
Chrome Extension ←──────── HTTP :9456 ────────→ Local HTTP Server
```

**Benefits:**
- ✅ No manual server startup required
- ✅ Automatically starts when needed
- ✅ Secure communication channel
- ✅ Full access to system commands

## 📝 Development

### Project Structure

```
git-magager/
├── chrome-extension/     # Chrome extension files
│   ├── manifest.json
│   ├── background.js     # Service worker
│   ├── content.js        # Page interaction
│   ├── popup.*           # Popup UI
│   └── options.*         # Settings page
├── native-host/          # Native messaging host
│   ├── native-server.js  # Main server logic
│   ├── native-host.sh    # Wrapper script
│   └── install-native-host.sh  # Installation script
└── README.md
```

### Making Changes

1. Edit the extension files in `chrome-extension/`
2. Reload the extension in Chrome (`chrome://extensions` → Reload)
3. Test your changes

For native host changes:
1. Edit `native-host/native-server.js`
2. Reload the extension to restart the native host

## ❓ Troubleshooting

### "Native host not available" error

1. Make sure Node.js is installed: `node --version`
2. Re-run the installation script: `./install-native-host.sh`
3. Check that the extension ID matches in the native host manifest

### Extension not showing Clone button

1. Make sure you're on a valid GitHub/GitLab repository page
2. Reload the extension in Chrome
3. Refresh the repository page

### Permission denied errors

Make sure the scripts are executable:
```bash
chmod +x native-host/install-native-host.sh
chmod +x native-host/native-host.sh
```

## 📄 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Native Host troubleshooting

If Chrome reports `Specified native messaging host not found`, run:

```bash
bash native-host/install-native-host.sh YOUR_EXTENSION_ID
```

Use the ID of the loaded extension shown in `chrome://extensions`, then reload
that extension. The installer registers `com.git_magager.host` and copies the
server into `~/Library/Application Support/Clone Manager`. It records the current
Node.js executable path, so Chrome does not depend on your shell's PATH. Rerun
the installer after updating the helper code or moving/removing that Node.js
installation. The extension needs permission to access `http://127.0.0.1:9456/*`.
