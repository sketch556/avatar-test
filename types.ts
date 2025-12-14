export enum CropType {
  CARROT = 'CARROT',
  TOMATO = 'TOMATO',
  PUMPKIN = 'PUMPKIN',
}

export enum ProductType {
  PUMPKIN_PIE = 'PUMPKIN_PIE',
  TOMATO_SOUP = 'TOMATO_SOUP',
}

export enum GameView {
  FARM = 'FARM',
  STORE = 'STORE',
  KITCHEN = 'KITCHEN',
}

export interface CropConfig {
  name: string;
  seedPrice: number;
  sellPrice: number;
  growthTimeMs: number; // Time in milliseconds
  color: string;
  icon: string;
}

export interface ProductConfig {
  name: string;
  sellPrice: number;
  ingredients: { type: CropType; count: number }[];
  icon: string;
}

export interface Plot {
  id: number;
  isLocked: boolean;
  crop: CropType | null;
  plantedAt: number | null; // Timestamp
  isWithered: boolean;
}

export interface Inventory {
  seeds: Record<CropType, number>;
  crops: Record<CropType, number>;
  products: Record<ProductType, number>;
}

export interface GameState {
  money: number;
  plots: Plot[];
  inventory: Inventory;
  view: GameView;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}