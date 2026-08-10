const GAME_ID = /([A-Z0-9]{4})[^A-Z0-9]*([0-9]{3})[^0-9]*([0-9]{2})/i;

/** Normalize all common OPL spellings to XXXX_###.##. */
export function normalizeGameId(value: string): string | null {
  const match = value.trim().match(GAME_ID);
  return match ? `${match[1].toUpperCase()}_${match[2]}.${match[3]}` : null;
}
export function requireGameId(value: string): string {
  const normalized = normalizeGameId(value);
  if (!normalized) throw new Error(`Invalid game ID: ${value}`);
  return normalized;
}
