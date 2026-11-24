import { css } from "@codemirror/lang-css";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sass } from "@codemirror/lang-sass";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import {
  StreamLanguage,
  type LanguageSupport,
  type StreamParser,
} from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import {
  csharp,
  dart,
  kotlin,
  objectiveC,
  scala,
} from "@codemirror/legacy-modes/mode/clike";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { go } from "@codemirror/legacy-modes/mode/go";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { haskell } from "@codemirror/legacy-modes/mode/haskell";
import { julia } from "@codemirror/legacy-modes/mode/julia";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { fSharp } from "@codemirror/legacy-modes/mode/mllike";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { protobuf } from "@codemirror/legacy-modes/mode/protobuf";
import { r } from "@codemirror/legacy-modes/mode/r";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { toml } from "@codemirror/legacy-modes/mode/toml";

const PREVIEW_RENDERED_EXTENSIONS = new Set(["md", "markdown", "html", "htm"]);

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, () => LanguageSupport>> = {
  js: () => javascript({ jsx: true }),
  jsx: () => javascript({ jsx: true }),
  mjs: () => javascript({ jsx: true }),
  cjs: () => javascript({ jsx: true }),
  ts: () => javascript({ typescript: true, jsx: true }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  mts: () => javascript({ typescript: true, jsx: true }),
  cts: () => javascript({ typescript: true, jsx: true }),

  html: () => html(),
  htm: () => html(),
  vue: () => html(),
  svelte: () => html(),
  xml: () => xml(),

  css: () => css(),
  scss: () => sass({ indented: false }),
  sass: () => sass({ indented: true }),
  less: () => css(),

  json: () => json(),
  jsonc: () => json(),
  yaml: () => yaml(),
  yml: () => yaml(),

  md: () => markdown(),
  mdx: () => markdown(),
  markdown: () => markdown(),

  c: () => cpp(),
  h: () => cpp(),
  cc: () => cpp(),
  cpp: () => cpp(),
  cxx: () => cpp(),
  hpp: () => cpp(),
  hh: () => cpp(),
  rs: () => rust(),

  java: () => java(),
  py: () => python(),
  pyi: () => python(),
  php: () => php(),
  sql: () => sql(),
};

const MODE_BY_EXTENSION: Readonly<Record<string, StreamParser<unknown>>> = {
  toml,
  ini: properties,
  properties,
  cfg: properties,
  conf: properties,
  env: shell,

  go,
  swift,
  m: objectiveC,
  mm: objectiveC,
  kt: kotlin,
  kts: kotlin,
  scala,
  groovy,
  cs: csharp,
  fs: fSharp,

  rb: ruby,
  pl: perl,
  lua,
  r,
  sh: shell,
  bash: shell,
  zsh: shell,
  fish: shell,
  ps1: powerShell,

  proto: protobuf,
  dockerfile: dockerFile,
  dart,
  erl: erlang,
  clj: clojure,
  hs: haskell,
  jl: julia,
  diff,
  patch: diff,
};

export const PLAIN_EXTENSIONS: readonly string[] = [
  "csv",
  "tsv",
  "txt",
  "text",
  "rst",
  "adoc",
  "log",
  "zig",
  "ex",
  "exs",
  "tf",
  "tfvars",
  "hcl",
  "graphql",
  "gql",
  "bat",
  "cmd",
];

export const CLAIMED_EXTENSIONS: readonly string[] = [
  ...Object.keys(LANGUAGE_BY_EXTENSION),
  ...Object.keys(MODE_BY_EXTENSION),
  ...PLAIN_EXTENSIONS,
].filter((extension) => !PREVIEW_RENDERED_EXTENSIONS.has(extension));

const cache = new Map<string, Extension | null>();

export function extensionForPath(path: string): string | null {
  const name = path.split("/").at(-1) ?? path;
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) return null;
  return name.slice(dotIndex + 1).toLowerCase();
}

export function languageSupportFor(path: string): Extension | null {
  const extension = extensionForPath(path);
  if (extension === null) return null;
  if (!cache.has(extension)) {
    const language = LANGUAGE_BY_EXTENSION[extension];
    const mode = MODE_BY_EXTENSION[extension];
    cache.set(
      extension,
      language !== undefined ? language() : mode ? StreamLanguage.define(mode) : null,
    );
  }
  return cache.get(extension) ?? null;
}
