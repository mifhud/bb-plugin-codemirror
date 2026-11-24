import {
  HighlightStyle,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags, type Tag } from "@lezer/highlight";
import type {
  PluginCodeThemeData,
  PluginCodeThemeState,
} from "@get-bb/plugin-sdk/app";

const SCOPE_TAGS: ReadonlyArray<readonly [string, readonly Tag[]]> = [
  ["comment", [tags.comment]],
  ["string.regexp", [tags.regexp]],
  ["string.escape", [tags.escape]],
  ["string.quoted", [tags.string]],
  ["string", [tags.string]],
  ["constant.numeric", [tags.number]],
  ["constant.language.boolean", [tags.bool]],
  ["constant.language.null", [tags.null]],
  ["constant.language", [tags.atom]],
  ["constant.character.escape", [tags.escape]],
  ["constant.character", [tags.character]],
  ["constant", [tags.atom]],
  ["variable.parameter", [tags.local(tags.variableName)]],
  ["variable.other.property", [tags.propertyName]],
  ["variable.other", [tags.variableName]],
  ["variable.function", [tags.function(tags.variableName)]],
  ["variable", [tags.variableName]],
  ["entity.name.function", [tags.function(tags.variableName)]],
  ["entity.name.type", [tags.typeName]],
  ["entity.name.class", [tags.className]],
  ["entity.name.struct", [tags.typeName]],
  ["entity.name.namespace", [tags.namespace]],
  ["entity.name.tag", [tags.tagName]],
  ["entity.name", [tags.name]],
  ["entity.other.attribute-name", [tags.attributeName]],
  ["entity.other.inherited-class", [tags.typeName]],
  ["entity", [tags.name]],
  ["support.function", [tags.standard(tags.function(tags.variableName))]],
  ["support.class", [tags.standard(tags.typeName)]],
  ["support.type", [tags.standard(tags.typeName)]],
  ["support.constant", [tags.standard(tags.atom)]],
  ["support.variable", [tags.standard(tags.variableName)]],
  ["support", [tags.standard(tags.name)]],
  ["keyword.operator", [tags.operator]],
  ["keyword.control", [tags.controlKeyword]],
  ["keyword.other.unit", [tags.unit]],
  ["keyword", [tags.keyword]],
  ["storage.type", [tags.typeName]],
  ["storage.modifier", [tags.modifier]],
  ["storage", [tags.modifier]],
  ["meta.brace", [tags.brace]],
  ["meta.object-literal.key", [tags.propertyName]],
  ["meta.function-call", [tags.function(tags.variableName)]],
  ["meta.preprocessor", [tags.processingInstruction]],
  ["meta.tag", [tags.tagName]],
  ["meta", [tags.meta]],
  ["punctuation.definition.comment", [tags.comment]],
  ["punctuation.definition.string", [tags.string]],
  ["punctuation.section", [tags.bracket]],
  ["punctuation.separator", [tags.separator]],
  ["punctuation.accessor", [tags.punctuation]],
  ["punctuation", [tags.punctuation]],
  ["markup.heading", [tags.heading]],
  ["markup.bold", [tags.strong]],
  ["markup.italic", [tags.emphasis]],
  ["markup.underline.link", [tags.link]],
  ["markup.underline", [tags.link]],
  ["markup.inline.raw", [tags.monospace]],
  ["markup.raw", [tags.monospace]],
  ["markup.inserted", [tags.inserted]],
  ["markup.deleted", [tags.deleted]],
  ["markup.changed", [tags.changed]],
  ["markup.quote", [tags.quote]],
  ["markup.list", [tags.list]],
  ["invalid", [tags.invalid]],
];

const SCOPE_TAGS_BY_LENGTH = [...SCOPE_TAGS].sort(
  (left, right) => right[0].length - left[0].length,
);

const HEX_COLOR = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export interface TokenStyle {
  color?: string;
  background?: string;
  fontStyle?: string;
}

function cssColor(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const match = HEX_COLOR.exec(value.trim());
  if (match === null) return undefined;
  const digits = match[1];
  const expanded =
    digits.length <= 4
      ? [...digits].map((digit) => digit + digit).join("")
      : digits;
  return `#${expanded.toLowerCase()}`;
}

function fontStyleOf(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const styles = value
    .split(/\s+/)
    .filter(
      (style) =>
        style === "italic" || style === "bold" || style === "underline",
    );
  return styles.length === 0 ? undefined : styles.join(" ");
}

function tokenStyleFor(settings: {
  foreground?: string;
  background?: string;
  fontStyle?: string;
}): TokenStyle | null {
  const color = cssColor(settings.foreground);
  const background = cssColor(settings.background);
  const fontStyle = fontStyleOf(settings.fontStyle);
  if (color === undefined && background === undefined && fontStyle === undefined)
    return null;
  return {
    ...(color === undefined ? {} : { color }),
    ...(background === undefined ? {} : { background }),
    ...(fontStyle === undefined ? {} : { fontStyle }),
  };
}

function selectorTags(
  selector: string,
): { tags: readonly Tag[]; specificity: number } | null {
  const token = selector.trim().split(/\s+/).at(-1) ?? "";
  if (token === "" || token.startsWith("-")) return null;
  for (const [prefix, tags] of SCOPE_TAGS_BY_LENGTH) {
    if (token === prefix || token.startsWith(`${prefix}.`)) {
      return { tags, specificity: token.length };
    }
  }
  return null;
}

