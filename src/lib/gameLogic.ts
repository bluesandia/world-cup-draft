import { initialRoster } from "@/data/roster";
import { players } from "@/data/players";
import {
  canFitAnyOpenSlot,
  draftPromptsForRoster,
  getCountry,
  playerMatchesPrompt,
} from "./draftPools";
import type { DraftPrompt, Player, RosterSlot } from "./gameTypes";

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

function randomPromptFrom(
  candidates: DraftPrompt[],
  draftedIds: string[],
  roster: RosterSlot[],
): DraftPrompt {
  const fallbackPrompts = draftPromptsForRoster(draftedIds, roster);

  return randomItem(
    candidates.length > 0
      ? candidates
      : fallbackPrompts.length > 0
        ? fallbackPrompts
        : [{ countryId: "bra", eraId: "1970s" }],
  );
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
  const fallbackPrompts = draftPrompts.filter(
    (candidate) => candidate.countryId !== prompt.countryId,
  );

  return randomPromptFrom(
    sameEraPrompts.length > 0 ? sameEraPrompts : fallbackPrompts,
    draftedIds,
    roster,
  );
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
  const fallbackPrompts = draftPrompts.filter(
    (candidate) => candidate.eraId !== prompt.eraId,
  );

  return randomPromptFrom(
    sameCountryPrompts.length > 0 ? sameCountryPrompts : fallbackPrompts,
    draftedIds,
    roster,
  );
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

export function scoreRoster(roster: RosterSlot[]) {
  const draftedPlayers = roster
    .map((slot) => getPlayer(slot.playerId))
    .filter((player): player is Player => Boolean(player));

  if (draftedPlayers.length < initialRoster.length) {
    return null;
  }

  const totalRating = draftedPlayers.reduce((sum, player) => sum + player.rating, 0);
  const averageRating = totalRating / draftedPlayers.length;
  const chemistryBonus =
    new Set(draftedPlayers.map((player) => player.countryId)).size <= 4 ? 2 : 0;
  const finalScore = Math.round(averageRating + chemistryBonus);

  if (finalScore >= 96) {
    return { label: "World Cup Champion", score: finalScore };
  }

  if (finalScore >= 94) {
    return { label: "Finalist", score: finalScore };
  }

  if (finalScore >= 92) {
    return { label: "Semifinal", score: finalScore };
  }

  if (finalScore >= 90) {
    return { label: "Quarterfinal", score: finalScore };
  }

  if (finalScore >= 87) {
    return { label: "Round of 16", score: finalScore };
  }

  return { label: "Group Stage Exit", score: finalScore };
}

export function playerCountryName(player: Player): string {
  return getCountry(player.countryId).name;
}
