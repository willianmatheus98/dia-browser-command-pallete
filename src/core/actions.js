import { getAssistant } from './assistants.js';
import { saveRecentSearch } from './providers.js';

/**
 * `ctx` is the tab/window the palette was opened from.
 * `mode` is 'new' (default), 'current' (Shift+Enter) or 'background' (Cmd+Enter).
 */
export async function runItem(item, ctx, mode = 'new') {
  switch (item.kind) {
    case 'tab':
      await chrome.tabs.update(item.tabId, { active: true });
      await chrome.windows.update(item.windowId, { focused: true });
      return;
    case 'bookmark':
    case 'history':
    case 'url':
      return openUrl(item.url, ctx, mode);
    case 'search':
    case 'recent':
      return search(item.query, ctx, mode);
    case 'chat':
      if (item.assistant === 'dia') return askDia(item.query);
      return openUrl(getAssistant(item.assistant).url(item.query), ctx, mode);
  }
}

// The background script hands this to the native helper, which presses ⌘E in Dia
// and pastes the query. Copying here first doubles as the fallback when the helper
// isn't installed: ⌘E, ⌘V by hand.
async function askDia(query) {
  if (query) {
    try {
      await navigator.clipboard.writeText(query);
    } catch {
      // The helper sets the clipboard itself, so this is only the fallback path.
    }
  }
  chrome.runtime.sendMessage({ type: 'dia-palette:ask-dia', query });
}

async function openUrl(url, ctx, mode) {
  if (mode === 'current' && ctx.tabId) {
    await chrome.tabs.update(ctx.tabId, { url });
  } else {
    await chrome.tabs.create({ url, windowId: ctx.windowId, active: mode !== 'background' });
  }
  await focusWindow(ctx);
}

async function search(query, ctx, mode) {
  await saveRecentSearch(query);
  const tabId =
    mode === 'current' && ctx.tabId
      ? ctx.tabId
      : (await chrome.tabs.create({ url: 'about:blank', windowId: ctx.windowId, active: mode !== 'background' })).id;

  // chrome.search uses the user's default engine; fall back to Google if Dia lacks the API.
  if (chrome.search?.query) {
    await chrome.search.query({ text: query, tabId });
  } else {
    await chrome.tabs.update(tabId, { url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
  }
  await focusWindow(ctx);
}

async function focusWindow(ctx) {
  if (ctx.windowId) await chrome.windows.update(ctx.windowId, { focused: true });
}
