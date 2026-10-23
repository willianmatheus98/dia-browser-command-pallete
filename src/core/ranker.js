import { ASSISTANTS, getAssistant } from './assistants.js';
import { fuzzyScore } from './fuzzy.js';
import { displayUrl, normalizeUrl, toUrl } from './url.js';

export const MAX_RESULTS = 9;
const MIN_MATCH = 0.25;
// A match must be at least this good to outrank the search row in slot 1.
const STRONG_MATCH = 0.75;

const WEIGHT = { tab: 1.25, bookmark: 1.1, history: 1, recent: 0.95 };
// When the same page appears in several sources, keep the earliest kind listed here.
const PRIORITY = ['tab', 'bookmark', 'history'];

const HOUR = 60 * 60 * 1000;

function recencyBoost(timestamp, now) {
  if (!timestamp) return 0;
  const ageHours = Math.max(0, now - timestamp) / HOUR;
  return 0.15 * Math.exp(-ageHours / 72);
}

function matchScore(query, title, url) {
  return Math.max(fuzzyScore(query, title), url ? fuzzyScore(query, displayUrl(url)) * 0.9 : 0);
}

export function tabItem(tab) {
  return {
    id: `tab:${tab.id}`,
    kind: 'tab',
    title: tab.title || displayUrl(tab.url),
    url: tab.url,
    subtitle: displayUrl(tab.url),
    tabId: tab.id,
    windowId: tab.windowId,
  };
}

function urlItem(kind, entry) {
  return {
    id: `${kind}:${entry.url}`,
    kind,
    title: entry.title || displayUrl(entry.url),
    url: entry.url,
    subtitle: displayUrl(entry.url),
  };
}

export function searchItem(query) {
  return { id: `search:${query}`, kind: 'search', title: query, query };
}

export function recentItem(query) {
  return { id: `recent:${query}`, kind: 'recent', title: query, query };
}

export function chatItem(query, assistant) {
  return {
    id: `chat:${assistant.id}`,
    kind: 'chat',
    assistant: assistant.id,
    title: query ? `Ask ${assistant.name}: ${query}` : `Open ${assistant.name} chat`,
    subtitle: assistant.home ? displayUrl(assistant.home) : assistant.subtitle,
    iconUrl: assistant.home,
    query,
  };
}

export function openUrlItem(url) {
  return { id: `url:${url}`, kind: 'url', title: displayUrl(url), url, subtitle: url };
}

function scoreCandidates(query, { tabs, bookmarks, history, recentSearches, now }) {
  const candidates = [];

  for (const tab of tabs) {
    const match = matchScore(query, tab.title, tab.url);
    if (match < MIN_MATCH) continue;
    candidates.push({ item: tabItem(tab), match, score: match * WEIGHT.tab + recencyBoost(tab.lastAccessed, now) });
  }
  for (const bookmark of bookmarks) {
    const match = matchScore(query, bookmark.title, bookmark.url);
    if (match < MIN_MATCH) continue;
    candidates.push({ item: urlItem('bookmark', bookmark), match, score: match * WEIGHT.bookmark });
  }
  for (const entry of history) {
    const match = matchScore(query, entry.title, entry.url);
    if (match < MIN_MATCH) continue;
    const visits = 0.05 * Math.log10(1 + (entry.visitCount || 0));
    candidates.push({
      item: urlItem('history', entry),
      match,
      score: match * WEIGHT.history + recencyBoost(entry.lastVisitTime, now) + visits,
    });
  }
  const typed = query.trim().toLowerCase();
  for (const recent of recentSearches) {
    if (recent.query.toLowerCase() === typed) continue; // already covered by the search row
    const match = fuzzyScore(query, recent.query);
    if (match < MIN_MATCH) continue;
    candidates.push({ item: recentItem(recent.query), match, score: match * WEIGHT.recent + recencyBoost(recent.at, now) });
  }

  return candidates;
}

function dedupe(candidates) {
  const byKey = new Map();
  const rank = (c) => {
    const i = PRIORITY.indexOf(c.item.kind);
    return i === -1 ? PRIORITY.length : i;
  };
  for (const c of [...candidates].sort((a, b) => rank(a) - rank(b))) {
    const key = c.item.url ? normalizeUrl(c.item.url) : c.item.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, c);
    } else {
      existing.score = Math.max(existing.score, c.score);
      existing.match = Math.max(existing.match, c.match);
    }
  }
  return [...byKey.values()];
}

/**
 * Builds the ordered palette rows.
 *
 * Empty query: recent tabs, recent searches, then the Dia side chat.
 * With a query: the best match (if strong) in slot 1, the search / open-URL row
 * fixed in slot 2, remaining matches, then one "Ask …" row per assistant.
 * `max` caps the rows before the assistant rows.
 */
export function buildResults({
  query = '',
  tabs = [],
  bookmarks = [],
  history = [],
  recentSearches = [],
  now = Date.now(),
  max = MAX_RESULTS,
}) {
  const text = query.trim();

  if (!text) {
    const recentTabs = [...tabs]
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
      .slice(0, max - 3)
      .map(tabItem);
    const searches = recentSearches.slice(0, 3).map((r) => recentItem(r.query));
    return [...recentTabs, ...searches, chatItem('', getAssistant('dia'))];
  }

  const url = toUrl(text);
  const primary = url ? openUrlItem(url) : searchItem(text);
  const matches = dedupe(scoreCandidates(text, { tabs, bookmarks, history, recentSearches, now }))
    .sort((a, b) => b.score - a.score)
    .filter((c) => !(url && c.item.url && normalizeUrl(c.item.url) === normalizeUrl(url) && c.item.kind !== 'tab'));

  const rows = [];
  if (matches.length && matches[0].match >= STRONG_MATCH) {
    rows.push(matches.shift().item, primary);
  } else {
    rows.push(primary);
  }
  if (url) rows.push(searchItem(text));

  const room = max - rows.length;
  rows.push(...matches.slice(0, Math.max(0, room)).map((c) => c.item));
  rows.push(...ASSISTANTS.map((assistant) => chatItem(text, assistant)));
  return rows;
}
