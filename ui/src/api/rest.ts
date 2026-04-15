export async function apiParse(src: string) {
  const r = await fetch("/api/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ src }),
  });
  return r.json();
}

export async function apiValidateRange(game: string, text: string) {
  const r = await fetch("/api/validate-range", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ game, text }),
  });
  return r.json();
}

export async function apiGames(): Promise<string[]> {
  const r = await fetch("/api/games");
  const j = await r.json();
  return j.games ?? [];
}
