import { tags } from "@lezer/highlight";
import type { PluginCodeThemeData } from "@get-bb/plugin-sdk/app";
import { describe, expect, it } from "vitest";
import { codeThemeExtensions, highlightStyleFor, tokenStylesFor } from "./theme";

function themeWith(
  tokenColors: PluginCodeThemeData["tokenColors"],
): PluginCodeThemeData {
  return {
    name: "test-theme",
    type: "dark",
    fg: "#dddddd",
    bg: "#101010",
    colors: {
      "editor.background": "#101010",
      "editor.foreground": "#dddddd",
    },
    tokenColors,
  };
}

describe("tokenStylesFor", () => {
  it("lets the most specific scope win in either order", () => {
    const broad = { scope: "comment", settings: { foreground: "#aaaaaa" } };
    const specific = {
      scope: "comment.line.double-slash",
      settings: { foreground: "#bbbbbb" },
    };
    expect(tokenStylesFor(themeWith([broad, specific])).get(tags.comment)).toEqual(
      { color: "#bbbbbb" },
    );
    expect(tokenStylesFor(themeWith([specific, broad])).get(tags.comment)).toEqual(
      { color: "#bbbbbb" },
    );
  });

  it("maps every side of a comma-separated scope list", () => {
    const styles = tokenStylesFor(
      themeWith([{ scope: "keyword, storage", settings: { foreground: "#111111" } }]),
    );
    expect(styles.get(tags.keyword)).toEqual({ color: "#111111" });
    expect(styles.get(tags.modifier)).toEqual({ color: "#111111" });
  });

  it("resolves a parent-scoped rule through its last selector", () => {
    const styles = tokenStylesFor(
      themeWith([
        {
          scope: "meta.function-call entity.name.function",
          settings: { foreground: "#222222" },
        },
      ]),
    );
    expect(styles.get(tags.function(tags.variableName))).toEqual({
      color: "#222222",
    });
  });

  it("prefers a dotted child scope over its parent scope", () => {
    const styles = tokenStylesFor(
      themeWith([
        { scope: "string.regexp", settings: { foreground: "#333333" } },
        { scope: "string", settings: { foreground: "#444444" } },
      ]),
    );
    expect(styles.get(tags.string)).toEqual({ color: "#444444" });
    expect(styles.get(tags.regexp)).toEqual({ color: "#333333" });
  });

  it("skips exclusion scopes", () => {
    const styles = tokenStylesFor(
      themeWith([{ scope: "-string", settings: { foreground: "#555555" } }]),
    );
    expect(styles.size).toBe(0);
  });

  it("normalizes short hex colors and drops values that are not colors", () => {
    const styles = tokenStylesFor(
      themeWith([
        { scope: "comment", settings: { foreground: "#abc" } },
        { scope: "keyword", settings: { foreground: "rebeccapurple" } },
      ]),
    );
    expect(styles.get(tags.comment)).toEqual({ color: "#aabbcc" });
    expect(styles.has(tags.keyword)).toBe(false);
  });

  it("keeps alpha channels and backgrounds", () => {
    const styles = tokenStylesFor(
      themeWith([
        {
          scope: "string",
          settings: { foreground: "#ff000080", background: "#00FF0080" },
        },
      ]),
    );
    expect(styles.get(tags.string)).toEqual({
      color: "#ff000080",
      background: "#00ff0080",
    });
  });

  it("keeps a font style on its own", () => {
    const styles = tokenStylesFor(
      themeWith([
        { scope: "comment", settings: { fontStyle: "bold italic underline" } },
      ]),
    );
    expect(styles.get(tags.comment)).toEqual({
      fontStyle: "bold italic underline",
    });
  });

  it("ignores rules that style no tag", () => {
    const styles = tokenStylesFor(
      themeWith([{ settings: { foreground: "#ffffff" } }]),
    );
    expect(styles.size).toBe(0);
  });
});

describe("codeThemeExtensions", () => {
  it("returns a view theme and a highlighter while the theme file resolves", () => {
    expect(
      codeThemeExtensions({ mode: "light", name: "unresolved", theme: null }),
    ).toHaveLength(2);
  });

  it("returns a view theme and a highlighter for a resolved theme", () => {
    expect(
      codeThemeExtensions({
        mode: "dark",
        name: "test-theme",
        theme: themeWith([
          { scope: "comment", settings: { foreground: "#aaaaaa" } },
        ]),
      }),
    ).toHaveLength(2);
  });

  it("builds a highlighter that includes the mapped tags", () => {
    expect(
      highlightStyleFor(
        themeWith([{ scope: "comment", settings: { foreground: "#aaaaaa" } }]),
      ),
    ).toBeDefined();
  });
});
