const RECENT_KEY = 'recentSearches';
const RECENT_LIMIT = 50;
const HISTORY_LIMIT = 60;

export async function getTabs({ excludeTabId } = {}) {
  const ownPages = chrome.runtime.getURL('');
  const tabs = await chrome.tabs.query({});
  return tabs.filter((tab) => tab.id !== excludeTabId && tab.url && !tab.url.startsWith(ownPages));
}

let bookmarksCache;

// The whole tree is loaded once per palette open and matched locally,
// which is faster and fuzzier than chrome.bookmarks.search per keystroke.
export async function getBookmarks() {
  if (!bookmarksCache) {
    const flat = [];
    const walk = (nodes) => {
      for (const node of nodes) {
        if (node.url) flat.push({ title: node.title, url: node.url });
        if (node.children) walk(node.children);
      }
    };
    walk(await chrome.bookmarks.getTree());
    bookmarksCache = flat;
  }
  return bookmarksCache;
}

export async function searchHistory(text) {
  if (!text.trim()) return [];
  return chrome.history.search({ text, startTime: 0, maxResults: HISTORY_LIMIT });
}

export async function getRecentSearches() {
  const { [RECENT_KEY]: list = [] } = await chrome.storage.local.get(RECENT_KEY);
  return list;
}

export async function saveRecentSearch(query) {
  const text = query.trim();
  if (!text) return;
  const list = await getRecentSearches();
  const rest = list.filter((r) => r.query.toLowerCase() !== text.toLowerCase());
  await chrome.storage.local.set({ [RECENT_KEY]: [{ query: text, at: Date.now() }, ...rest].slice(0, RECENT_LIMIT) });
}
