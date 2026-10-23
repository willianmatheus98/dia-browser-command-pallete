// Gemini has no prefill URL, so the palette opens /app?q=… and this script types
// the prompt into Gemini's editor and sends it.
(() => {
  const url = new URL(location.href);
  const prompt = url.searchParams.get('q');
  if (!prompt) return;

  // Drop ?q= right away so a reload doesn't send the prompt twice.
  url.searchParams.delete('q');
  history.replaceState(history.state, '', url);

  const EDITOR = 'rich-textarea .ql-editor[contenteditable="true"], div[contenteditable="true"][role="textbox"]';
  const SEND = 'button[aria-label*="Send" i]:not([disabled]):not([aria-disabled="true"])';
  const TIMEOUT_MS = 15000;

  function waitFor(selector, timeout) {
    return new Promise((resolve) => {
      const found = document.querySelector(selector);
      if (found) return resolve(found);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (!el) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      });
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    });
  }

  async function prefill() {
    // Not signed in, or Gemini changed its markup: leave the page as it is.
    const editor = await waitFor(EDITOR, TIMEOUT_MS);
    if (!editor) return;

    editor.focus();
    // insertText goes through the editor's own input handling, unlike setting textContent.
    document.execCommand('insertText', false, prompt);

    const send = await waitFor(SEND, 2000);
    send?.click();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prefill, { once: true });
  } else {
    prefill();
  }
})();