export function tokenStylesFor(
  theme: PluginCodeThemeData,
): ReadonlyMap<Tag, TokenStyle> {
  const best = new Map<Tag, { style: TokenStyle; specificity: number }>();
  for (const rule of theme.tokenColors) {
    const style = tokenStyleFor(rule.settings);
    if (style === null || rule.scope === undefined) continue;
    const scopes =
      typeof rule.scope === "string" ? rule.scope.split(",") : rule.scope;
    for (const scope of scopes) {
      const resolved = selectorTags(scope);
      if (resolved === null) continue;
      for (const tag of resolved.tags) {
        const current = best.get(tag);
        if (
          current === undefined ||
          resolved.specificity >= current.specificity
        ) {
          best.set(tag, { style, specificity: resolved.specificity });
        }
      }
    }
  }
  return new Map(
    [...best.entries()].map(([tag, { style }]) => [tag, style] as const),
  );
}

export function highlightStyleFor(theme: PluginCodeThemeData): HighlightStyle {
  return HighlightStyle.define(
    [...tokenStylesFor(theme).entries()].map(([tag, style]) => ({
      tag,
      ...(style.color === undefined ? {} : { color: style.color }),
      ...(style.background === undefined
        ? {}
        : { backgroundColor: style.background }),
      ...(style.fontStyle === undefined ? {} : { fontStyle: style.fontStyle }),
    })),
  );
}

function viewThemeSpec(
  theme: PluginCodeThemeData | null,
): Record<string, Record<string, string>> {
  const colors = theme?.colors ?? {};
  const background =
    colors["editor.background"] ?? cssColor(theme?.bg) ?? "var(--canvas)";
  const foreground =
    colors["editor.foreground"] ?? cssColor(theme?.fg) ?? "var(--ink)";
  const cursor = colors["editorCursor.foreground"] ?? foreground;
  const selection =
    colors["editor.selectionBackground"] ??
    "color-mix(in oklab, var(--ink) 20%, transparent)";
  const inactiveSelection =
    colors["editor.inactiveSelectionBackground"] ?? selection;
  const lineHighlight =
    colors["editor.lineHighlightBackground"] ??
    "color-mix(in oklab, var(--ink) 6%, transparent)";
  const gutterForeground =
    colors["editorLineNumber.foreground"] ?? "var(--muted-foreground)";
  const gutterActiveForeground =
    colors["editorLineNumber.activeForeground"] ?? foreground;
  const gutterBackground = colors["editorGutter.background"] ?? background;
  const widgetBackground = colors["editorWidget.background"] ?? background;
  const border =
    colors["editorWidget.border"] ??
    colors["panel.border"] ??
    "var(--border)";
  const match =
    colors["editor.selectionHighlightBackground"] ??
    "color-mix(in oklab, var(--ink) 12%, transparent)";
  const matchBorder = colors["editor.selectionHighlightBorder"] ?? border;
  const fontFamily =
    "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)";

  return {
    "&": {
      backgroundColor: background,
      color: foreground,
      height: "100%",
      fontSize: "12px",
    },
    ".cm-scroller": {
      fontFamily,
      lineHeight: "20px",
      overflow: "auto",
    },
    ".cm-content": {
      caretColor: cursor,
      fontFamily,
      padding: "6px 0",
    },
    ".cm-line": {
      padding: "0 8px 0 6px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: cursor,
      borderLeftWidth: "2px",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection":
      {
        backgroundColor: selection,
      },
    ".cm-content:not(.cm-focused) .cm-selectionBackground": {
      backgroundColor: inactiveSelection,
    },
    ".cm-gutters": {
      backgroundColor: gutterBackground,
      color: gutterForeground,
      border: "none",
      borderRight: `1px solid ${border}`,
    },
    ".cm-gutterElement": {
      padding: "0 8px 0 12px",
    },
    ".cm-activeLine": {
      backgroundColor: lineHighlight,
    },
    ".cm-activeLineGutter": {
      backgroundColor: lineHighlight,
      color: gutterActiveForeground,
    },
    ".cm-selectionMatch": {
      backgroundColor: match,
      outline: `1px solid ${matchBorder}`,
    },
    ".cm-searchMatch": {
      backgroundColor: match,
      outline: `1px solid ${matchBorder}`,
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: selection,
    },
    ".cm-matchingBracket, .cm-nonmatchingBracket": {
      backgroundColor: match,
      outline: `1px solid ${matchBorder}`,
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: `1px solid ${border}`,
      color: gutterForeground,
    },
    ".cm-tooltip": {
      backgroundColor: widgetBackground,
      border: `1px solid ${border}`,
      color: foreground,
    },
    ".cm-panels": {
      backgroundColor: widgetBackground,
      color: foreground,
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: `1px solid ${border}`,
    },
    ".cm-panels.cm-panels-bottom": {
      borderTop: `1px solid ${border}`,
    },
    ".cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label":
      {
        color: foreground,
        fontSize: "12px",
      },
    ".cm-panel.cm-search input": {
      backgroundColor: background,
      border: `1px solid ${border}`,
      borderRadius: "4px",
      padding: "1px 4px",
      color: foreground,
    },
    ".cm-panel.cm-search button": {
      backgroundColor: "transparent",
      border: `1px solid ${border}`,
      borderRadius: "4px",
      padding: "0 6px",
      cursor: "pointer",
    },
    ".cm-panel.cm-search button:hover": {
      backgroundColor: lineHighlight,
    },
  };
}

export function codeThemeExtensions(state: PluginCodeThemeState): Extension[] {
  const theme = state.theme;
  return [
    EditorView.theme(viewThemeSpec(theme), { dark: state.mode === "dark" }),
    theme === null
      ? syntaxHighlighting(defaultHighlightStyle, { fallback: true })
      : syntaxHighlighting(highlightStyleFor(theme), { fallback: false }),
  ];
}
