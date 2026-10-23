import { runItem } from '../core/actions.js';
import { getBookmarks, getRecentSearches, getTabs, searchHistory } from '../core/providers.js';
import { buildResults } from '../core/ranker.js';

const HISTORY_DEBOUNCE_MS = 40;

const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'overlay' ? 'overlay' : 'window';
const ctx = {
  tabId: Number(params.get('tabId')) || undefined,
  windowId: Number(params.get('windowId')) || undefined,
};
document.documentElement.dataset.mode = mode;

const input = document.getElementById('query');
const list = document.getElementById('results');

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  recent: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chat: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
};

const ACTION_LABEL = {
  tab: 'Switch to Tab',
  bookmark: 'Open Bookmark',
  history: 'Open',
  url: 'Open',
  search: 'Search',
  recent: 'Search',
  chat: 'Ask',
};

const SUBTITLE = {
  search: 'Search the web',
  recent: 'Recent search',
  chat: 'Start a new chat',
};

const sources = { tabs: [], bookmarks: [], recentSearches: [] };
let rows = [];
let selected = 0;
let historyTimer;
let requestId = 0;

function iconFor(item) {
  const pageUrl = item.iconUrl ?? (item.kind !== 'url' && item.url);
  if (pageUrl) {
    const src = chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`);
    return `<img src="${src}" alt="" />`;
  }
  const name = item.kind === 'url' ? 'globe' : item.kind;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ICONS.search}</svg>`;
}

function renderRow(item, index) {
  const li = document.createElement('li');
  li.className = 'row';
  li.id = `row-${index}`;
  li.role = 'option';
  li.dataset.kind = item.kind;
  li.dataset.index = index;
  li.innerHTML = `
    <span class="icon">${iconFor(item)}</span>
    <span class="text"><span class="title"></span><span class="subtitle"></span></span>
    <span class="action"></span>`;
  // Titles and URLs come from web pages, so they are set as text, never HTML.
  li.querySelector('.title').textContent = item.title;
  li.querySelector('.subtitle').textContent = item.subtitle ?? SUBTITLE[item.kind] ?? '';
  li.querySelector('.action').textContent = ACTION_LABEL[item.kind];
  return li;
}

function render(next) {
  const selectedId = rows[selected]?.id;
  rows = next;
  const kept = rows.findIndex((r) => r.id === selectedId);
  // Keep the highlight when results only grew (e.g. history arrived); reset when the query changed.
  selected = kept > 0 && input.dataset.lastQuery === input.value ? kept : 0;
  input.dataset.lastQuery = input.value;
  list.replaceChildren(...rows.map(renderRow));
  select(selected);
}

function select(index) {
  if (!rows.length) return;
  selected = (index + rows.length) % rows.length;
  for (const el of list.children) el.setAttribute('aria-selected', String(Number(el.dataset.index) === selected));
  input.setAttribute('aria-activedescendant', `row-${selected}`);
  list.children[selected]?.scrollIntoView({ block: 'nearest' });
}

function update() {
  const id = ++requestId;
  const query = input.value;
  render(buildResults({ query, ...sources }));

  clearTimeout(historyTimer);
  if (!query.trim()) return;
  historyTimer = setTimeout(async () => {
    const history = await searchHistory(query);
    if (id === requestId) render(buildResults({ query, ...sources, history }));
  }, HISTORY_DEBOUNCE_MS);
}

function close() {
  if (mode === 'overlay') {
    window.parent.postMessage({ type: 'dia-palette:close' }, '*');
  } else {
    window.close();
  }
}

async function run(index, openMode) {
  const item = rows[index];
  if (!item) return;
  try {
    await runItem(item, ctx, openMode);
  } catch (error) {
    console.error('[dia-palette] action failed', item, error);
  }
  if (openMode !== 'background') close();
}

function openModeFor(event) {
  if (event.shiftKey) return 'current';
  if (event.metaKey || event.ctrlKey) return 'background';
  return 'new';
}

input.addEventListener('input', update);

input.addEventListener('keydown', (event) => {
  const ctrlOnly = event.ctrlKey && !event.metaKey;
  if (event.key === 'ArrowDown' || (ctrlOnly && event.key === 'n')) {
    event.preventDefault();
    select(selected + 1);
  } else if (event.key === 'ArrowUp' || (ctrlOnly && event.key === 'p')) {
    event.preventDefault();
    select(selected - 1);
  } else if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    run(selected, openModeFor(event));
  }
});

// Keep in sync with isPaletteShortcut in src/content/overlay.js.
function isPaletteShortcut(event) {
  return event.metaKey && event.shiftKey && (event.code === 'Slash' || event.key === '?');
}

document.addEventListener('keydown', (event) => {
  // Pressing the shortcut again while the palette has focus closes it.
  if (event.key === 'Escape' || isPaletteShortcut(event)) {
    event.preventDefault();
    close();
  }
});

list.addEventListener('mousemove', (event) => {
  const row = event.target.closest('.row');
  if (row && Number(row.dataset.index) !== selected) select(Number(row.dataset.index));
});

list.addEventListener('click', (event) => {
  const row = event.target.closest('.row');
  if (row) run(Number(row.dataset.index), openModeFor(event));
});

document.getElementById('backdrop').addEventListener('click', close);

window.addEventListener('focus', () => input.focus());
// The fallback window behaves like a transient popover: clicking away dismisses it.
if (mode === 'window') window.addEventListener('blur', close);

async function init() {
  input.focus();
  render(buildResults({ query: '' }));
  const [tabs, bookmarks, recentSearches] = await Promise.all([
    getTabs({ excludeTabId: mode === 'overlay' ? ctx.tabId : undefined }),
    getBookmarks(),
    getRecentSearches(),
  ]);
  Object.assign(sources, { tabs, bookmarks, recentSearches });
  update();
}

init();
