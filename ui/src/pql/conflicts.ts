/**
 * Conflict detection for poker board + player ranges.
 *
 * A card can only exist once across the entire deck. If the board shows `Ah`,
 * no player's explicit combo can contain `Ah`. Board cards must also be unique
 * among themselves. This module provides pure helpers to detect such
 * impossible configurations so the UI can surface warnings before running a
 * simulation.
 */

/** A single conflict warning. `playerIndex === -1` indicates a board-internal conflict. */
export interface ConflictWarning {
  playerIndex: number;
  message: string;
}

const RANK_CHARS = "23456789TJQKA";
const SUIT_CHARS = "hdcs";
const CARD_RE = /^[2-9TJQKA][hdcs]$/;
const COMBO_RE = /^[2-9TJQKA][hdcs][2-9TJQKA][hdcs]$/i;

/** Normalize a 2-char card to canonical form: rank uppercase, suit lowercase. */
function normalizeCard(raw: string): string | null {
  if (raw.length !== 2) return null;
  const rank = raw[0].toUpperCase();
  const suit = raw[1].toLowerCase();
  if (!RANK_CHARS.includes(rank) || !SUIT_CHARS.includes(suit)) return null;
  const card = rank + suit;
  return CARD_RE.test(card) ? card : null;
}

/**
 * Parse a flat board string (e.g. "AhKhQh") into an array of canonical cards.
 * Whitespace is ignored; invalid 2-char segments are skipped (never throws).
 */
export function parseBoardCards(board: string): string[] {
  const cleaned = (board ?? "").replace(/\s+/g, "");
  const out: string[] = [];
  for (let i = 0; i + 1 < cleaned.length; i += 2) {
    const card = normalizeCard(cleaned.slice(i, i + 2));
    if (card) out.push(card);
  }
  return out;
}

/**
 * Extract only the *explicit fixed combos* (e.g. "AhKh") from a comma-separated
 * range expression. Non-specific atoms like "AA", "AKs", or "*" are ignored.
 * Returns an array of [card1, card2] tuples in canonical form.
 */
export function extractExplicitCombos(rangeText: string): string[][] {
  const text = (rangeText ?? "").trim();
  if (!text || text === "*") return [];
  const out: string[][] = [];
  for (const rawAtom of text.split(",")) {
    const atom = rawAtom.trim();
    if (atom.length !== 4 || !COMBO_RE.test(atom)) continue;
    const c1 = normalizeCard(atom.slice(0, 2));
    const c2 = normalizeCard(atom.slice(2, 4));
    if (c1 && c2) out.push([c1, c2]);
  }
  return out;
}

/**
 * Detect conflicts between a board and a list of player range strings.
 * Returns warnings sorted by playerIndex ascending (board-internal first).
 */
export function detectConflicts(board: string, ranges: string[]): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];
  const boardCards = parseBoardCards(board);

  // (a) Board-internal duplicates.
  const boardSeen = new Set<string>();
  const boardDupsReported = new Set<string>();
  for (const card of boardCards) {
    if (boardSeen.has(card) && !boardDupsReported.has(card)) {
      warnings.push({
        playerIndex: -1,
        message: `Board contains duplicate card ${card}`,
      });
      boardDupsReported.add(card);
    }
    boardSeen.add(card);
  }

  const boardSet = new Set(boardCards);

  for (let i = 0; i < ranges.length; i++) {
    const combos = extractExplicitCombos(ranges[i] ?? "");
    const reportedBoardHits = new Set<string>();
    for (const combo of combos) {
      const [a, b] = combo;
      // (c) Intra-combo duplicate card (e.g. "AhAh").
      if (a === b) {
        warnings.push({
          playerIndex: i,
          message: `Player ${i + 1} range has invalid combo ${a}${b} (duplicate card)`,
        });
        continue;
      }
      // (b) Combo card collides with board.
      for (const c of [a, b]) {
        if (boardSet.has(c) && !reportedBoardHits.has(c)) {
          warnings.push({
            playerIndex: i,
            message: `Player ${i + 1} range uses ${c} which is on the board`,
          });
          reportedBoardHits.add(c);
        }
      }
    }
  }

  // (d) Cross-player forced collision: each player's entire range is a single
  // explicit combo and they share a card.
  const singleCombo: (string[] | null)[] = ranges.map((r) => {
    const combos = extractExplicitCombos(r ?? "");
    return combos.length === 1 && combos[0][0] !== combos[0][1] ? combos[0] : null;
  });
  for (let i = 0; i < singleCombo.length; i++) {
    const ci = singleCombo[i];
    if (!ci) continue;
    for (let j = i + 1; j < singleCombo.length; j++) {
      const cj = singleCombo[j];
      if (!cj) continue;
      const shared = ci.find((c) => cj.includes(c));
      if (shared) {
        warnings.push({
          playerIndex: j,
          message: `Player ${j + 1} range shares card ${shared} with Player ${i + 1}`,
        });
      }
    }
  }

  warnings.sort((x, y) => x.playerIndex - y.playerIndex);
  return warnings;
}

// Optional dev-only self-tests. Gated behind a global flag so they never run
// in production bundles.
if (
  import.meta.env.DEV &&
  typeof globalThis !== "undefined" &&
  (globalThis as { __RUN_CONFLICT_TESTS__?: boolean }).__RUN_CONFLICT_TESTS__
) {
  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error("conflicts self-test failed: " + msg);
  };
  assert(
    JSON.stringify(parseBoardCards("AhKhQh")) === JSON.stringify(["Ah", "Kh", "Qh"]),
    "parseBoardCards basic",
  );
  assert(parseBoardCards("").length === 0, "parseBoardCards empty");
  assert(
    JSON.stringify(parseBoardCards("ah kH qH")) === JSON.stringify(["Ah", "Kh", "Qh"]),
    "parseBoardCards normalizes + strips ws",
  );
  assert(extractExplicitCombos("AA,KK,AKs").length === 0, "no explicit combos");
  assert(
    JSON.stringify(extractExplicitCombos("ahKH,AA")) === JSON.stringify([["Ah", "Kh"]]),
    "extracts explicit combo",
  );
  const w1 = detectConflicts("AhKhQh", ["AhKh", "AA"]);
  assert(w1.length === 2 && w1[0].playerIndex === 0, "board-range conflict");
  const w2 = detectConflicts("AhAhQh", []);
  assert(w2.length === 1 && w2[0].playerIndex === -1, "board dup");
  const w3 = detectConflicts("", ["AhAh"]);
  assert(w3.length === 1 && /duplicate card/.test(w3[0].message), "combo dup");
  const w4 = detectConflicts("", ["AhKh", "AhQd"]);
  assert(w4.some((w) => w.playerIndex === 1), "cross-player share");
  // eslint-disable-next-line no-console
  console.log("[conflicts] self-tests passed");
}
