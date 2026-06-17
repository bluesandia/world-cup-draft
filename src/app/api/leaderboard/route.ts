import { NextResponse } from "next/server";
import type { LeaderboardEntry, LeaderboardRosterPlayer } from "@/lib/gameTypes";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const tableName = "leaderboard_scores";
const maxNameLength = 9;
const maxSquadNameLength = 24;
const namePattern = /^[A-Z0-9]{1,9}$/;
const squadNamePattern = /^[A-Z0-9 ]{1,24}$/;

type SupabaseLeaderboardRow = {
  id: string;
  name: string;
  squad_name?: string | null;
  score: number;
  result: string;
  roster: LeaderboardRosterPlayer[];
  created_at: string;
};

type SubmitLeaderboardBody = {
  name?: unknown;
  squadName?: unknown;
  score?: unknown;
  result?: unknown;
  roster?: unknown;
};

function isConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function supabaseHeaders() {
  return {
    apikey: supabaseAnonKey ?? "",
    Authorization: `Bearer ${supabaseAnonKey ?? ""}`,
    "Content-Type": "application/json",
  };
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, maxNameLength);
}

function normalizeSquadName(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxSquadNameLength);
}

function isRoster(value: unknown): value is LeaderboardRosterPlayer[] {
  if (!Array.isArray(value) || value.length !== 11) {
    return false;
  }

  return value.every(
    (player) =>
      typeof player === "object" &&
      player !== null &&
      "slot" in player &&
      "playerId" in player &&
      "name" in player &&
      "country" in player &&
      "rating" in player &&
      typeof player.slot === "string" &&
      typeof player.playerId === "string" &&
      typeof player.name === "string" &&
      typeof player.country === "string" &&
      typeof player.rating === "number",
  );
}

function toLeaderboardEntry(row: SupabaseLeaderboardRow): LeaderboardEntry {
  return {
    id: row.id,
    name: row.name,
    squadName: row.squad_name || "WORLD XI",
    score: row.score,
    result: row.result,
    roster: row.roster,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ configured: false, scores: [] });
  }

  const requestUrl = new URL(request.url);
  const requestedLimit = Number(requestUrl.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500)
    : 10;
  const url = new URL(`${supabaseUrl}/rest/v1/${tableName}`);
  url.searchParams.set("select", "id,name,squad_name,score,result,roster,created_at");
  url.searchParams.set("order", "score.desc,created_at.asc");
  url.searchParams.set("limit", String(limit));

  let response = await fetch(url, {
    headers: supabaseHeaders(),
    next: { revalidate: 10 },
  });

  if (!response.ok) {
    url.searchParams.set("select", "id,name,score,result,roster,created_at");
    response = await fetch(url, {
      headers: supabaseHeaders(),
      next: { revalidate: 10 },
    });
  }

  if (!response.ok) {
    return NextResponse.json(
      { configured: true, error: "Unable to load leaderboard.", scores: [] },
      { status: 502 },
    );
  }

  const rows = (await response.json()) as SupabaseLeaderboardRow[];

  return NextResponse.json({
    configured: true,
    scores: rows.map(toLeaderboardEntry),
  });
}

export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Leaderboard is not configured yet." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as SubmitLeaderboardBody;
  const name = normalizeName(body.name);
  const squadName = normalizeSquadName(body.squadName);

  if (!namePattern.test(name)) {
    return NextResponse.json(
      { error: "Name must be 1 to 9 letters or numbers." },
      { status: 400 },
    );
  }

  if (!squadNamePattern.test(squadName)) {
    return NextResponse.json(
      { error: "Squad name must be 1 to 24 letters, numbers, or spaces." },
      { status: 400 },
    );
  }

  if (
    typeof body.score !== "number" ||
    !Number.isInteger(body.score) ||
    body.score < 0 ||
    body.score > 150 ||
    typeof body.result !== "string" ||
    body.result.length === 0 ||
    !isRoster(body.roster)
  ) {
    return NextResponse.json({ error: "Invalid leaderboard score." }, { status: 400 });
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name,
      squad_name: squadName,
      score: body.score,
      result: body.result,
      roster: body.roster,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (errorText.includes("squad_name")) {
      return NextResponse.json(
        { error: "Add the squad_name column in Supabase before saving squad names." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Unable to save leaderboard score." },
      { status: 502 },
    );
  }

  const rows = (await response.json()) as SupabaseLeaderboardRow[];

  return NextResponse.json({ score: toLeaderboardEntry(rows[0]) }, { status: 201 });
}
