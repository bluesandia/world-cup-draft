"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LeaderboardEntry, RosterPosition } from "@/lib/gameTypes";

const formationRows: RosterPosition[][] = [
  ["LW", "ST", "RW"],
  ["CM", "CM", "CM"],
  ["LB", "CB", "CB", "RB"],
  ["GK"],
];

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
  const [message, setMessage] = useState("Loading leaderboard.");

  useEffect(() => {
    void loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    try {
      const response = await fetch("/api/leaderboard?limit=500");
      const data = (await response.json()) as {
        configured?: boolean;
        scores?: LeaderboardEntry[];
        error?: string;
      };

      const scores = data.scores ?? [];

      setEntries(scores);
      setSelectedEntry(scores[0] ?? null);
      setMessage(
        data.configured === false
          ? "Leaderboard needs Supabase env vars."
          : data.error
            ? data.error
            : `${scores.length} saved scores`,
      );
    } catch {
      setMessage("Leaderboard unavailable.");
    }
  }

  function playersForSlot(slot: RosterPosition) {
    if (!selectedEntry) {
      return [];
    }

    return selectedEntry.roster.filter((player) => player.slot === slot);
  }

  function slotOccurrenceIndex(row: RosterPosition[], slot: RosterPosition, slotIndex: number) {
    return row.slice(0, slotIndex + 1).filter((rowSlot) => rowSlot === slot).length - 1;
  }

  function displayCountry(country: string) {
    return country === "Serbia and Montenegro" ? "Serbia" : country;
  }

  return (
    <main className="min-h-screen px-4 py-6 text-neutral-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-neutral-950/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              Back
            </Link>
            <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
              Global Leaderboard
            </h1>
            <p className="mt-2 text-sm font-bold text-neutral-600">{message}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadLeaderboard()}
            className="w-fit rounded-md border border-neutral-950/20 bg-white px-4 py-2 text-sm font-bold text-neutral-950 transition hover:border-neutral-950"
          >
            Refresh
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-lg border border-neutral-950/15 bg-white/78 p-4 shadow-sm">
            <h2 className="text-xl font-black">Scores</h2>
            <div className="mt-3 grid max-h-[680px] gap-2 overflow-auto pr-1">
              {entries.length > 0 ? (
                entries.map((entry, index) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    className={`grid grid-cols-[36px_1fr_56px] items-center gap-2 rounded-md border p-3 text-left transition hover:border-emerald-700 hover:bg-emerald-50 ${
                      selectedEntry?.id === entry.id
                        ? "border-emerald-800 bg-emerald-50"
                        : "border-neutral-950/10 bg-white"
                    }`}
                  >
                    <span className="text-sm font-black text-neutral-500">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-black">{entry.squadName}</span>
                      <span className="block truncate text-xs font-semibold text-neutral-600">
                        {entry.name} · {entry.result}
                      </span>
                    </span>
                    <span className="text-right text-xl font-black">{entry.score}</span>
                  </button>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-neutral-300 bg-white/70 p-4 text-sm font-semibold text-neutral-600">
                  No scores have been saved yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-neutral-950/15 bg-white/78 p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">
                  {selectedEntry ? selectedEntry.squadName : "Select a score"}
                </h2>
                <p className="text-sm font-bold text-neutral-600">
                  {selectedEntry
                    ? `${selectedEntry.name} · ${selectedEntry.result} · ${selectedEntry.score}`
                    : "Click a username to inspect the XI."}
                </p>
              </div>
            </div>

            <div className="relative min-h-[620px] overflow-hidden rounded-lg border border-emerald-950 bg-emerald-900 p-4 text-white shadow-inner">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
              <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
              <div className="relative grid min-h-[588px] grid-rows-[1fr_1fr_1.15fr_0.8fr] gap-4">
                {formationRows.map((row, rowIndex) => (
                  <div
                    key={`${row.join("-")}-${rowIndex}`}
                    className="grid items-center gap-3"
                    style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                  >
                    {row.map((slot, slotIndex) => {
                      const player =
                        playersForSlot(slot)[slotOccurrenceIndex(row, slot, slotIndex)];

                      return (
                        <div
                          key={`${slot}-${slotIndex}`}
                          className="min-h-24 rounded-md border border-white/25 bg-white/92 p-3 text-center text-neutral-950 shadow-sm"
                        >
                          <p className="text-xs font-black text-emerald-800">{slot}</p>
                          <p className="mt-1 text-sm font-black leading-tight">
                            {player ? player.name : "Open"}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-neutral-600">
                            {player ? displayCountry(player.country) : ""}
                          </p>
                          <p className="mt-2 text-lg font-black">{player?.rating ?? ""}</p>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
