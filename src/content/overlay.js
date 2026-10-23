// Mounts the palette page in a full-viewport iframe over the current site.
// The iframe keeps the UI isolated from page CSS and gives it full extension API access.
(() => {
  // A copy orphaned by an extension reload loses chrome.runtime, so a fresh one may take over.
  if (window.__diaPalette?.alive()) return;
  window.__diaPalette = { alive: () => Boolean(chrome.runtime?.id) };

  let frame = null;
  let previousFocus = null;

  // Keep in sync with isPaletteShortcut in src/palette/palette.js.
  function isPaletteShortcut(event) {
    return event.metaKey && event.shiftKey && (event.code === 'Slash' || event.key === '?');
  }

  function open(src) {
    previousFocus = document.activeElement;
    frame = document.createElement('iframe');
    frame.src = src;
    frame.allow = 'clipboard-write';
    frame.setAttribute('aria-label', 'Command palette');
    Object.assign(frame.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      margin: '0',
      padding: '0',
      border: '0',
      display: 'block',
      background: 'transparent',
      // Must match the palette's color scheme, or Chrome paints the iframe opaque.
      colorScheme: 'normal',
      zIndex: '2147483647',
    });
    frame.addEventListener('load', () => frame?.focus());
    // Appended to <html> rather than <body> so a transformed body can't break position: fixed.
    document.documentElement.appendChild(frame);
  }

  function close() {
    if (!frame) return;
    frame.remove();
    frame = null;
    previousFocus?.focus?.({ preventScroll: true });
    previousFocus = null;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'dia-palette:toggle') return;
    if (frame) close();
    else open(message.src);
    sendResponse({ ok: true });
  });

  // ⌘? can't be a chrome.commands shortcut ("/" isn't an allowed key), so the page catches it.
  // Capture phase so sites with their own ⌘? handlers don't see it first. The overlay is built
  // right here, inside the key event, so the page still has user activation when focus moves
  // into the iframe; the palette looks up its own tab.
  window.addEventListener(
    'keydown',
    (event) => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (frame) close();
      else open(chrome.runtime.getURL('src/palette/palette.html?mode=overlay'));
    },
    true,
  );

  window.addEventListener('message', (event) => {
    if (frame && event.source === frame.contentWindow && event.data?.type === 'dia-palette:close') close();
  });
})();
