import { StreamLanguage } from "@codemirror/language";

const KEYWORDS = new Set([
  "select", "from", "where", "and", "or", "not",
  "avg", "count", "sum", "min", "max", "if",
  "holdem", "omaha", "shortdeck",
  "flop", "turn", "river", "preflop",
  "true", "false",
]);

export const pqlLang = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/\/\/.*/)) return "comment";
    if (stream.match(/"[^"]*"/)) return "string";
    if (stream.match(/'[^']*'/)) return "string";
    if (stream.match(/-?\d+(\.\d+)?/)) return "number";
    if (stream.match(/[a-zA-Z_][a-zA-Z0-9_]*/)) {
      const w = stream.current().toLowerCase();
      if (KEYWORDS.has(w)) return "keyword";
      return "variableName";
    }
    stream.next();
    return null;
  },
});
