
import { CropType, CropConfig, ProductType, ProductConfig } from './types';

export const GRID_SIZE = 16;
export const INITIAL_MONEY = 100;
export const TILE_SIZE = 64;

export const CROPS: Record<CropType, CropConfig> = {
  [CropType.CARROT]: {
    name: "Cà rốt",
    seedPrice: 10,
    sellPrice: 18,
    growthTimeMs: 5000,
    color: "#f97316",
    icon: "🥕"
  },
  [CropType.TOMATO]: {
    name: "Cà chua",
    seedPrice: 20,
    sellPrice: 45,
    growthTimeMs: 10000,
    color: "#dc2626",
    icon: "🍅"
  },
  [CropType.PUMPKIN]: {
    name: "Bí ngô",
    seedPrice: 50,
    sellPrice: 120,
    growthTimeMs: 30000,
    color: "#c2410c",
    icon: "🎃"
  }
};

export const PRODUCTS: Record<ProductType, ProductConfig> = {
  [ProductType.PUMPKIN_PIE]: {
    name: "Bánh Bí Ngô",
    sellPrice: 300,
    ingredients: [{ type: CropType.PUMPKIN, count: 2 }, { type: CropType.CARROT, count: 1 }],
    icon: "🥧"
  },
  [ProductType.TOMATO_SOUP]: {
    name: "Súp Cà Chua",
    sellPrice: 150,
    ingredients: [{ type: CropType.TOMATO, count: 3 }],
    icon: "🍲"
  }
};

export const FALLBACK_IMAGES = {
  STORE: "https://via.placeholder.com/200x150?text=Store",
  KITCHEN: "https://via.placeholder.com/200x150?text=Kitchen"
};
