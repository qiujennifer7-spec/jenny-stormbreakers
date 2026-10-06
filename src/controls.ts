/** Prefer physical codes; virtual keyboards and some browsers omit them. */
export function keyboardCode(e: Pick<KeyboardEvent, "code" | "key">): string {
  if (e.code && e.code !== "Unidentified") return e.code;
  if (/^[wasdqerf]$/i.test(e.key)) return `Key${e.key.toUpperCase()}`;
  if (e.key === " ") return "Space";
  return e.key;
}
