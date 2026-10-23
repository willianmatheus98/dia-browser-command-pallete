const PALETTE_PATH = 'src/palette/palette.html';
const CONTENT_SCRIPT = 'src/content/overlay.js';

function paletteUrl(mode, tab) {
  const params = new URLSearchParams({ mode, tabId: tab.id, windowId: tab.windowId });
  return chrome.runtime.getURL(`${PALETTE_PATH}?${params}`);
}

function toggleOverlay(tab) {
  return chrome.tabs.sendMessage(tab.id, { type: 'dia-palette:toggle', src: paletteUrl('overlay', tab) });
}

async function openPalette(tab) {
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
  } catch (error) {
    console.warn('[dia-palette] cannot show overlay on this page', tab.url, error);
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-palette') openPalette(tab);
});

chrome.action.onClicked.addListener((tab) => openPalette(tab));
