export interface LegacyExcelCategoryDefinition {
  archiveName: string;
  categoryName: string;
  sheet: "Cosmere" | "Cytonic" | "QQFriends";
  textField: string;
  noteField: string;
}

export const LEGACY_EXCEL_CATEGORIES: LegacyExcelCategoryDefinition[] = [
  {
    archiveName: "三界宙",
    categoryName: "人物",
    sheet: "Cosmere",
    textField: "characters",
    noteField: "characters_EN"
  },
  {
    archiveName: "三界宙",
    categoryName: "文化",
    sheet: "Cosmere",
    textField: "culture",
    noteField: "culture_EN"
  },
  {
    archiveName: "三界宙",
    categoryName: "生命形式",
    sheet: "Cosmere",
    textField: "lifeforms",
    noteField: "lifeforms_EN"
  },
  {
    archiveName: "三界宙",
    categoryName: "地点",
    sheet: "Cosmere",
    textField: "locations",
    noteField: "locations_EN"
  },
  {
    archiveName: "三界宙",
    categoryName: "魔法",
    sheet: "Cosmere",
    textField: "magic",
    noteField: "magic_EN"
  },
  {
    archiveName: "三界宙",
    categoryName: "物品与材料",
    sheet: "Cosmere",
    textField: "objectAndMaterial",
    noteField: "objectAndMaterial_EN"
  },
  {
    archiveName: "赛托宙",
    categoryName: "人物",
    sheet: "Cytonic",
    textField: "character",
    noteField: "character_EN"
  },
  {
    archiveName: "赛托宙",
    categoryName: "地点",
    sheet: "Cytonic",
    textField: "spot",
    noteField: "spot_EN"
  },
  {
    archiveName: "赛托宙",
    categoryName: "概念",
    sheet: "Cytonic",
    textField: "concept",
    noteField: "concept_EN"
  },
  {
    archiveName: "三界宙旅者群友",
    categoryName: "群友",
    sheet: "QQFriends",
    textField: "mainTitle",
    noteField: "remark"
  }
];
