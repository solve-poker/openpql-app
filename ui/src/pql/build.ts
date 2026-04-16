function ensureNoQuote(s: string, what: string): string {
  if (s.includes("'")) {
    throw new Error("illegal character in range/board");
  }
  return s;
}

export function buildPql(game: string, board: string, ranges: string[]): string {
  const names = ranges.map((_, i) => `p${i + 1}`);
  const selects = names.map((n) => `avg(riverEquity(${n})) as ${n}`).join(", ");
  const assignments = names.map((n, i) => {
    const r = ensureNoQuote((ranges[i] ?? "").trim(), `range ${i + 1}`) || "*";
    return `  ${n} = '${r}'`;
  });
  const boardVal = ensureNoQuote((board ?? "").trim(), "board") || "*";
  // game is a fixed enum from the UI; still sanitize to be safe.
  const gameVal = ensureNoQuote(game, "game");
  return [
    `select ${selects}`,
    `from`,
    `  game = '${gameVal}',`,
    ...assignments.map((a) => a + ","),
    `  board = '${boardVal}'`,
    ``,
  ].join("\n");
}
