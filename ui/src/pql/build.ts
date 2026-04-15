export function buildPql(game: string, board: string, ranges: string[]): string {
  const names = ranges.map((_, i) => `p${i + 1}`);
  const selects = names.map((n) => `avg(riverEquity(${n}))`).join(", ");
  const assignments = names.map((n, i) => `  ${n} = '${ranges[i] || "*"}'`);
  const boardVal = board || "*";
  return [
    `select ${selects}`,
    `from`,
    `  game = '${game}',`,
    ...assignments.map((a) => a + ","),
    `  board = '${boardVal}'`,
    ``,
  ].join("\n");
}
