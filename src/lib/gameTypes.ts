export type Confederation = "AFC" | "CAF" | "CONCACAF" | "CONMEBOL" | "OFC" | "UEFA";

export type RosterPosition = "GK" | "LB" | "CB" | "RB" | "CM" | "LW" | "ST" | "RW";

export type RolePosition =
  | RosterPosition
  | "AM"
  | "CAM"
  | "CDM"
  | "CF"
  | "DF"
  | "DM"
  | "FW"
  | "LF"
  | "LM"
  | "MF"
  | "RF"
  | "RM"
  | "LWB"
  | "RWB"
  | "SS"
  | "SW";

export type Country = {
  id: string;
  name: string;
  confederation: Confederation;
};

export type Era = {
  id: string;
  label: string;
  worldCupYears: number[];
};

export type RosterSlot = {
  id: string;
  label: RosterPosition;
  playerId: string | null;
};

export type Player = {
  id: string;
  name: string;
  countryId: string;
  worldCupYears: number[];
  rosterSlots: RosterPosition[];
  roleTags: RolePosition[];
  rating: number;
  worldCupNote: string;
};

export type DraftPrompt = {
  countryId: string;
  eraId: string;
};
