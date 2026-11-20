# mt-md playground

A set of test documents (`docs/`) and a small server for them, so the same files can be opened over **`file://`** and over **`http://`** and compared.

```
npm run playground          # serve docs/ at http://127.0.0.1:8794/   (--charset sends utf-8; --host 0.0.0.0 for other names)
npm run playground:live     # rewrite docs/live/clock.md every 2 s (watch auto-reload)
```

Load the unpacked extension from `build/chrome-store` (see the package README), turn on "Allow access to file URLs", then open:

- file: `file://<repo>/packages/mt-md/playground/docs/README.md`
- http: `http://127.0.0.1:8794/README.md`

## What should differ between the two

| | `file://` | `http://127.0.0.1` |
|---|---|---|
| Edit (pencil) tool | enabled (pin it in Settings; the gear on its row picks the editor) | greyed out; hover for why: there is no file to edit |
| Files panel | the browser's folder listing, read by the extension's background script | the server's index page |
| Auto-reload | polls the file through the background script | polls the URL |
| Export (bundle) | images can't be read by the page, so it asks you to choose the folder once | images are fetched directly |
| Themed (`themed/themed.md`) | green headings from `mt-md-theme.css` | normal colours |
| Other sites (not 127.0.0.1) | n/a | `--host 0.0.0.0` and open it by the machine's name: raw until you press **Allow this site** |

## Checklist

1. **README.md** renders with a status badge; every link works.
2. **01 to 08**: each renders as described in its own text.
3. **Files panel**: lists `docs/` folders first; `.hidden.md` and `notes.txt` are absent; open `guides` then `advanced`, click `tuning.md`, and the tree stays open; **Back** returns to the previous document; **Up** goes to the parent folder; hover the path line for the full path.
4. **Theme circle**: cycle dark, light, system; the circle turns so the active segment meets the dot.
5. **Settings** (gear): every tool listed; tick boxes change the toolbar; on `file://` the Edit row has a gear that reveals the editor list.
6. **Auto-reload**: run `npm run playground:live`, open `live/clock.md`: it updates by itself; pause it with the circular-arrows tool.
8. **Keyboard**: `render/keyboard.md` lists every key; try them, then the arrows in the Files panel.
7. **Odd names**: `odd names/ünïcode & spaces.md` opens, lists and edits.
