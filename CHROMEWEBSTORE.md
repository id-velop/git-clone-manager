# Chrome Web Store Listing — Quick Clone

> Last Updated: 2026-09-11

## Store Listing

**Extension Name**

Quick Clone

**Short Description**

Clone GitHub and GitLab repositories to a chosen local folder with HTTPS or SSH.

**Detailed Description**

Quick Clone adds an Instant Clone action to supported GitHub and GitLab repository pages.

Quick Clone uses HTTPS by default. Users can switch the saved method to SSH from the extension popup, select a destination folder, and follow clone progress without manually copying repository addresses. Quick Clone supports macOS and Windows and configures its local companion from one setup command.

Install the Quick Clone local companion before cloning. Repository addresses, destination folders, and preferences stay on your device. Quick Clone does not use analytics, advertising, or tracking services.

**Category**

Developer Tools

**Single Purpose**

Clone repositories from supported GitHub and GitLab pages to the user's computer.

**Primary Language**

English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---:|---|---|
| Store Icon | 128×128 PNG | Ready | `chrome-extension/icons/icon128.png` |
| Screenshot 1 | 1280×800 or 640×400 | Not created | |
| Screenshot 2 | 1280×800 or 640×400 | Not created | |
| Screenshot 3 | 1280×800 or 640×400 | Not created | |
| Small Promo Tile | 440×280 | Not created | |

### Screenshot Notes

- Settings includes an English / 简体中文 selector. Language is stored locally and applies to extension pages and repository-page controls. Capture both language variants.

- Branding is now Quick Clone, with a white folder and downward download arrow on a #07BEB8 background. Refresh all store screenshots to use this name and icon.

- Refresh popup screenshots for the flat layout: no workspace title or address labels; header settings icon and version inside settings.

Settings now opens inside the extension popup with a Back button; refresh the settings screenshot accordingly.

1. Instant Clone action on a GitHub repository page.
2. HTTPS default and the HTTPS/SSH preference in the extension popup.
3. Teal (#07BEB8) popup with a setup-first offline state and an inline one-command companion setup below Instant Clone. The command installs missing Node.js and Git on macOS or Windows. Refresh popup and settings screenshots for this visual revision; the icon now uses #07BEB8 and controls use smaller corner radii.

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `storage` | permissions | Saves the user's preferred Instant Clone method locally. |
| `activeTab` | permissions | Reads the repository page opened when the user clicks the extension so the popup can prefill its HTTPS and SSH clone addresses. |
| `nativeMessaging` | permissions | Starts and communicates with the locally installed Quick Clone companion that selects folders and runs Git. |
| Supported GitHub and GitLab origins | host_permissions | Detects repository pages and adds the user-invoked Instant Clone action on those pages. |
| `http://127.0.0.1:9456/*` | host_permissions | Sends clone, folder-selection, and settings requests to the Quick Clone companion on the same computer. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No.

Quick Clone processes the current repository address, selected destination folder, clone settings, and preferred protocol locally. It does not transmit this information off the user's device or share it with third parties.

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**: TODO — publish `privacy-policy.html` at a stable public HTTPS URL before submission.

## Distribution

**Visibility**: Public

**Regions**: All regions

## Developer Info

**Publisher Name**: TODO

**Contact Email**: better0027@gmail.com

**Support URL**: https://github.com/id-velop/git-clone-manager/issues

**Homepage URL**: https://github.com/id-velop/git-clone-manager

## Version History

| Version | Date | Changes | Status |
|---|---|---|---|
| 1.1.5 protocol revision | 2026-09-11 | Uses HTTPS by default and keeps protocol changes inside the extension popup, removing the repository-page chooser. | Draft |
| 1.1.5 platform revision | 2026-09-11 | Adds one-command Windows setup, native Windows folder selection, Windows Terminal support, and automatic prerequisite installation. | Draft |
| 1.1.5 UI revision | 2026-09-09 | Adds a companion setup guide with the current extension ID and a copyable install command. Prioritizes installation and reconnection in the offline state; introduces teal primary actions. | Draft |
| 1.1.5 | 2026-09-09 | Introduces a new light desktop-tool interface, a focused HTTPS/SSH workspace, clearer connection states, and redesigned repository-page feedback. | Draft |
| 1.1.4 | 2026-09-09 | Adds reliable GitLab repository detection, HTTPS/SSH choices, saved protocol preference, GitLab page integration, and clone progress. Removes internal update and distribution mechanisms. | Draft |

## Review Notes

### Known Issues / Limitations

- The local companion supports macOS and Windows with Google Chrome.
- Users run one setup command once; it installs prerequisites and registers the local companion without manual path configuration.
- The store package contains only extension runtime files; it does not install or update the extension outside Chrome Web Store.
