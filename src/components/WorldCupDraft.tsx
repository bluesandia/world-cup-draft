"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { draftPromptsForRoster, promptLabel } from "@/lib/draftPools";
import { ratingStyle } from "@/lib/ratingStyles";
import type {
  DraftPrompt,
  LeaderboardEntry,
  LeaderboardRosterPlayer,
  Player,
  RosterSlot,
} from "@/lib/gameTypes";

const maxChoices = 4;
const formationRows = [
  ["lw", "st", "rw"],
  ["cm-1", "cm-2", "cm-3"],
  ["lb", "cb-1", "cb-2", "rb"],
  ["gk"],
];
const starterPrompt: DraftPrompt = {
  countryId: "bra",
  eraId: "1970s",
};
const rollDurationMs = 1100;
const rollTickMs = 85;
type RollMode = "full" | "country" | "decade";

export function WorldCupDraft() {
  const [prompt, setPrompt] = useState<DraftPrompt>(starterPrompt);
  const [displayedPrompt, setDisplayedPrompt] = useState<DraftPrompt>(starterPrompt);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingLabel, setRollingLabel] = useState("Rolling");
  const [roster, setRoster] = useState<RosterSlot[]>(initialRoster);
  const [countryRerolls, setCountryRerolls] = useState(1);
  const [decadeRerolls, setDecadeRerolls] = useState(1);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [message, setMessage] = useState("Pick one player from this country and decade.");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardConfigured, setLeaderboardConfigured] = useState(true);
  const [leaderboardMessage, setLeaderboardMessage] = useState("Loading leaderboard.");
  const [leaderboardName, setLeaderboardName] = useState("");
  const [leaderboardSquadName, setLeaderboardSquadName] = useState("");
  const [leaderboardSubmitting, setLeaderboardSubmitting] = useState(false);
  const [leaderboardSubmitted, setLeaderboardSubmitted] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    startPromptRoll(createRandomPrompt(), "Opening draw complete. Pick one player.");
    return () => {
      clearRollTimers();
    };
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

  function clearRollTimers() {
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }

    if (rollTimeoutRef.current) {
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }
  }

  function startPromptRoll(
    finalPrompt: DraftPrompt,
    settledMessage: string,
    rollDraftedIds = draftedIds,
    rollRoster = roster,
    rollMode: RollMode = "full",
  ) {
    clearRollTimers();
    setIsRolling(true);
    setSelectedSlotId(null);
    setRollingLabel(
      rollMode === "country"
        ? "Rolling country"
        : rollMode === "decade"
          ? "Rolling decade"
          : "Rolling",
    );
    setMessage(
      rollMode === "country"
        ? "Rolling the next country."
        : rollMode === "decade"
          ? "Rolling the next decade."
          : "Rolling the next country and era.",
    );

    rollIntervalRef.current = setInterval(() => {
      setDisplayedPrompt(
        createRollingPrompt(finalPrompt, rollDraftedIds, rollRoster, rollMode),
      );
    }, rollTickMs);

    rollTimeoutRef.current = setTimeout(() => {
      clearRollTimers();
      setPrompt(finalPrompt);
      setDisplayedPrompt(finalPrompt);
      setIsRolling(false);
      setRollingLabel("Rolling");
      setMessage(settledMessage);
    }, rollDurationMs);
  }

  function createRollingPrompt(
    finalPrompt: DraftPrompt,
    rollDraftedIds: string[],
    rollRoster: RosterSlot[],
    rollMode: RollMode,
  ): DraftPrompt {
    if (rollMode === "full") {
      return createRandomPrompt(rollDraftedIds, rollRoster);
    }

    const prompts = draftPromptsForRoster(rollDraftedIds, rollRoster);
    const candidates = prompts.filter((candidate) =>
      rollMode === "country"
        ? candidate.eraId === finalPrompt.eraId
        : candidate.countryId === finalPrompt.countryId,
    );

    if (candidates.length === 0) {
      return finalPrompt;
    }

    const candidate = candidates[Math.floor(Math.random() * candidates.length)];

    return rollMode === "country"
      ? { countryId: candidate.countryId, eraId: finalPrompt.eraId }
      : { countryId: finalPrompt.countryId, eraId: candidate.eraId };
  }

  function resetGame() {
    const nextPrompt = createRandomPrompt([], initialRoster);

    setRoster(initialRoster);
    setCountryRerolls(1);
    setDecadeRerolls(1);
    setSelectedSlotId(null);
    setLeaderboardName("");
    setLeaderboardSquadName("");
    setLeaderboardSubmitted(false);
    setShareMessage("");
    startPromptRoll(
      nextPrompt,
      "New tournament draw complete. Build your XI.",
      [],
      initialRoster,
    );
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
          squadName: leaderboardSquadName,
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
      setLeaderboardMessage("Score saved.");
      await loadLeaderboard();
    } catch {
      setLeaderboardMessage("Unable to save score.");
    } finally {
      setLeaderboardSubmitting(false);
    }
  }

  function handleCountryReroll() {
    if (countryRerolls === 0 || isRolling) {
      return;
    }

    const nextPrompt = rerollCountry(prompt, draftedIds, roster);

    if (
      nextPrompt.countryId === prompt.countryId &&
      nextPrompt.eraId === prompt.eraId
    ) {
      setMessage("No other country is available for this decade.");
      return;
    }

    setCountryRerolls(0);
    startPromptRoll(
      nextPrompt,
      "Country rerolled. Choose carefully.",
      draftedIds,
      roster,
      "country",
    );
  }

  function handleDecadeReroll() {
    if (decadeRerolls === 0 || isRolling) {
      return;
    }

    const nextPrompt = rerollDecade(prompt, draftedIds, roster);

    if (
      nextPrompt.countryId === prompt.countryId &&
      nextPrompt.eraId === prompt.eraId
    ) {
      setMessage("No other decade is available for this country.");
      return;
    }

    setDecadeRerolls(0);
    startPromptRoll(
      nextPrompt,
      "Decade rerolled. The board changed.",
      draftedIds,
      roster,
      "decade",
    );
  }

  function draftPlayer(player: Player) {
    if (result || isRolling) {
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
      startPromptRoll(
        createRandomPrompt(nextDraftedIds, nextRoster),
        `${player.name} drafted at ${targetSlot.label}.`,
        nextDraftedIds,
        nextRoster,
      );
      return;
    }
    setMessage(`${player.name} drafted at ${targetSlot.label}.`);
  }

  function handleRosterSlotClick(clickedSlot: RosterSlot) {
    if (result || isRolling) {
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

  async function shareGame() {
    if (!result) {
      return;
    }

    const shareUrl = window.location.origin;
    const squadName = leaderboardSquadName || "WORLD XI";
    const shareText = `I built ${squadName} and scored ${result.score} (${result.label}) in World Cup XI Draft.`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "World Cup XI Draft",
          text: shareText,
          url: shareUrl,
        });
        setShareMessage("Share sheet opened.");
        return;
      }

      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setShareMessage("Game link copied.");
    } catch {
      setShareMessage("Unable to share from this browser.");
    }
  }

  function renderRosterSlot(slot: RosterSlot) {
    const player = getPlayer(slot.playerId);
    const isSelected = selectedSlotId === slot.id;
    const selectedSlot = roster.find((candidate) => candidate.id === selectedSlotId);
    const selectedPlayer = getPlayer(selectedSlot?.playerId ?? null);
    const canReceiveSelectedPlayer =
      Boolean(selectedPlayer) &&
      slot.playerId === null &&
      selectedPlayer !== undefined &&
      canFitSlot(selectedPlayer, slot);
    const playerStyle = player ? ratingStyle(player.rating) : null;

    return (
      <button
        key={slot.id}
        type="button"
        onClick={() => handleRosterSlotClick(slot)}
        disabled={Boolean(result) || isRolling}
        className={`min-h-24 rounded-md border p-2 text-center shadow-sm transition ${
          playerStyle
            ? playerStyle.panel
            : isSelected
            ? "border-emerald-950 bg-emerald-100"
            : canReceiveSelectedPlayer
              ? "border-emerald-800 bg-emerald-50"
              : "border-white/25 bg-white/92"
        } ${
          result || isRolling
            ? "cursor-default"
            : playerStyle
              ? "hover:brightness-105"
              : "hover:border-emerald-950 hover:bg-emerald-50"
        } ${isSelected ? "ring-2 ring-emerald-950" : ""}`}
      >
        <span
          className={`mx-auto block w-fit rounded px-2 py-1 text-xs font-black ${
            playerStyle ? playerStyle.badge : "bg-neutral-950 text-white"
          }`}
        >
          {slot.label}
        </span>
        {player ? (
          <span
            className={`mx-auto mt-2 block w-fit rounded px-2 py-1 text-lg font-black ${
              playerStyle?.badge ?? "bg-neutral-950 text-white"
            }`}
          >
            {player.rating}
          </span>
        ) : null}
        <span
          className={`mt-2 block text-sm font-black leading-tight ${
            playerStyle ? playerStyle.accent : "text-neutral-950"
          }`}
        >
          {player ? player.name : "Open"}
        </span>
        <span
          className={`mt-1 block text-xs font-semibold leading-tight ${
            playerStyle ? playerStyle.muted : "text-neutral-600"
          }`}
        >
          {player
            ? `${playerCountryName(player)} · ${player.rosterSlots.join(" / ")}`
            : canReceiveSelectedPlayer
              ? `Move ${selectedPlayer?.name} here`
              : isSelected
                ? "Target slot"
                : "Click slot"}
        </span>
      </button>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 text-neutral-950 sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-neutral-950/15 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/leaderboard"
              className="mb-4 inline-flex rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              Menu
            </Link>
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
              disabled={countryRerolls === 0 || Boolean(result) || isRolling}
              className="rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-neutral-400 disabled:bg-neutral-300 disabled:text-neutral-600"
            >
              Country reroll: {countryRerolls}
            </button>
            <button
              type="button"
              onClick={handleDecadeReroll}
              disabled={decadeRerolls === 0 || Boolean(result) || isRolling}
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
                  <h2
                    className={`mt-1 text-3xl font-black transition ${
                      isRolling ? "text-emerald-800" : "text-neutral-950"
                    }`}
                  >
                    {promptLabel(displayedPrompt)}
                  </h2>
                  {isRolling ? (
                    <div className="mt-3 flex w-fit items-center gap-2 rounded-md border border-emerald-800 bg-emerald-50 px-3 py-2 text-sm font-black uppercase text-emerald-900">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-700" />
                      {rollingLabel}
                    </div>
                  ) : null}
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
              {isRolling ? (
                <div className="rounded-lg border border-dashed border-emerald-700 bg-emerald-50 p-6 text-center sm:col-span-2">
                  <p className="text-sm font-black uppercase tracking-wide text-emerald-800">
                    {rollingLabel}
                  </p>
                  <h3 className="mt-2 text-3xl font-black text-neutral-950">
                    {promptLabel(displayedPrompt)}
                  </h3>
                </div>
              ) : choices.length > 0 ? (
                choices.map((player) => {
                  const playerStyle = ratingStyle(player.rating);

                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => draftPlayer(player)}
                      disabled={Boolean(result) || isRolling}
                      className={`group rounded-lg border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:brightness-105 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${playerStyle.panel}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className={`text-xl font-black ${playerStyle.accent}`}>
                            {player.name}
                          </h3>
                          <p className={`mt-1 text-sm font-bold ${playerStyle.muted}`}>
                            Slots: {player.rosterSlots.join(" / ")}
                          </p>
                        </div>
                        <span
                          className={`rounded-md px-3 py-2 text-lg font-black ${playerStyle.badge}`}
                        >
                          {player.rating}
                        </span>
                      </div>
                      <p className={`mt-3 text-sm leading-6 ${playerStyle.muted}`}>
                        {player.worldCupNote}
                      </p>
                      <p
                        className={`mt-3 text-xs font-bold uppercase tracking-wide ${playerStyle.muted}`}
                      >
                        Roles: {player.roleTags.join(" / ")}
                      </p>
                    </button>
                  );
                })
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
              <div className="order-1 rounded-lg border border-emerald-900 bg-emerald-950 p-5 text-white shadow-sm">
                <p className="text-sm font-bold uppercase text-emerald-100">Final result</p>
                <h2 className="mt-2 text-3xl font-black">{result.label}</h2>
                <p className="mt-2 text-sm text-emerald-50">Squad score: {result.score}</p>
                <div className="mt-4 grid gap-2 rounded-md border border-white/15 bg-white/10 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    {result.units.map((unit) => (
                      <div key={unit.label}>
                        <p className="text-[11px] font-black uppercase text-emerald-100">
                          {unit.label}
                        </p>
                        <p className="text-sm font-black">
                          {unit.average}
                          {unit.bonus > 0 ? " +1" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-emerald-100">
                    Base {result.baseAverage} · Chemistry +{result.chemistryBonus} · Elite +
                    {result.elitePlayerBonus} · Units +{result.unitBonus}
                  </p>
                </div>
                <div className="mt-4 border-t border-white/20 pt-4">
                  <div className="grid gap-3">
                    <label
                      htmlFor="leaderboard-name"
                      className="text-xs font-bold uppercase text-emerald-100"
                    >
                      Player name
                    </label>
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

                    <label
                      htmlFor="squad-name"
                      className="text-xs font-bold uppercase text-emerald-100"
                    >
                      Squad name
                    </label>
                    <input
                      id="squad-name"
                      type="text"
                      value={leaderboardSquadName}
                      placeholder="SAMBA XI"
                      onChange={(event) =>
                        setLeaderboardSquadName(
                          event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9 ]/g, "")
                            .replace(/\s+/g, " ")
                            .slice(0, 24),
                        )
                      }
                      maxLength={24}
                      disabled={leaderboardSubmitted || leaderboardSubmitting}
                      className="min-w-0 rounded-md border border-white/20 bg-white px-3 py-2 font-black uppercase text-neutral-950 outline-none focus:border-emerald-200 disabled:cursor-not-allowed disabled:bg-white/40"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={submitLeaderboardScore}
                        disabled={
                          !leaderboardConfigured ||
                          leaderboardSubmitted ||
                          leaderboardSubmitting ||
                          leaderboardName.length === 0 ||
                          leaderboardSquadName.trim().length === 0
                        }
                        className="rounded-md bg-white px-3 py-2 text-sm font-black text-emerald-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-emerald-950/50"
                      >
                        Save score
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareGame()}
                        className="rounded-md border border-white/30 px-3 py-2 text-sm font-black text-white transition hover:bg-white/10"
                      >
                        Share this game
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-emerald-100">
                    {leaderboardSubmitted
                      ? "Score locked in."
                      : "Player name: 1-9 letters or numbers. Squad name: 1-24 letters, numbers, or spaces."}
                  </p>
                  {shareMessage ? (
                    <p className="mt-2 text-xs font-semibold text-emerald-100">
                      {shareMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="order-3 rounded-lg border border-neutral-950/15 bg-white/78 p-4 shadow-sm">
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
                          {entry.squadName} · {entry.result}
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

            <div className="order-2 rounded-lg border border-neutral-950/15 bg-white/78 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-black">Your XI</h2>
                <p className="text-sm font-bold text-neutral-600">4-3-3</p>
              </div>

              <div className="relative overflow-hidden rounded-lg border border-emerald-950 bg-emerald-900 p-3 text-white shadow-inner">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:36px_36px]" />
                <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
                <div className="relative grid min-h-[520px] grid-rows-[1fr_1fr_1.12fr_0.82fr] gap-3">
                  {formationRows.map((row) => (
                    <div
                      key={row.join("-")}
                      className="grid items-center gap-2"
                      style={{
                        gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {row.map((slotId) => {
                        const slot = roster.find((candidate) => candidate.id === slotId);

                        return slot ? renderRosterSlot(slot) : null;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
