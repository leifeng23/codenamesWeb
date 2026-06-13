import type { Universe, WordCategory } from "./types";

export interface WordArchiveDefinition {
  universe: Universe;
  label: string;
  categories: WordCategory[];
}

export interface WordCategoryDefinition {
  category: WordCategory;
  universe: Universe;
  label: string;
  shortLabel: string;
  sheet: "Cosmere" | "Cytonic" | "QQFriends";
  textField: string;
  noteField: string;
}

export const WORD_CATEGORIES: WordCategoryDefinition[] = [
  {
    category: "cosmere_characters",
    universe: "cosmere",
    label: "三界宙人物",
    shortLabel: "人物",
    sheet: "Cosmere",
    textField: "characters",
    noteField: "characters_EN"
  },
  {
    category: "cosmere_culture",
    universe: "cosmere",
    label: "三界宙文化",
    shortLabel: "文化",
    sheet: "Cosmere",
    textField: "culture",
    noteField: "culture_EN"
  },
  {
    category: "cosmere_lifeforms",
    universe: "cosmere",
    label: "三界宙生命形式",
    shortLabel: "生命形式",
    sheet: "Cosmere",
    textField: "lifeforms",
    noteField: "lifeforms_EN"
  },
  {
    category: "cosmere_locations",
    universe: "cosmere",
    label: "三界宙地点",
    shortLabel: "地点",
    sheet: "Cosmere",
    textField: "locations",
    noteField: "locations_EN"
  },
  {
    category: "cosmere_magic",
    universe: "cosmere",
    label: "三界宙魔法",
    shortLabel: "魔法",
    sheet: "Cosmere",
    textField: "magic",
    noteField: "magic_EN"
  },
  {
    category: "cosmere_object_material",
    universe: "cosmere",
    label: "三界宙物品与材料",
    shortLabel: "物品与材料",
    sheet: "Cosmere",
    textField: "objectAndMaterial",
    noteField: "objectAndMaterial_EN"
  },
  {
    category: "cytonic_characters",
    universe: "cytonic",
    label: "夺取群星人物",
    shortLabel: "人物",
    sheet: "Cytonic",
    textField: "character",
    noteField: "character_EN"
  },
  {
    category: "cytonic_spots",
    universe: "cytonic",
    label: "夺取群星地点",
    shortLabel: "地点",
    sheet: "Cytonic",
    textField: "spot",
    noteField: "spot_EN"
  },
  {
    category: "cytonic_concepts",
    universe: "cytonic",
    label: "夺取群星概念",
    shortLabel: "概念",
    sheet: "Cytonic",
    textField: "concept",
    noteField: "concept_EN"
  },
  {
    category: "qq_friends",
    universe: "qq",
    label: "群友",
    shortLabel: "群友",
    sheet: "QQFriends",
    textField: "mainTitle",
    noteField: "remark"
  }
];

export const WORD_CATEGORY_LABELS = Object.fromEntries(
  WORD_CATEGORIES.map((definition) => [definition.category, definition.label])
) as Record<WordCategory, string>;

export const WORD_CATEGORY_SHORT_LABELS = Object.fromEntries(
  WORD_CATEGORIES.map((definition) => [definition.category, definition.shortLabel])
) as Record<WordCategory, string>;

export const WORD_ARCHIVES: WordArchiveDefinition[] = [
  {
    universe: "cosmere",
    label: "三界宙",
    categories: WORD_CATEGORIES.filter((definition) => definition.universe === "cosmere").map(
      (definition) => definition.category
    )
  },
  {
    universe: "cytonic",
    label: "夺取群星",
    categories: WORD_CATEGORIES.filter((definition) => definition.universe === "cytonic").map(
      (definition) => definition.category
    )
  },
  {
    universe: "qq",
    label: "群友",
    categories: WORD_CATEGORIES.filter((definition) => definition.universe === "qq").map(
      (definition) => definition.category
    )
  }
];

export const ALL_WORD_CATEGORIES = WORD_CATEGORIES.map((definition) => definition.category);
