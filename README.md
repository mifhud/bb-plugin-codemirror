# bb-plugin-codemirror

A BB plugin that opens files with a [CodeMirror 6](https://codemirror.net/) editor — the same job `bb-plugin-monaco-editor` does with Monaco, at a tenth of the payload.

> [!NOTE]
> The plugin registers a `fileOpener` for common code, config, and script extensions. When several openers claim the same extension, the first in slot order wins, and an installed plugin wins over a bundled one — so this editor becomes the default replacement for BB's bundled Monaco editor. Change that per extension in **Settings → File openers**, or right-click a file link for a one-off **Open with…**.

## What you get

- **Edit and save.** The toolbar save button, or <kbd>Cmd</kbd>+<kbd>S</kbd> / <kbd>Ctrl</kbd>+<kbd>S</kbd>, writes the file. Edits stay in the buffer until you save.
- **Conflict handling.** The buffer carries the SHA-256 it was loaded from. If the file changed on disk (usually because the agent edited it), the save stops and offers **Keep disk version** or **Save my edits**. After keeping the disk version, **Undo** restores the discarded draft and re-arms the conflict decision.
- **Find in file** with <kbd>Cmd</kbd>+<kbd>F</kbd>, plus folding, bracket matching, multiple selections, rectangular selection, and indent-on-input.
- **Syntax highlighting** for the extensions in the table below: 14 `@codemirror/lang-*` packages plus `@codemirror/legacy-modes` stream parsers (Go, Ruby, Lua, Swift, Kotlin, C#, Dart, TOML, properties, and more).
- **BB's code theme.** The editor translates the active VS Code-shaped theme document from `experimental_useCodeTheme()` into a CodeMirror `HighlightStyle` plus a view theme, so palettes, light/dark switches, cursor, selection, gutter, and search-panel colors follow BB.
- **Line targeting.** `bb thread open <file> --line <n>` selects and centers the requested line range.
- **Delegation.** Files that are not UTF-8 text, or larger than 8 MB, render BB's own preview instead.

## Install

```bash
bb plugin install /home/miftahulhuda/01-projects/me/bb-plugin-codemirror
```

Development loop:

```bash
bb plugin dev .        # rebuild app.js unminified and reload on save
npm run typecheck
npm test
bb plugin build        # minified bundles for install and release
```

## File types it claims

| Group | Extensions |
| --- | --- |
| Scripts | `js` `jsx` `mjs` `cjs` `ts` `tsx` `mts` `cts` `py` `pyi` `rb` `php` `pl` `lua` `r` `sh` `bash` `zsh` `fish` `ps1` `env` |
| Web | `css` `scss` `sass` `less` `vue` `svelte` `mdx` |
| Data and config | `json` `jsonc` `yaml` `yml` `toml` `ini` `properties` `cfg` `conf` `xml` `sql` `proto` |
| Compiled | `c` `h` `cc` `cpp` `cxx` `hpp` `hh` `rs` `go` `swift` `m` `mm` `java` `kt` `kts` `scala` `groovy` `cs` `fs` |
| Other | `dart` `erl` `clj` `hs` `jl` `dockerfile` `diff` `patch` |
| Plain text (no grammar) | `csv` `tsv` `txt` `text` `rst` `adoc` `log` `zig` `ex` `exs` `tf` `tfvars` `hcl` `graphql` `gql` `bat` `cmd` |

BB renders `md`, `markdown`, `html`, and `htm` with its own Preview/Raw toggle, so this plugin leaves them alone; **Open with…** still opens them here.

## How it works

```tree
bb-plugin-codemirror/
├── app.tsx                      # registers the fileOpener slot
├── server.ts                    # rpc read/write, path resolution, CAS hashes
├── components/
│   ├── FileEditor.tsx           # editor host, save state machine, notices
│   ├── EditorToolbar.tsx        # path, reload, save indicator, save button
│   └── Notice.tsx               # conflict and discard rows
├── lib/
│   ├── editor.ts                # CodeMirror extension set, line reveal
│   ├── languages.ts             # extension -> language or stream mode
│   ├── theme.ts                 # BB code theme -> CodeMirror theme
│   └── utils.ts                 # cn()
└── vitest.config.ts             # alias + jsdom Range shim for CodeMirror
```

- `server.ts` resolves the file's source (`workspace`, `host`, or `thread-storage`) into an absolute path and host, reads through `bb.sdk.files`, and writes with `expectedSha256` so a stale buffer cannot overwrite newer content. Only the plugin's own RPC contract crosses that boundary; the frontend never sees raw paths beyond the ones BB hands it.
- `app.tsx` registers one opener (`codemirror`) and nothing else — no CLI command, no sidebar page, no agent tool.
- The frontend bundle is a single file (no code splitting), so every language package ships up front: `dist/app.js` is ~1.2 MB minified. Monaco needed a separate lazy bundle for the same reason at 4.6 MB; CodeMirror needs no worker, so it stays inline.

## Limits

- **No language server.** No go-to-definition, no find-references, no type checking.
- **No file tree.** The opener owns only the editor surface; browse with BB's own file search and open files from there.
- **No command palette actions** (fold level, sort lines, copy path) — the toolbar copies the file path instead.
- **No tabs beyond BB's.** Opening another file reuses the tab, so a dirty buffer is replaced without a prompt when BB itself swaps the file; the dirty prompt only guards the in-editor reload button.
- **Line endings and BOM** are written back as the buffer holds them.

## Verification

- 39 tests: language mapping and theme translation (`lib/*.test.ts`), the RPC contract against the plugin testing harness (`server.test.ts`), and the editor's user flows in the plugin frontend runtime (`components/FileEditor.test.tsx`: mount, keyboard save, save-with-loaded-hash, conflict choices, reload, dirty prompt, delegation).
- Live check against a running BB: `read` → `write` → stale `write` (conflict with the on-disk hash) through `/api/v1/plugins/codemirror/rpc/...`, and the file tab rendering CodeMirror with the real file content.
