import { describe, expect, it } from "vitest";
import {
  CLAIMED_EXTENSIONS,
  PLAIN_EXTENSIONS,
  extensionForPath,
  languageSupportFor,
} from "./languages";

describe("extensionForPath", () => {
  it("lowercases the extension", () => {
    expect(extensionForPath("src/App.TSX")).toBe("tsx");
  });

  it("returns null for dotfiles, extensionless names, and trailing dots", () => {
    expect(extensionForPath(".gitignore")).toBeNull();
    expect(extensionForPath("Makefile")).toBeNull();
    expect(extensionForPath("src/notes.")).toBeNull();
  });
});

describe("CLAIMED_EXTENSIONS", () => {
  it("leaves bb's rendered preview formats to bb", () => {
    for (const extension of ["md", "markdown", "html", "htm"]) {
      expect(CLAIMED_EXTENSIONS).not.toContain(extension);
    }
  });

  it("claims the common code, config, and script formats", () => {
    for (const extension of [
      "ts",
      "tsx",
      "js",
      "json",
      "yaml",
      "toml",
      "go",
      "rs",
      "py",
      "sql",
      "sh",
      "ini",
      "env",
      "proto",
      "dockerfile",
    ]) {
      expect(CLAIMED_EXTENSIONS).toContain(extension);
    }
  });

  it("lists each extension once", () => {
    expect(new Set(CLAIMED_EXTENSIONS).size).toBe(CLAIMED_EXTENSIONS.length);
  });
});

describe("languageSupportFor", () => {
  it("gives every claimed extension a grammar or an explicit plain-text entry", () => {
    const unhandled = CLAIMED_EXTENSIONS.filter(
      (extension) =>
        languageSupportFor(`file.${extension}`) === null &&
        !PLAIN_EXTENSIONS.includes(extension),
    );
    expect(unhandled).toEqual([]);
  });

  it("returns null for unknown extensions and paths without one", () => {
    expect(languageSupportFor("file.unknownext")).toBeNull();
    expect(languageSupportFor("LICENSE")).toBeNull();
  });

  it("reuses one language instance per extension", () => {
    expect(languageSupportFor("src/a.ts")).toBe(
      languageSupportFor("src/b.ts"),
    );
  });
});
