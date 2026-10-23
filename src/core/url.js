const EXPLICIT_SCHEME = /^(https?|file|ftp|chrome|chrome-extension|dia|about|view-source):/i;
const LOCAL_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([/?#].*)?$/i;
const DOMAIN = /^([a-z0-9-]+\.)+[a-z]{2,24}(:\d+)?([/?#].*)?$/i;

// Returns a navigable URL when the input looks like one, otherwise null.
export function toUrl(input) {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;

  try {
    if (EXPLICIT_SCHEME.test(text)) return new URL(text).href;
    if (LOCAL_HOST.test(text)) return new URL(`http://${text}`).href;
    if (DOMAIN.test(text)) return new URL(`https://${text}`).href;
  } catch {
    return null;
  }
  return null;
}

// Key used to treat "https://www.x.com/a/" and "http://x.com/a#top" as the same page.
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, '');
    const path = u.pathname.replace(/\/$/, '');
    return `${host}${path}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function displayUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const path = u.pathname === '/' ? '' : u.pathname;
      return `${u.host.replace(/^www\./, '')}${path}`;
    }
    return url;
  } catch {
    return url;
  }
}
