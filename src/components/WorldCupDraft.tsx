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
import type { DraftPrompt, Player, RosterSlot } from "@/lib/gameTypes";

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

  const draftedIds = roster
    .map((slot) => slot.playerId)
    .filter((playerId): playerId is string => Boolean(playerId));

  const choices = useMemo(
    () => eligiblePlayers(prompt, draftedIds, roster).slice(0, maxChoices),
    [draftedIds, prompt, roster],
  );

  const filledCount = draftedIds.length;
  const result = scoreRoster(roster);

  useEffect(() => {
    setPrompt(createRandomPrompt());
  }, []);

  function resetGame() {
    setPrompt(createRandomPrompt());
    setRoster(initialRoster);
    setCountryRerolls(1);
    setDecadeRerolls(1);
    setSelectedSlotId(null);
    setMessage("New tournament. Build your XI.");
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
              </div>
            ) : null}

            <div className="rounded-lg border border-neutral-950/15 bg-white/78 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-black">Your XI</h2>
                <p className="text-sm font-bold text-neutral-600">4-3-3</p>
              </div>

              <div className="grid gap-2">
                {roster.map((slot) => {
                  const player = getPlayer(slot.playerId);
                  const isSelected = selectedSlotId === slot.id;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() =>
                        setSelectedSlotId((currentSlotId) =>
                          currentSlotId === slot.id ? null : slot.id,
                        )
                      }
                      disabled={Boolean(slot.playerId) || Boolean(result)}
                      className={`grid min-h-16 grid-cols-[52px_1fr] items-center gap-3 rounded-md border p-3 text-left transition ${
                        isSelected
                          ? "border-emerald-800 bg-emerald-50"
                          : "border-neutral-950/10 bg-white"
                      } ${
                        slot.playerId || result
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
