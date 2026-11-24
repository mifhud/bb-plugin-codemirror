---
title: CodeMirror Editor
status: done
owner: agent
updated: 2026-11-24
tags: [bb, plugin, editor]
---

# CodeMirror Editor

Open and edit text files in BB with a CodeMirror 6 editor instead of Monaco: smaller bundle, same BB theme, same conflict-safe save.

## What you get

- Save the buffer with the toolbar button or <kbd>Cmd</kbd>+<kbd>S</kbd> / <kbd>Ctrl</kbd>+<kbd>S</kbd>.
- If the file changed on disk since you loaded it, the save stops and asks: **Keep disk version** or **Save my edits**. **Undo** brings your draft back.
- Find with <kbd>Cmd</kbd>+<kbd>F</kbd>, folding, bracket matching, multiple cursors, rectangular selection.
- Syntax highlighting for common code, config, and script extensions.
- Colors follow your BB code theme, including light and dark modes and custom palettes.
- Files that are not UTF-8 text, or larger than 8 MB, open in BB's own preview.

## How it works

The plugin claims common code, configuration, and script extensions as a file opener. BB renders Markdown and HTML with its own Preview/Raw toggle, so those stay with BB unless you pick this editor through **Open with…**.

Change the opener per extension in **Settings → File openers**. There is no language server, so go-to-definition, find-references, and type checking are not available.
