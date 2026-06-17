import { initialRoster } from "@/data/roster";
import { players } from "@/data/players";
import {
  canFitAnyOpenSlot,
  draftPromptsForRoster,
  getCountry,
  playerMatchesPrompt,
} from "./draftPools";
import type { DraftPrompt, Player, RosterSlot, ScoreResult, ScoreUnit } from "./gameTypes";

export { initialRoster };

const playersById = new Map(players.map((player) => [player.id, player]));

export function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function createRandomPrompt(
  draftedIds: string[] = [],
  roster: RosterSlot[] = initialRoster,
): DraftPrompt {
  const prompts = draftPromptsForRoster(draftedIds, roster);

  return prompts.length > 0 ? randomItem(prompts) : { countryId: "bra", eraId: "1970s" };
}

export function rerollCountry(
  prompt: DraftPrompt,
  draftedIds: string[] = [],
  roster: RosterSlot[] = initialRoster,
): DraftPrompt {
  const draftPrompts = draftPromptsForRoster(draftedIds, roster);
  const sameEraPrompts = draftPrompts.filter(
    (candidate) =>
      candidate.eraId === prompt.eraId && candidate.countryId !== prompt.countryId,
  );

  return sameEraPrompts.length > 0 ? randomItem(sameEraPrompts) : prompt;
}

export function rerollDecade(
  prompt: DraftPrompt,
  draftedIds: string[] = [],
  roster: RosterSlot[] = initialRoster,
): DraftPrompt {
  const draftPrompts = draftPromptsForRoster(draftedIds, roster);
  const sameCountryPrompts = draftPrompts.filter(
    (candidate) =>
      candidate.countryId === prompt.countryId && candidate.eraId !== prompt.eraId,
  );

  return sameCountryPrompts.length > 0 ? randomItem(sameCountryPrompts) : prompt;
}

export function eligiblePlayers(
  prompt: DraftPrompt,
  draftedIds: string[],
  roster: RosterSlot[],
): Player[] {
  return players
    .filter(
      (player) =>
        playerMatchesPrompt(player, prompt) &&
        !draftedIds.includes(player.id) &&
        canFitAnyOpenSlot(player, roster),
    )
    .sort((a, b) => b.rating - a.rating);
}

export function canFitSlot(player: Player, slot: RosterSlot): boolean {
  return player.rosterSlots.includes(slot.label);
}

export function bestOpenSlotForPlayer(
  player: Player,
  roster: RosterSlot[],
): RosterSlot | undefined {
  return roster.find((slot) => slot.playerId === null && canFitSlot(player, slot));
}

export function getPlayer(playerId: string | null): Player | undefined {
  if (!playerId) {
    return undefined;
  }

  return playersById.get(playerId);
}

function unitAverage(roster: RosterSlot[], slotIds: string[]): number {
  const unitPlayers = roster
    .filter((slot) => slotIds.includes(slot.id))
    .map((slot) => getPlayer(slot.playerId))
    .filter((player): player is Player => Boolean(player));

  if (unitPlayers.length === 0) {
    return 0;
  }

  return unitPlayers.reduce((sum, player) => sum + player.rating, 0) / unitPlayers.length;
}

function roundedTenths(value: number): number {
  return Math.round(value * 10) / 10;
}

export function scoreRoster(roster: RosterSlot[]): ScoreResult | null {
  const draftedPlayers = roster
    .map((slot) => getPlayer(slot.playerId))
    .filter((player): player is Player => Boolean(player));

  if (draftedPlayers.length < initialRoster.length) {
    return null;
  }

  const totalRating = draftedPlayers.reduce((sum, player) => sum + player.rating, 0);
  const averageRating = totalRating / draftedPlayers.length;
  const elitePlayerBonus = draftedPlayers.filter((player) => player.rating >= 92).length;
  const chemistryBonus =
    new Set(draftedPlayers.map((player) => player.countryId)).size <= 4 ? 2 : 0;
  const unitRatings = [
    { label: "Attack" as const, average: unitAverage(roster, ["lw", "st", "rw"]) },
    { label: "Midfield" as const, average: unitAverage(roster, ["cm-1", "cm-2", "cm-3"]) },
    {
      label: "Defense" as const,
      average: unitAverage(roster, ["lb", "cb-1", "cb-2", "rb", "gk"]),
    },
  ];
  const units: ScoreUnit[] = unitRatings.map((unit) => ({
    label: unit.label,
    average: roundedTenths(unit.average),
    bonus: unit.average > 86 ? 1 : 0,
  }));
  const unitBonus = units.reduce((sum, unit) => sum + unit.bonus, 0);
  const finalScore = Math.round(
    averageRating + chemistryBonus + elitePlayerBonus + unitBonus,
  );

  const resultBase = {
    score: finalScore,
    baseAverage: roundedTenths(averageRating),
    chemistryBonus,
    elitePlayerBonus,
    unitBonus,
    units,
  };

  if (finalScore >= 98) {
    return { ...resultBase, label: "G.O.A.T." };
  }

  if (finalScore >= 94) {
    return { ...resultBase, label: "World Cup Champion" };
  }

  if (finalScore >= 92) {
    return { ...resultBase, label: "Finalist" };
  }

  if (finalScore >= 90) {
    return { ...resultBase, label: "Semifinalist" };
  }

  if (finalScore >= 88) {
    return { ...resultBase, label: "Quarterfinalist" };
  }

  if (finalScore >= 86) {
    return { ...resultBase, label: "Round of 16" };
  }

  if (finalScore >= 80) {
    return { ...resultBase, label: "Group Stage Exit" };
  }

  return { ...resultBase, label: "Go Back To Your Country" };
}

export function playerCountryName(player: Player): string {
  return getCountry(player.countryId).name;
}
