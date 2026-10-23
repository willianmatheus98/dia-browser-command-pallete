import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fuzzyScore } from '../src/core/fuzzy.js';
import { buildResults } from '../src/core/ranker.js';
import { normalizeUrl, toUrl } from '../src/core/url.js';

const now = Date.UTC(2026, 9, 23);

test('toUrl detects URLs and leaves search text alone', () => {
  assert.equal(toUrl('github.com'), 'https://github.com/');
  assert.equal(toUrl('localhost:3000/api'), 'http://localhost:3000/api');
  assert.equal(toUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(toUrl('192.168.0.1'), 'http://192.168.0.1/');
  assert.equal(toUrl('how to cook rice'), null);
  assert.equal(toUrl('rice'), null);
});

test('normalizeUrl ignores www, scheme, trailing slash and hash', () => {
  assert.equal(normalizeUrl('https://www.x.com/a/#top'), normalizeUrl('http://x.com/a'));
});

test('fuzzyScore ranks prefix > word start > substring > subsequence', () => {
  const prefix = fuzzyScore('you', 'YouTube');
  const word = fuzzyScore('tube', 'My Tube');
  const inner = fuzzyScore('tube', 'YouTube');
  const subseq = fuzzyScore('ytb', 'YouTube');
  assert.ok(prefix > word && word > inner && inner > subseq && subseq > 0);
  assert.equal(fuzzyScore('xyz', 'YouTube'), 0);
});

test('empty query lists recent tabs, recent searches and new chat', () => {
  const rows = buildResults({
    tabs: [
      { id: 1, windowId: 1, title: 'Old', url: 'https://old.com', lastAccessed: now - 1000 },
      { id: 2, windowId: 1, title: 'New', url: 'https://new.com', lastAccessed: now },
    ],
    recentSearches: [{ query: 'weather', at: now }],
    now,
  });
  assert.deepEqual(rows.map((r) => r.kind), ['tab', 'tab', 'recent', 'chat']);
  assert.equal(rows[0].title, 'New');
});

test('strong match takes slot 1 and search stays fixed in slot 2', () => {
  const rows = buildResults({
    query: 'youtube',
    tabs: [{ id: 5, windowId: 1, title: '(9) YouTube', url: 'https://youtube.com', lastAccessed: now }],
    now,
  });
  assert.equal(rows[0].kind, 'tab');
  assert.equal(rows[1].kind, 'search');
  assert.equal(rows.at(-1).kind, 'chat');
});

test('search takes slot 1 when nothing matches strongly', () => {
  const rows = buildResults({
    query: 'ytb',
    tabs: [{ id: 5, windowId: 1, title: 'YouTube', url: 'https://youtube.com' }],
    now,
  });
  assert.equal(rows[0].kind, 'search');
  assert.equal(rows[1].kind, 'tab');
});

test('URL input offers open-url and a plain search', () => {
  const rows = buildResults({ query: 'github.com', now });
  assert.deepEqual(rows.map((r) => r.kind), ['url', 'search', 'chat']);
});

test('same page from several sources is shown once, preferring the open tab', () => {
  const rows = buildResults({
    query: 'docs',
    tabs: [{ id: 3, windowId: 1, title: 'Docs', url: 'https://docs.dev/' }],
    bookmarks: [{ title: 'Docs', url: 'https://www.docs.dev' }],
    history: [{ title: 'Docs', url: 'http://docs.dev/#intro', visitCount: 10 }],
    now,
  });
  const pages = rows.filter((r) => r.url);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].kind, 'tab');
});

test('recent search equal to the query is not duplicated', () => {
  const rows = buildResults({ query: 'weather', recentSearches: [{ query: 'weather', at: now }], now });
  assert.equal(rows.filter((r) => r.title === 'weather').length, 1);
});

test('results are capped', () => {
  const history = Array.from({ length: 50 }, (_, i) => ({ title: `Page ${i}`, url: `https://p${i}.com` }));
  const rows = buildResults({ query: 'page', history, now, max: 9 });
  assert.equal(rows.length, 9);
});
