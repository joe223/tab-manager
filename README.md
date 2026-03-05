# Tab Manager

<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="Tab Manager Logo">
</p>

<p align="center">
  <strong>Smart Tab Management Chrome Extension</strong>
</p>

<p align="center">
  Auto-group tabs by domain · Smart close inactive tabs · Protect important domains
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/chrome-Manifest%20V3-green" alt="Manifest V3">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="License">
  <img src="https://img.shields.io/badge/react-18.3-61DAFB" alt="React">
  <img src="https://img.shields.io/badge/plasmo-0.90.5-blueviolet" alt="Plasmo">
</p>

---

## Features

### 🗂️ Auto Tab Grouping
- Automatically group new tabs by **level-1 domain**
- Smart recognition of two-part TLDs (e.g., `.co.uk`, `.com.au`)
- Group color generated based on domain hash
- Groups `mail.google.com` → `google.com`

### ⏱️ Auto-close Inactive Tabs
- Configurable inactivity threshold (default: 60 minutes)
- Configurable check interval (default: 5 minutes)
- Smart skip: pinned tabs, tabs playing audio

### 🛡️ Domain Whitelist Protection
- Specify domains that are never auto-closed
- Perfect for frequently used tools, long-running tasks

### 📊 Statistics Tracking
- Track how many tabs have been closed
- Quick view of current tab count, group count

### 🎛️ Quick Actions
- One-click group all tabs
- One-click ungroup all tabs
- Manually close inactive tabs

## Installation

### Development Mode

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Load the extension in Chrome:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `build/chrome-mv3-dev/` directory

### Production Build

```bash
npm run build
```

The production bundle will be in `build/chrome-mv3-prod/`, ready to be zipped and published to Chrome Web Store.

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| Auto-group | Automatically group new tabs by domain | ✅ Enabled |
| Auto-close | Automatically close inactive tabs | ✅ Enabled |
| Inactive threshold | Minutes before closing inactive tabs | 60 |
| Check interval | How often to check for inactive tabs | 5 min |
| Whitelisted domains | Domains that are never auto-closed | None |

## Project Structure

```
tab-manager/
├── background.ts        # Service Worker - Core background logic
├── popup.tsx            # Popup window UI
├── options.tsx          # Settings page UI
├── src/
│   ├── types.ts         # TypeScript type definitions
│   ├── storage.ts       # Storage layer abstraction
│   └── utils.ts         # Utility functions
├── assets/              # Icons and static resources
│   ├── icon.svg
│   └── icon.png
├── build/               # Build output directory
│   ├── chrome-mv3-dev/  # Development build
│   └── chrome-mv3-prod/ # Production build
├── .github/
│   └── workflows/       # CI/CD workflows
│       └── submit.yml   # Chrome Web Store auto-publish
├── package.json
├── tsconfig.json
├── TECH.md              # Technical architecture docs
└── README.md
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `tabs` | Read and manage tabs |
| `tabGroups` | Create and manage tab groups |
| `storage` | Persist settings and statistics |
| `alarms` | Schedule periodic inactive checks |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Plasmo](https://plasmo.com/) 0.90.5 |
| UI | React 18.3 + TypeScript 5.7 |
| Storage | @plasmohq/storage + Chrome Storage API |
| Target | Chrome (Manifest V3) |

## Core Modules

### Background Service Worker (`background.ts`)

The extension's core engine handles:
- **Tab Grouping Logic**: Listens to `tabs.onCreated` and `tabs.onUpdated` events
- **Inactive Detection**: Periodic checks via Chrome Alarms API
- **Access Time Tracking**: Records last access time for each tab

### Popup (`popup.tsx`)

Quick access dashboard:
- Display current tab statistics
- Toggle auto features
- Quick action buttons

### Options (`options.tsx`)

Full configuration interface:
- All settings configuration
- Whitelist domain management
- Statistics reset

## Domain Grouping Strategy

Groups by **level-1 domain**, not full hostname:

| URL | Group Domain |
|-----|--------------|
| `mail.google.com` | `google.com` |
| `github.com` | `github.com` |
| `bbc.co.uk` | `bbc.co.uk` |
| `example.com.au` | `example.com.au` |

Smart recognition of two-part TLDs: `.co.uk`, `.com.au`, `.co.jp`, `.com.br`, etc.

## Design Decisions

| Data | Storage | Reason |
|------|---------|--------|
| `domainGroupMap` | In-memory Map | Rebuilt via `loadExistingGroups()` on restart |
| `tabData` | `storage.local` | Persisted to survive browser restarts |

## Development

### Adding New Features

1. Add type definitions in `src/types.ts`
2. Add storage logic in `src/storage.ts`
3. Add background handling in `background.ts`
4. Add UI in `popup.tsx` / `options.tsx`

### Adding New Permissions

1. Update `package.json` → `manifest.permissions`
2. Use new API in `background.ts`
3. Rebuild extension

## CI/CD

Automated Chrome Web Store publishing via GitHub Actions:
- Auto-build and submit on tag push
- Uses `bpp` (Chrome Web Store Publish) tool

## Related Documentation

- [Technical Architecture](./TECH.md) - Detailed technical design and architecture

## License

[MIT](LICENSE)

---

<p align="center">
  Made with ❤️ using <a href="https://plasmo.com/">Plasmo</a>
</p>
