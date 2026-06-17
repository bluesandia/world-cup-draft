"use client";

import { useEffect, useMemo, useState } from "react";
import {
  bestOpenSlotForPlayer,
  canFitSlot,
  createRandomPrompt,
  eligiblePlayers,
  getPlayer,
  initialRoster,
  playerCountryName,
  rerollCountry,
  rerollDecade,
  scoreRoster,
} from "@/lib/gameLogic";
import { promptLabel } from "@/lib/draftPools";
import type {
  DraftPrompt,
  LeaderboardEntry,
  LeaderboardRosterPlayer,
  Player,
  RosterSlot,
} from "@/lib/gameTypes";

const maxChoices = 4;
const starterPrompt: DraftPrompt = {
  countryId: "bra",
  eraId: "1970s",
};

export function WorldCupDraft() {
  const [prompt, setPrompt] = useState<DraftPrompt>(starterPrompt);
  const [roster, setRoster] = useState<RosterSlot[]>(initialRoster);
  const [countryRerolls, setCountryRerolls] = useState(1);
  const [decadeRerolls, setDecadeRerolls] = useState(1);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [message, setMessage] = useState("Pick one player from this country and decade.");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardConfigured, setLeaderboardConfigured] = useState(true);
  const [leaderboardMessage, setLeaderboardMessage] = useState("Loading leaderboard.");
  const [leaderboardName, setLeaderboardName] = useState("");
  const [leaderboardSubmitting, setLeaderboardSubmitting] = useState(false);
  const [leaderboardSubmitted, setLeaderboardSubmitted] = useState(false);

  const draftedIds = roster
    .map((slot) => slot.playerId)
    .filter((playerId): playerId is string => Boolean(playerId));

  const choices = useMemo(
    () => eligiblePlayers(prompt, draftedIds, roster).slice(0, maxChoices),
    [draftedIds, prompt, roster],
  );

  const filledCount = draftedIds.length;
  const result = scoreRoster(roster);
  const leaderboardRoster = useMemo(
    () =>
      roster
        .map((slot): LeaderboardRosterPlayer | null => {
          const player = getPlayer(slot.playerId);

          if (!player) {
            return null;
          }

          return {
            slot: slot.label,
            playerId: player.id,
            name: player.name,
            country: playerCountryName(player),
            rating: player.rating,
          };
        })
        .filter((player): player is LeaderboardRosterPlayer => Boolean(player)),
    [roster],
  );

  useEffect(() => {
    setPrompt(createRandomPrompt());
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    try {
      const response = await fetch("/api/leaderboard");
      const data = (await response.json()) as {
        configured?: boolean;
        scores?: LeaderboardEntry[];
        error?: string;
      };

      setLeaderboardConfigured(data.configured !== false);
      setLeaderboard(data.scores ?? []);
      setLeaderboardMessage(
        data.configured === false
          ? "Leaderboard needs Supabase env vars."
          : data.error
            ? data.error
            : "Global top scores",
      );
    } catch {
      setLeaderboardMessage("Leaderboard unavailable.");
    }
  }

  function resetGame() {
    setPrompt(createRandomPrompt());
    setRoster(initialRoster);
    setCountryRerolls(1);
    setDecadeRerolls(1);
    setSelectedSlotId(null);
    setMessage("New tournament. Build your XI.");
    setLeaderboardName("");
    setLeaderboardSubmitted(false);
  }

  async function submitLeaderboardScore() {
    if (!result || leaderboardRoster.length !== initialRoster.length || leaderboardSubmitting) {
      return;
    }

    setLeaderboardSubmitting(true);
    setLeaderboardMessage("Saving score.");

    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: leaderboardName,
          score: result.score,
          result: result.label,
          roster: leaderboardRoster,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setLeaderboardMessage(data.error ?? "Unable to save score.");
        return;
      }

      setLeaderboardSubmitted(true);
      setLeaderboardName("");
      setLeaderboardMessage("Score saved.");
      await loadLeaderboard();
    } catch {
      setLeaderboardMessage("Unable to save score.");
    } finally {
      setLeaderboardSubmitting(false);
    }
  }

  function handleCountryReroll() {
    if (countryRerolls === 0) {
      return;
    }

    setPrompt((currentPrompt) => rerollCountry(currentPrompt, draftedIds, roster));
    setCountryRerolls(0);
    setMessage("Country rerolled. Choose carefully.");
  }

  function handleDecadeReroll() {
    if (decadeRerolls === 0) {
      return;
    }

    setPrompt((currentPrompt) => rerollDecade(currentPrompt, draftedIds, roster));
    setDecadeRerolls(0);
    setMessage("Decade rerolled. The board changed.");
  }

  function draftPlayer(player: Player) {
    if (result) {
      return;
    }

    const selectedSlot = roster.find((slot) => slot.id === selectedSlotId);
    const targetSlot =
      selectedSlot && selectedSlot.playerId === null && canFitSlot(player, selectedSlot)
        ? selectedSlot
        : bestOpenSlotForPlayer(player, roster);

    if (!targetSlot) {
      setMessage(`${player.name} does not fit any open roster slot.`);
      return;
    }

    const nextRoster = roster.map((slot) =>
      slot.id === targetSlot.id ? { ...slot, playerId: player.id } : slot,
    );
    const nextDraftedIds = [...draftedIds, player.id];

    setRoster(nextRoster);
    setSelectedSlotId(null);
    if (nextDraftedIds.length < initialRoster.length) {
      setPrompt(createRandomPrompt(nextDraftedIds, nextRoster));
    }
    setMessage(`${player.name} drafted at ${targetSlot.label}.`);
  }

  function handleRosterSlotClick(clickedSlot: RosterSlot) {
    if (result) {
      return;
    }

    const selectedSlot = roster.find((slot) => slot.id === selectedSlotId);

    if (!selectedSlot) {
      const clickedPlayer = getPlayer(clickedSlot.playerId);

      setSelectedSlotId(clickedSlot.id);
      setMessage(
        clickedPlayer
          ? `Selected ${clickedPlayer.name}. Click an open valid slot to move him.`
          : `Selected ${clickedSlot.label}. Next valid player goes here.`,
      );
      return;
    }

    if (selectedSlot.id === clickedSlot.id) {
      setSelectedSlotId(null);
      setMessage("Selection cleared.");
      return;
    }

    const selectedPlayer = getPlayer(selectedSlot.playerId);

    if (selectedPlayer && clickedSlot.playerId === null) {
      if (!canFitSlot(selectedPlayer, clickedSlot)) {
        setMessage(`${selectedPlayer.name} cannot move to ${clickedSlot.label}.`);
        return;
      }

      setRoster((currentRoster) =>
        currentRoster.map((slot) => {
          if (slot.id === selectedSlot.id) {
            return { ...slot, playerId: null };
          }

          if (slot.id === clickedSlot.id) {
            return { ...slot, playerId: selectedPlayer.id };
          }

          return slot;
        }),
      );
      setSelectedSlotId(null);
      setMessage(
        `${selectedPlayer.name} moved from ${selectedSlot.label} to ${clickedSlot.label}.`,
      );
      return;
    }

    const clickedPlayer = getPlayer(clickedSlot.playerId);

    setSelectedSlotId(clickedSlot.id);
    setMessage(
      clickedPlayer
        ? `Selected ${clickedPlayer.name}. Click an open valid slot to move him.`
        : `Selected ${clickedSlot.label}. Next valid player goes here.`,
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 text-neutral-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-neutral-950/15 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">
              World Cup XI Draft
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight sm:text-5xl">
              Build the best World XI
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCountryReroll}
              disabled={countryRerolls === 0 || Boolean(result)}
              className="rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-neutral-400 disabled:bg-neutral-300 disabled:text-neutral-600"
            >
              Country reroll: {countryRerolls}
            </button>
            <button
              type="button"
              onClick={handleDecadeReroll}
              disabled={decadeRerolls === 0 || Boolean(result)}
              className="rounded-md border border-neutral-950 bg-white px-4 py-2 text-sm font-bold text-neutral-950 transition hover:border-emerald-800 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
            >
              Decade reroll: {decadeRerolls}
            </button>
            <button
              type="button"
              onClick={resetGame}
              className="rounded-md border border-neutral-950/20 bg-white px-4 py-2 text-sm font-bold text-neutral-950 transition hover:border-neutral-950"
            >
              New draft
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <section className="flex flex-col gap-5">
            <div className="rounded-lg border border-neutral-950/15 bg-white/78 p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-600">Current pool</p>
                  <h2 className="mt-1 text-3xl font-black">{promptLabel(prompt)}</h2>
                </div>
                <div className="rounded-md bg-emerald-900 px-4 py-3 text-white">
                  <p className="text-xs font-bold uppercase text-emerald-100">Roster</p>
                  <p className="text-xl font-black">
                    {filledCount}/{initialRoster.length}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-neutral-700">{message}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {choices.length > 0 ? (
                choices.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => draftPlayer(player)}
                    disabled={Boolean(result)}
                    className="group rounded-lg border border-neutral-950/15 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">{player.name}</h3>
                        <p className="mt-1 text-sm font-bold text-emerald-800">
                          Slots: {player.rosterSlots.join(" / ")}
                        </p>
                      </div>
                      <span className="rounded-md bg-neutral-950 px-3 py-2 text-lg font-black text-white">
                        {player.rating}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-neutral-700">
                      {player.worldCupNote}
                    </p>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
                      Roles: {player.roleTags.join(" / ")}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-neutral-400 bg-white/70 p-5 sm:col-span-2">
                  <h3 className="text-xl font-black">No eligible players found</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">
                    Use a reroll if you have one, or start a new draft. Add more players to
                    src/data/players.ts to make this pool deeper.
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            {result ? (
              <div className="rounded-lg border border-emerald-900 bg-emerald-950 p-5 text-white shadow-sm">
                <p className="text-sm font-bold uppercase text-emerald-100">Final result</p>
                <h2 className="mt-2 text-3xl font-black">{result.label}</h2>
                <p className="mt-2 text-sm text-emerald-50">Squad score: {result.score}</p>
                <div className="mt-4 border-t border-white/20 pt-4">
                  <label
                    htmlFor="leaderboard-name"
                    className="text-xs font-bold uppercase text-emerald-100"
                  >
                    Leaderboard name
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="leaderboard-name"
                      type="text"
                      value={leaderboardName}
                      placeholder="ABC123"
                      onChange={(event) =>
                        setLeaderboardName(
                          event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                            .slice(0, 9),
                        )
                      }
                      maxLength={9}
                      disabled={leaderboardSubmitted || leaderboardSubmitting}
                      className="min-w-0 flex-1 rounded-md border border-white/20 bg-white px-3 py-2 font-black uppercase text-neutral-950 outline-none focus:border-emerald-200 disabled:cursor-not-allowed disabled:bg-white/40"
                    />
                    <button
                      type="button"
                      onClick={submitLeaderboardScore}
                      disabled={
                        !leaderboardConfigured ||
                        leaderboardSubmitted ||
                        leaderboardSubmitting ||
                        leaderboardName.length === 0
                      }
                      className="rounded-md bg-white px-3 py-2 text-sm font-black text-emerald-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-emerald-950/50"
                    >
                      Save
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-emerald-100">
                    {leaderboardSubmitted
                      ? "Score locked in."
                      : "Use 1-9 letters or numbers."}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-neutral-950/15 bg-white/78 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Leaderboard</h2>
                  <p className="text-sm font-semibold text-neutral-600">
                    {leaderboardMessage}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadLeaderboard()}
                  className="rounded-md border border-neutral-950/20 bg-white px-3 py-2 text-sm font-bold text-neutral-950 transition hover:border-neutral-950"
                >
                  Refresh
                </button>
              </div>
              <div className="grid gap-2">
                {leaderboard.length > 0 ? (
                  leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[32px_1fr_48px] items-center gap-2 rounded-md border border-neutral-950/10 bg-white p-2"
                    >
                      <span className="text-sm font-black text-neutral-500">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-black">{entry.name}</span>
                        <span className="block truncate text-xs font-semibold text-neutral-600">
                          {entry.result}
                        </span>
                      </span>
                      <span className="text-right text-lg font-black">{entry.score}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-neutral-300 bg-white/70 p-3 text-sm font-semibold text-neutral-600">
                    No scores yet.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-neutral-950/15 bg-white/78 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-black">Your XI</h2>
                <p className="text-sm font-bold text-neutral-600">4-3-3</p>
              </div>

              <div className="grid gap-2">
                {roster.map((slot) => {
                  const player = getPlayer(slot.playerId);
                  const isSelected = selectedSlotId === slot.id;
                  const selectedSlot = roster.find(
                    (candidate) => candidate.id === selectedSlotId,
                  );
                  const selectedPlayer = getPlayer(selectedSlot?.playerId ?? null);
                  const canReceiveSelectedPlayer =
                    Boolean(selectedPlayer) &&
                    slot.playerId === null &&
                    selectedPlayer !== undefined &&
                    canFitSlot(selectedPlayer, slot);

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleRosterSlotClick(slot)}
                      disabled={Boolean(result)}
                      className={`grid min-h-16 grid-cols-[52px_1fr] items-center gap-3 rounded-md border p-3 text-left transition ${
                        isSelected
                          ? "border-emerald-800 bg-emerald-50"
                          : canReceiveSelectedPlayer
                            ? "border-emerald-700 bg-emerald-50"
                          : "border-neutral-950/10 bg-white"
                      } ${
                        result
                          ? "cursor-default"
                          : "hover:border-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      <span className="rounded-md bg-neutral-950 px-2 py-2 text-center text-sm font-black text-white">
                        {slot.label}
                      </span>
                      <span>
                        <span className="block font-black">
                          {player ? player.name : "Open slot"}
                        </span>
                        <span className="block text-sm font-semibold text-neutral-600">
                          {player
                            ? `${playerCountryName(player)}, ${player.rosterSlots.join(" / ")}`
                            : canReceiveSelectedPlayer
                              ? `Move ${selectedPlayer?.name} here`
                            : isSelected
                              ? "Next valid player goes here"
                              : "Click to target this slot"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
