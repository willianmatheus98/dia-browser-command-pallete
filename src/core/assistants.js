const encode = encodeURIComponent;

// Chat assistants offered as "Ask …" rows. `url` builds a link that opens a new
// chat with the prompt filled in; Dia has none, so it is handled in actions.js.
export const ASSISTANTS = [
  { id: 'dia', name: 'Dia' },
  { id: 'claude', name: 'Claude', home: 'https://claude.ai/new', url: (q) => `https://claude.ai/new?q=${encode(q)}` },
  { id: 'chatgpt', name: 'ChatGPT', home: 'https://chatgpt.com/', url: (q) => `https://chatgpt.com/?q=${encode(q)}` },
  // Gemini ignores ?q= itself; src/content/gemini-prefill.js types it into the prompt box.
  {
    id: 'gemini',
    name: 'Gemini',
    home: 'https://gemini.google.com/app',
    url: (q) => `https://gemini.google.com/app?q=${encode(q)}`,
  },
];

export function getAssistant(id) {
  return ASSISTANTS.find((a) => a.id === id) ?? ASSISTANTS[0];
}
