function rectListIsMissing(): boolean {
  try {
    return document.createRange().getClientRects() === undefined;
  } catch {
    return true;
  }
}

if (typeof Range !== "undefined" && rectListIsMissing()) {
  Object.defineProperty(Range.prototype, "getClientRects", {
    value: () => [] as unknown as DOMRectList,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    value: () => ({}) as DOMRect,
    configurable: true,
    writable: true,
  });
}
