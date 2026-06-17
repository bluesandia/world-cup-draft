import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const HARD_CAP = 3000;
const SQUADS_URL =
  "https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv/squads.csv";
const APPEARANCES_URL =
  "https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv/player_appearances.csv";
const TEAMS_URL =
  "https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv/teams.csv";

const LOCAL_SQUADS_PATH = "/private/tmp/worldcup_squads.csv";
const LOCAL_APPEARANCES_PATH = "/private/tmp/worldcup_player_appearances.csv";
const LOCAL_TEAMS_PATH = "/private/tmp/worldcup_teams.csv";

const codeIdOverrides = {
  ARG: "arg",
  BEL: "bel",
  BRA: "bra",
  CHL: "chi",
  CMR: "cam",
  CRI: "cri",
  CSK: "csk",
  DEU: "ger",
  ENG: "eng",
  ESP: "esp",
  FRA: "fra",
  GHA: "gha",
  HRV: "cro",
  HUN: "hun",
  ITA: "ita",
  JPN: "jpn",
  KOR: "kor",
  MAR: "mar",
  MEX: "mex",
  NGA: "nga",
  NLD: "ned",
  POL: "pol",
  PRT: "por",
  PRY: "par",
  SAU: "ksa",
  SEN: "sen",
  SUN: "sun",
  SWE: "swe",
  URY: "uru",
  USA: "usa",
};

const positionSlotMap = {
  GK: ["GK"],
  CB: ["CB"],
  SW: ["CB"],
  LB: ["LB"],
  LWB: ["LB"],
  RB: ["RB"],
  RWB: ["RB"],
  DF: ["CB", "LB", "RB"],
  CM: ["CM"],
  AM: ["CM"],
  CAM: ["CM"],
  DM: ["CM"],
  CDM: ["CM"],
  MF: ["CM"],
  LM: ["LW", "CM"],
  RM: ["RW", "CM"],
  LW: ["LW", "ST"],
  LF: ["LW", "ST"],
  RW: ["RW", "ST"],
  RF: ["RW", "ST"],
  CF: ["ST"],
  SS: ["ST"],
  ST: ["ST"],
  FW: ["ST", "LW", "RW"],
};

const confederationMap = {
  AFC: "AFC",
  CAF: "CAF",
  CONCACAF: "CONCACAF",
  CONMEBOL: "CONMEBOL",
  OFC: "OFC",
  UEFA: "UEFA",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some(Boolean));
}

