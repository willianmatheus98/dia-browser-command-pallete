# Dia Command Palette

An Arc-style command palette for the [Dia](https://www.diabrowser.com/) browser. Press ⌘? and a
palette opens over the current page:

- **Open tabs**: pick one and it switches to that tab, no new tab is created
- **Recent searches**, **bookmarks** and **history**
- **Search the web**: always fixed in the second row (first row when nothing matches well),
  or **Open URL** when you type an address
- **Ask Dia / New chat**: opens Dia's native new tab, with your query copied to the clipboard

## Install (unpacked)

1. Open `chrome://extensions` in Dia and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder (the one with `manifest.json`).

No build step: the extension runs straight from source.

## Shortcuts

- **⌘?** (⌘⇧/) opens the palette on any regular web page; press it again to close.
  Extension shortcuts can't use `/`, so this one is caught by the content script and only works on
  pages that allow extension scripts.
- **⌥T** (rebindable in `chrome://extensions/shortcuts`) and the **toolbar icon** work everywhere,
  including `dia://` pages, where the palette opens as a small popup window.

If ⌘? opens macOS's Help menu search instead, disable it under **System Settings → Keyboard →
Keyboard Shortcuts… → App Shortcuts → All Applications → Show Help menu**.

## Keys

| Key | Action |
| --- | --- |
| ↑ ↓ / Ctrl+P Ctrl+N | Move selection |
| ↵ | Open (switch tab, or new tab for searches and links) |
| ⇧↵ | Open in the current tab |
| ⌘↵ | Open in background, palette stays open |
| Esc / click outside | Close |

## How it works

```
manifest.json
src/
  background.js        command handler: toggles the overlay, or a popup window fallback
  content/overlay.js   mounts the palette in a full-viewport iframe on the page
  palette/             the palette page (UI + keyboard handling)
  core/
    ranker.js          ordering rules, fuzzy matching, de-duplication (pure, unit tested)
    providers.js       tabs, bookmarks, history, recent searches
    actions.js         switch / open / search / new chat
```

Pages that block extension scripts (`chrome://`, `dia://`, the Web Store, the PDF viewer) can't
host the overlay, so the palette opens in a small centered popup window there instead.

Recent searches are stored locally in `chrome.storage.local` (last 50) and never leave the browser.

## Development

```sh
npm test   # unit tests for the ranking core (Node 20+)
```

After editing, click the reload icon on the extension card in `chrome://extensions`. Open tabs pick
up the new content script the next time the shortcut is pressed.

## Known limitations

- Dia has no known URL to start a chat with a prefilled prompt, so "Ask Dia" copies the query to
  the clipboard and opens Dia's new tab for you to paste it.
- Sites that put elements in the browser's top layer (fullscreen video, open `<dialog>`s) can
  cover the overlay.
