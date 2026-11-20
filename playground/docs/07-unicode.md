# Unicode: café … “quotes”

The http server sends this file without a charset, so the browser guesses a legacy encoding; mt-md must re-read it as UTF-8.

- Accents: café, naïve, Zoë, Ångström
- Punctuation: “curly quotes”, ‘single’, en–dash, em—dash, ellipsis…
- Symbols: © ® ™ € £ ¥ → ← ↑ ↓ ✓ ✗
- CJK: 日本語, 中文, 한국어
- Emoji: 🙂 🚀 📄