function rowsToObjects(text) {
  const rows = parseCsv(text);
  const headers = rows[0];

  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

async function readLocalOrFetch(localPath, url) {
  if (existsSync(localPath)) {
    return readFile(localPath, "utf8");
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function countryIdFromCode(teamCode) {
  return codeIdOverrides[teamCode] ?? teamCode.toLowerCase();
}

function playerName(row) {
  if (!row.given_name || row.given_name === "not applicable") {
    return row.family_name;
  }

  return `${row.given_name} ${row.family_name}`;
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function render(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => (typeof item === "string" ? JSON.stringify(item) : String(item))).join(", ")}]`;
  }

  return JSON.stringify(value);
}

function candidateScore(candidate) {
  const appearanceScore = Math.min(candidate.appearances, 18);
  const tournamentScore = Math.min(candidate.worldCupYears.length * 2, 10);
  const detailScore = candidate.hasDetailedPosition ? 4 : 0;

  return appearanceScore + tournamentScore + detailScore;
}

function ratingFor(candidate) {
  return Math.min(88, 72 + Math.floor(candidateScore(candidate) / 2));
}

function noteFor(candidate) {
  const years = candidate.worldCupYears.join(", ");

  return `World Cup squad player for ${candidate.countryName} in ${years}.`;
}

function getEraId(year) {
  if (year < 1950) return "1930s";
  return `${Math.floor(year / 10) * 10}s`;
}

async function main() {
  const [squadsText, appearancesText, teamsText, curatedText] = await Promise.all([
    readLocalOrFetch(LOCAL_SQUADS_PATH, SQUADS_URL),
    readLocalOrFetch(LOCAL_APPEARANCES_PATH, APPEARANCES_URL),
    readLocalOrFetch(LOCAL_TEAMS_PATH, TEAMS_URL),
    readFile("src/data/curatedPlayers.ts", "utf8"),
  ]);

  const curatedPlayers = eval(
    curatedText.match(/export const players: Player\[\] = (\[[\s\S]*\]);/)[1],
  );
  const squads = rowsToObjects(squadsText).filter((row) =>
    row.tournament_name.includes("Men"),
  );
  const appearances = rowsToObjects(appearancesText).filter((row) =>
    row.tournament_name.includes("Men"),
  );
  const teams = rowsToObjects(teamsText).filter((row) => row.mens_team === "1");

  const countryByCode = new Map();
  for (const team of teams) {
    const id = countryIdFromCode(team.team_code);
    const confederation = confederationMap[team.confederation_code] ?? "UEFA";
    const existing = countryByCode.get(id);

    if (!existing || existing.name.startsWith("West ")) {
      countryByCode.set(id, {
        id,
        name: team.team_name,
        confederation,
      });
    }
  }

  const detailedPositions = new Map();
  const appearanceCounts = new Map();
  for (const row of appearances) {
    const key = `${row.player_id}|${row.team_code}`;
    const positions = detailedPositions.get(key) ?? new Set();
    positions.add(row.position_code);
    detailedPositions.set(key, positions);
    appearanceCounts.set(key, (appearanceCounts.get(key) ?? 0) + 1);
  }

  const sourcePlayers = new Map();
  for (const row of squads) {
    const key = `${row.player_id}|${row.team_code}`;
    const year = Number(row.tournament_id.replace("WC-", ""));
    const countryId = countryIdFromCode(row.team_code);
    const player = sourcePlayers.get(key) ?? {
      sourceKey: key,
      sourcePlayerId: row.player_id,
      name: playerName(row),
      countryId,
      countryName: row.team_name,
      worldCupYears: [],
      squadPositionCodes: [],
      detailedPositionCodes: [],
      appearances: appearanceCounts.get(key) ?? 0,
      hasDetailedPosition: false,
    };

    player.worldCupYears.push(year);
    player.squadPositionCodes.push(row.position_code);
    sourcePlayers.set(key, player);
  }

  for (const player of sourcePlayers.values()) {
    const detailed = [...(detailedPositions.get(player.sourceKey) ?? [])];
    player.worldCupYears = unique(player.worldCupYears).sort((a, b) => a - b);
    player.squadPositionCodes = unique(player.squadPositionCodes);
    player.detailedPositionCodes = detailed;
    player.hasDetailedPosition = detailed.length > 0;
    player.roleTags = unique([...detailed, ...player.squadPositionCodes]);
    player.rosterSlots = unique(
      player.roleTags.flatMap((position) => positionSlotMap[position] ?? []),
    );
  }

  const curatedByIdentity = new Map();
  const mergedPlayers = curatedPlayers.map((player) => {
    curatedByIdentity.set(`${player.countryId}|${normalizeText(player.name)}`, player.id);
    return {
      ...player,
      worldCupYears: unique(player.worldCupYears).sort((a, b) => a - b),
      rosterSlots: unique(player.rosterSlots),
      roleTags: unique(player.roleTags),
    };
  });
  const mergedById = new Map(mergedPlayers.map((player) => [player.id, player]));

  const newCandidates = [];
  for (const sourcePlayer of sourcePlayers.values()) {
    if (sourcePlayer.rosterSlots.length === 0) {
      continue;
    }

    const identity = `${sourcePlayer.countryId}|${normalizeText(sourcePlayer.name)}`;
    const curatedId = curatedByIdentity.get(identity);

    if (curatedId) {
      const player = mergedById.get(curatedId);
      player.worldCupYears = unique([
        ...player.worldCupYears,
        ...sourcePlayer.worldCupYears,
      ]).sort((a, b) => a - b);
      player.roleTags = unique([...player.roleTags, ...sourcePlayer.roleTags]);
      continue;
    }

    newCandidates.push({
      id: `wc-${sourcePlayer.countryId}-${sourcePlayer.sourcePlayerId.toLowerCase()}`,
      name: sourcePlayer.name,
      countryId: sourcePlayer.countryId,
      worldCupYears: sourcePlayer.worldCupYears,
      rosterSlots: sourcePlayer.rosterSlots,
      roleTags: sourcePlayer.roleTags,
      rating: ratingFor(sourcePlayer),
      worldCupNote: noteFor(sourcePlayer),
      score: candidateScore(sourcePlayer),
    });
  }

  const candidatesByGroup = new Map();
  for (const candidate of newCandidates) {
    for (const year of candidate.worldCupYears) {
      const key = `${candidate.countryId}|${getEraId(year)}`;
      const group = candidatesByGroup.get(key) ?? [];
      group.push(candidate);
      candidatesByGroup.set(key, group);
    }
  }

  for (const group of candidatesByGroup.values()) {
    group.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  const selectedIds = new Set(mergedPlayers.map((player) => player.id));
  const selected = [];
  const groups = [...candidatesByGroup.entries()].sort(([a], [b]) => a.localeCompare(b));

  while (mergedPlayers.length + selected.length < HARD_CAP) {
    let addedThisRound = false;

    for (const [, group] of groups) {
      while (group.length > 0 && selectedIds.has(group[0].id)) {
        group.shift();
      }

      if (group.length === 0) {
        continue;
      }

      const candidate = group.shift();
      selectedIds.add(candidate.id);
      selected.push(candidate);
      addedThisRound = true;

      if (mergedPlayers.length + selected.length >= HARD_CAP) {
        break;
      }
    }

    if (!addedThisRound) {
      break;
    }
  }

  const generatedPlayers = [...mergedPlayers, ...selected].map(({ score, ...player }) => player);

  const countries = [...countryByCode.values()].sort((a, b) => a.name.localeCompare(b.name));
  const countryLines = [
    'import type { Country } from "@/lib/gameTypes";',
    "",
    "export const countries: Country[] = [",
  ];

  for (const country of countries) {
    countryLines.push(
      `  { id: ${JSON.stringify(country.id)}, name: ${JSON.stringify(country.name)}, confederation: ${JSON.stringify(country.confederation)} },`,
    );
  }

  countryLines.push("];", "");

  const playerLines = [
    'import type { Player } from "@/lib/gameTypes";',
    "",
    "export const PLAYER_DATA_HARD_CAP = 3000;",
    "",
    "// Generated by scripts/import-worldcup-data.mjs from:",
    "// https://github.com/jfjelstul/worldcup",
    "// Source database: © 2023 Joshua C. Fjelstul, Ph.D., CC-BY-SA 4.0.",
    "// Modifications: filtered to men's tournaments, normalized positions, generated ratings/notes, merged curated overrides.",
    "export const players: Player[] = [",
  ];

  for (const player of generatedPlayers) {
    playerLines.push("  {");
    for (const key of [
      "id",
      "name",
      "countryId",
      "worldCupYears",
      "rosterSlots",
      "roleTags",
      "rating",
      "worldCupNote",
    ]) {
      playerLines.push(`    ${key}: ${render(player[key])},`);
    }
    playerLines.push("  },");
  }

  playerLines.push("];", "");

  await Promise.all([
    writeFile("src/data/countries.ts", countryLines.join("\n")),
    writeFile("src/data/players.ts", playerLines.join("\n")),
  ]);

  console.log(
    JSON.stringify(
      {
        hardCap: HARD_CAP,
        curatedPlayers: curatedPlayers.length,
        sourceSquadPlayers: sourcePlayers.size,
        generatedPlayers: generatedPlayers.length,
        countries: countries.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
