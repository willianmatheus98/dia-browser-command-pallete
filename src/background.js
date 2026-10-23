const PALETTE_PATH = 'src/palette/palette.html';
const CONTENT_SCRIPT = 'src/content/overlay.js';
const WINDOW_KEY = 'paletteWindowId';
const WINDOW_WIDTH = 720;
const WINDOW_HEIGHT = 480;

function paletteUrl(mode, tab) {
  const params = new URLSearchParams({ mode, tabId: tab.id, windowId: tab.windowId });
  return chrome.runtime.getURL(`${PALETTE_PATH}?${params}`);
}

function toggleOverlay(tab) {
  return chrome.tabs.sendMessage(tab.id, { type: 'dia-palette:toggle', src: paletteUrl('overlay', tab) });
}

// Fallback for pages that can't host the overlay (chrome://, dia://, Web Store, PDF viewer).
async function openPaletteWindow(tab) {
  const parent = await chrome.windows.get(tab.windowId);
  const win = await chrome.windows.create({
    url: paletteUrl('window', tab),
    type: 'popup',
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    left: Math.round((parent.left ?? 0) + ((parent.width ?? WINDOW_WIDTH) - WINDOW_WIDTH) / 2),
    top: Math.round((parent.top ?? 0) + (parent.height ?? 0) * 0.16),
    focused: true,
  });
  await chrome.storage.session.set({ [WINDOW_KEY]: win.id });
}

// Returns true when an open palette window was found and closed.
async function closePaletteWindow() {
  const { [WINDOW_KEY]: id } = await chrome.storage.session.get(WINDOW_KEY);
  if (!id) return false;
  await chrome.storage.session.remove(WINDOW_KEY);
  try {
    await chrome.windows.remove(id);
    return true;
  } catch {
    return false;
  }
}

async function openPalette(tab) {
  if (await closePaletteWindow()) return;

  tab ??= (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab?.id) return;

  try {
    await toggleOverlay(tab);
    return;
  } catch {
    // No content script listening: the tab predates the install, or the page blocks scripts.
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT] });
    await toggleOverlay(tab);
  } catch {
    await openPaletteWindow(tab);
  }
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  const { [WINDOW_KEY]: id } = await chrome.storage.session.get(WINDOW_KEY);
  if (id === windowId) await chrome.storage.session.remove(WINDOW_KEY);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-palette') openPalette(tab);
});

chrome.action.onClicked.addListener((tab) => openPalette(tab));

// ⌘? pressed on a page (see src/content/overlay.js).
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'dia-palette:open' && sender.tab) openPalette(sender.tab);
});
