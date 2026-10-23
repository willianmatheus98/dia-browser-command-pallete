// Mounts the palette page in a full-viewport iframe over the current site.
// The iframe keeps the UI isolated from page CSS and gives it full extension API access.
(() => {
  // A copy orphaned by an extension reload loses chrome.runtime, so a fresh one may take over.
  if (window.__diaPalette?.alive()) return;
  window.__diaPalette = { alive: () => Boolean(chrome.runtime?.id) };

  const PALETTE_ORIGIN = new URL(chrome.runtime.getURL('')).origin;
  // Enough to win against sites that refocus their editor on blur, without fighting forever.
  const MAX_REFOCUS = 5;

  let frame = null;
  let previousFocus = null;
  let refocusCount = 0;

  // Keep in sync with isPaletteShortcut in src/palette/palette.js.
  function isPaletteShortcut(event) {
    return event.metaKey && event.shiftKey && (event.code === 'Slash' || event.key === '?');
  }

  // Moves focus into the iframe, then asks the palette to focus its input.
  function focusFrame() {
    if (!frame) return;
    frame.focus({ preventScroll: true });
    frame.contentWindow?.postMessage({ type: 'dia-palette:focus' }, PALETTE_ORIGIN);
  }

  function onFocusIn(event) {
    if (!frame || event.target === frame || refocusCount >= MAX_REFOCUS) return;
    refocusCount++;
    focusFrame();
  }

  // Editors often refocus themselves on blur. Hiding blur from the page while the palette
  // is open means they never notice focus left. Capture on window runs before element listeners.
  function hideBlur(event) {
    if (frame) event.stopImmediatePropagation();
  }

  const FOCUS_GUARDS = [
    ['focusin', onFocusIn],
    ['blur', hideBlur],
    ['focusout', hideBlur],
  ];

  function open(src) {
    previousFocus = document.activeElement;
    refocusCount = 0;
    frame = document.createElement('iframe');
    frame.src = src;
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
    frame.addEventListener('load', focusFrame);
    for (const [type, listener] of FOCUS_GUARDS) window.addEventListener(type, listener, true);
    // Appended to <html> rather than <body> so a transformed body can't break position: fixed.
    document.documentElement.appendChild(frame);
    focusFrame();
  }

  function close() {
    if (!frame) return;
    for (const [type, listener] of FOCUS_GUARDS) window.removeEventListener(type, listener, true);
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
