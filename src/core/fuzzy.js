const WORD_BOUNDARY = /[\s\-_./:|·—]/;

// Scores how well `query` matches `text`, from 0 (no match) to 1 (prefix match).
export function fuzzyScore(query, text) {
  const q = query.trim().toLowerCase();
  if (!q || !text) return 0;
  const t = text.toLowerCase();

  const idx = t.indexOf(q);
  if (idx === 0) return 1;
  if (idx > 0) return WORD_BOUNDARY.test(t[idx - 1]) ? 0.9 : 0.75;

  const tokens = q.split(/\s+/);
  if (tokens.length > 1 && tokens.every((token) => t.includes(token))) return 0.65;

  // Characters in order, penalised by how spread out they are.
  let from = 0;
  let last = -1;
  let gaps = 0;
  for (const ch of q.replace(/\s+/g, '')) {
    const found = t.indexOf(ch, from);
    if (found === -1) return 0;
    if (last !== -1) gaps += found - last - 1;
    last = found;
    from = found + 1;
  }
  return Math.max(0.1, 0.5 - gaps / (t.length * 2));
}
