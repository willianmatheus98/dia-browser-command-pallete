// Mounts the palette page in a full-viewport iframe over the current site.
// The iframe keeps the UI isolated from page CSS and gives it full extension API access.
(() => {
  if (window.__diaPaletteLoaded) return;
  window.__diaPaletteLoaded = true;

  let frame = null;
  let previousFocus = null;

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

  window.addEventListener('message', (event) => {
    if (frame && event.source === frame.contentWindow && event.data?.type === 'dia-palette:close') close();
  });
})();
