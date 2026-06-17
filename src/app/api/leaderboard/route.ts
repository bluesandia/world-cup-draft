import { NextResponse } from "next/server";
import type { LeaderboardEntry, LeaderboardRosterPlayer } from "@/lib/gameTypes";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const tableName = "leaderboard_scores";
const maxNameLength = 9;
const namePattern = /^[A-Z0-9]{1,9}$/;

type SupabaseLeaderboardRow = {
  id: string;
  name: string;
  score: number;
  result: string;
  roster: LeaderboardRosterPlayer[];
  created_at: string;
};

type SubmitLeaderboardBody = {
  name?: unknown;
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
    score: row.score,
    result: row.result,
    roster: row.roster,
    createdAt: row.created_at,
  };
}

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ configured: false, scores: [] });
  }

  const url = new URL(`${supabaseUrl}/rest/v1/${tableName}`);
  url.searchParams.set("select", "id,name,score,result,roster,created_at");
  url.searchParams.set("order", "score.desc,created_at.asc");
  url.searchParams.set("limit", "10");

  const response = await fetch(url, {
    headers: supabaseHeaders(),
    next: { revalidate: 10 },
  });

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

  if (!namePattern.test(name)) {
    return NextResponse.json(
      { error: "Name must be 1 to 9 letters or numbers." },
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
      score: body.score,
      result: body.result,
      roster: body.roster,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Unable to save leaderboard score." },
      { status: 502 },
    );
  }

  const rows = (await response.json()) as SupabaseLeaderboardRow[];

  return NextResponse.json({ score: toLeaderboardEntry(rows[0]) }, { status: 201 });
}
