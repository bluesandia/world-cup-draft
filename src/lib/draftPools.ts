import { countries } from "@/data/countries";
import { eras } from "@/data/eras";
import { players } from "@/data/players";
import type { Country, DraftPrompt, Era, Player, RosterSlot } from "./gameTypes";

const countriesById = new Map(countries.map((country) => [country.id, country]));
const erasById = new Map(eras.map((era) => [era.id, era]));
const eraIdsByYear = new Map(
  eras.flatMap((era) => era.worldCupYears.map((year) => [year, era.id] as const)),
);
const eraYearSetsById = new Map(
  eras.map((era) => [era.id, new Set(era.worldCupYears)]),
);
const playerEraIdsById = new Map(
  players.map((player) => [
    player.id,
    new Set(player.worldCupYears.map((year) => eraIdsByYear.get(year)).filter(Boolean)),
  ]),
);

export function getCountry(countryId: string): Country {
  const country = countriesById.get(countryId);

  if (!country) {
    throw new Error(`Unknown country id: ${countryId}`);
  }

  return country;
}

export function getEra(eraId: string): Era {
  const era = erasById.get(eraId);

  if (!era) {
    throw new Error(`Unknown era id: ${eraId}`);
  }

  return era;
}

export function playerMatchesEra(player: Player, era: Era): boolean {
  const eraYears = eraYearSetsById.get(era.id);

  return Boolean(eraYears && player.worldCupYears.some((year) => eraYears.has(year)));
}

export function canFitAnyOpenSlot(player: Player, roster: RosterSlot[]): boolean {
  return roster.some(
    (slot) => slot.playerId === null && player.rosterSlots.includes(slot.label),
  );
}

export function playerMatchesPrompt(player: Player, prompt: DraftPrompt): boolean {
  return (
    player.countryId === prompt.countryId &&
    Boolean(playerEraIdsById.get(player.id)?.has(prompt.eraId))
  );
}

export function promptLabel(prompt: DraftPrompt): string {
  return `${getCountry(prompt.countryId).name} · ${getEra(prompt.eraId).label}`;
}

export function draftPromptsForRoster(
  draftedIds: string[],
  roster: RosterSlot[],
): DraftPrompt[] {
  const promptKeys = new Set<string>();

  for (const player of players) {
    if (draftedIds.includes(player.id) || !canFitAnyOpenSlot(player, roster)) {
      continue;
    }

    for (const eraId of playerEraIdsById.get(player.id) ?? []) {
      if (eraId) {
        promptKeys.add(`${player.countryId}|${eraId}`);
      }
    }
  }

  return Array.from(promptKeys)
    .map((promptKey) => {
      const [countryId, eraId] = promptKey.split("|");

      return { countryId, eraId };
    })
    .sort((a, b) => {
      const countrySort = getCountry(a.countryId).name.localeCompare(
        getCountry(b.countryId).name,
      );

      return countrySort || getEra(a.eraId).label.localeCompare(getEra(b.eraId).label);
    });
}
