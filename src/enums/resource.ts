export enum OtherResourceType {
  Mod = "mod",
  World = "world",
  ResourcePack = "resourcepack",
  ShaderPack = "shader",
  DataPack = "datapack",
  ModPack = "modpack",
}

export enum OtherResourceSource {
  CurseForge = "CurseForge",
  Modrinth = "Modrinth",
}

export enum DependencyType {
  Required = "required",
  Optional = "optional",
  Incompatible = "incompatible",
  Embedded = "embedded",
  Tool = "tool",
  Include = "include",
}

export const modTagList = {
  CurseForge: {
    All: ["All"],
    "Adventure and RPG": ["Armor, Tools, and Weapons", "Mobs"],
    Farming: ["Food", "Forestry"],
    Technology: [
      "Automation",
      "Buildcraft",
      "Energy",
      "Energy, Fluid, and Item Transport",
      "Genetics",
      "Integrated Dynamics",
      "Processing",
      "Redstone",
      "Storage",
    ],
    Magic: ["Blood Magic"],
    World: [
      "Biomes",
      "Dimensions",
      "Galacticraft",
      "Ores and Resources",
      "Player Transport",
      "Skyblock",
      "World Gen",
      "Structures",
    ],
    Auxiliary: [
      "Performance",
      "Bug Fixes",
      "Map and Information",
      "API and Library",
      "Education",
      "Server Utility",
      "Twitch Integration",
      "Utility & QoL",
    ],
    Addons: ["KubeJS"],
    Miscellaneous: [
      "MCreator",
      "Cosmetic",
      "Twilight Forest",
      "Create",
      "Applied Energistics 2",
      "Industrial Craft",
      "Thermal Expansion",
      "Tinker's Construct",
      "Thaumcraft",
    ],
  },
  Modrinth: {
    All: ["All"],
    adventure: ["equipment", "cursed", "mobs", "magic"],
    utility: [
      "decoration",
      "economy",
      "food",
      "game-mechanics",
      "library",
      "management",
      "minigame",
      "optimization",
      "social",
    ],
    technology: ["worldgen", "storage", "transportation"],
  },
};

export const worldTagList = {
  CurseForge: {
    All: ["All"],
    Types: [
      "Adventure",
      "Creation",
      "Game Map",
      "Modded World",
      "Parkour",
      "Puzzle",
      "Survival",
    ],
  },
  Modrinth: [],
};

export const resourcePackTagList = {
  CurseForge: {
    All: ["All"],
    Resolution: ["16x", "32x", "64x", "128x", "256x", "512x and Higher"],
    Styles: [
      "Animated",
      "Medieval",
      "Miscellaneous",
      "Mod Support",
      "Modern",
      "Photo Realistic",
      "Steampunk",
      "Traditional",
    ],
    Special: ["Data Packs", "Font Packs"],
  },
  Modrinth: {
    All: ["All"],
    Resolution: ["8x-", "16x", "32x", "64x", "128x", "256x", "512x+"],
    Styles: [
      "audio",
      "blocks",
      "core-shaders",
      "entities",
      "environment",
      "equipment",
      "fonts",
      "gui",
      "items",
      "locale",
      "models",
      "combat",
      "cursed",
      "decoration",
      "modded",
      "realistic",
      "simplistic",
      "themed",
      "tweaks",
      "utility",
      "vanilla-like",
    ],
  },
};

export const shaderPackTagList = {
  CurseForge: {
    All: ["All"],
    Styles: ["Fantasy", "Realistic", "Vanilla"],
  },
  Modrinth: {
    All: ["All"],
    Styles: [
      "cartoon",
      "cursed",
      "fantasy",
      "realistic",
      "semi-realistic",
      "vanilla-like",
      "atmosphere",
      "bloom",
      "colored-lighting",
      "foliage",
      "path-tracing",
      "pbr",
      "reflections",
      "shadows",
      "potato",
    ],
    performance: ["low", "medium", "high", "screenshot"],
  },
};

export const datapackTagList = {
  CurseForge: {
    All: ["All"],
    Styles: [
      "Magic",
      "Miscellaneous",
      "Fantasy",
      "Mod Support",
      "Tech",
      "Library",
      "Utility",
      "Adventure",
    ],
  },
  Modrinth: {
    All: ["All"],
    styles: [
      "adventure",
      "cursed",
      "decoration",
      "economy",
      "equipment",
      "food",
      "game-mechanics",
      "library",
      "magic",
      "management",
      "minigame",
      "mobs",
      "optimization",
      "social",
      "storage",
      "technology",
      "transportation",
      "utility",
      "worldgen",
    ],
  },
};

export const modpackTagList = {
  CurseForge: {
    All: ["All"],
    Styles: [
      "Adventure and RPG",
      "Combat / PvP",
      "Exploration",
      "Extra Large",
      "FTB Official Pack",
      "Hardcore",
      "Horror",
      "Magic",
      "Map Based",
      "Mini Game",
      "Multiplayer",
      "Quests",
      "Sci-Fi",
      "Skyblock",
      "Small / Light",
      "Tech",
      "Vanilla+",
    ],
  },
  Modrinth: {
    All: ["All"],
    styles: [
      "adventure",
      "challenging",
      "combat",
      "kitchen-sink",
      "lightweight",
      "magic",
      "multiplayer",
      "optimization",
      "quests",
      "technology",
    ],
  },
};

export const sortByLists = {
  CurseForge: [
    "Popularity",
    "A-Z",
    "Latest update",
    "Creation date",
    "Total downloads",
  ],
  Modrinth: ["relevance", "downloads", "follows", "updated", "newest"],
};
