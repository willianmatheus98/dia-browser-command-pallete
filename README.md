# Dia Command Palette

An Arc-style command palette for the [Dia](https://www.diabrowser.com/) browser. Press ⌘? and a
palette opens over the current page:

- **Open tabs**: pick one and it switches to that tab, no new tab is created
- **Recent searches**, **bookmarks** and **history**
- **Search the web**: always fixed in the second row (first row when nothing matches well),
  or **Open URL** when you type an address
- **Ask Dia**: opens Dia's side chat (⌘E) and sends your query, via the optional native helper
- **Ask Claude / ChatGPT / Gemini**: opens a new chat with your query already filled in

## Install (unpacked)

1. Open `chrome://extensions` in Dia and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder (the one with `manifest.json`).

No build step: the extension runs straight from source. The extension ID is pinned to
`dhaljlfbeljgnkhgnhjdigkepfpblbme` by the `key` in `manifest.json`.

### Optional: Ask Dia helper

Extensions can't press browser shortcuts, so "Ask Dia" uses a small native messaging helper
(`native/`) that tells macOS to press ⌘E in Dia, paste the query and press Return.

```sh
bash native/install.sh             # registers the helper with Dia (needs python3)
bash native/install.sh --uninstall
```

Restart Dia after installing. On first use macOS asks to let Dia control your computer: allow it
under **System Settings → Privacy & Security → Accessibility**. Without the helper, Ask Dia just
copies the query: press ⌘E and ⌘V yourself.

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
  background.js        command handler: toggles the overlay, or a popup window fallback;
                       relays Ask Dia to the native helper
  content/overlay.js   mounts the palette in a full-viewport iframe on the page
  content/gemini-prefill.js  types the prompt into Gemini (it has no ?q= support)
  palette/             the palette page (UI + keyboard handling)
  core/
    assistants.js      Dia / Claude / ChatGPT / Gemini and their prefill links
    ranker.js          ordering rules, fuzzy matching, de-duplication (pure, unit tested)
    providers.js       tabs, bookmarks, history, recent searches
    actions.js         switch / open / search / ask
native/
  dia_palette_helper.py  native messaging host: ⌘E, paste, Return in Dia
  install.sh             registers it in Dia's NativeMessagingHosts
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

- Dia has no URL to open its chat with a prompt, hence the keystroke helper. ⌘E toggles the side
  chat, so if it's already open, Ask Dia closes it instead. Ask Dia also replaces your clipboard
  with the query.
- The Claude and ChatGPT `?q=` links and the Gemini prefill script rely on undocumented
  behavior and may break when those sites change.
- Sites that put elements in the browser's top layer (fullscreen video, open `<dialog>`s) can
  cover the overlay.
