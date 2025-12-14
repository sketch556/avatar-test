import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState,
  GameView,
  Plot,
  CropType,
  Inventory,
  ProductType,
} from './types';
import {
  GRID_SIZE,
  INITIAL_MONEY,
  CROPS,
  PRODUCTS,
  TILE_SIZE,
} from './constants';
import { GAME_ASSETS } from './assets';
import { InventoryBar } from './components/InventoryBar';
import { AdvisorModal } from './components/AdvisorModal';

// --- Types ---
interface LoadedSprites {
  idle: HTMLImageElement | null;
  walk: HTMLImageElement | null;
  background: HTMLImageElement | null;
  soil: (HTMLImageElement | null)[]; // 0: Thường, 1: Đã cuốc
}

interface RPGStats {
  luong: number;
  levelMain: number;
  expMain: number;
  chests: any[];
}

interface GamePlot extends Omit<Plot, 'isLocked'> {
  isLocked: boolean;
  isPlowed: boolean;
}

interface ExtendedGameState extends Omit<GameState, 'plots'> {
  plots: GamePlot[];
  playerRPG: RPGStats;
}

interface PlayerState {
  x: number;
  y: number;
  isMoving: boolean;
  frame: number;
  direction: 'left' | 'right';
}

// --- Helper Functions ---
const createInitialPlots = (): GamePlot[] =>
  Array.from({ length: GRID_SIZE }, (_, i) => ({
    id: i,
    isLocked: false,
    crop: null,
    plantedAt: null,
    isWithered: false,
    isPlowed: false,
  }));

const createInitialInventory = (): Inventory => ({
  seeds: { [CropType.CARROT]: 2, [CropType.TOMATO]: 0, [CropType.PUMPKIN]: 0 },
  crops: { [CropType.CARROT]: 0, [CropType.TOMATO]: 0, [CropType.PUMPKIN]: 0 },
  products: { [ProductType.PUMPKIN_PIE]: 0, [ProductType.TOMATO_SOUP]: 0 },
});

const SAVE_KEY = 'HAPPY_FARM_DATA_V1';

export default function App() {
  const [gameState, setGameState] = useState<ExtendedGameState>(() => {
    try {
      const savedData = localStorage.getItem(SAVE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        return {
          money: parsed.money ?? INITIAL_MONEY,
          plots: parsed.plots ?? createInitialPlots(),
          inventory: parsed.inventory ?? createInitialInventory(),
          view: GameView.FARM,
          playerRPG: parsed.playerRPG ?? { luong: 5, levelMain: 1, expMain: 0, chests: [] },
        };
      }
    } catch (error) {
      console.error('Lỗi khi tải save game, dùng mặc định:', error);
    }

    return {
      money: INITIAL_MONEY,
      plots: createInitialPlots(),
      inventory: createInitialInventory(),
      view: GameView.FARM,
      playerRPG: { luong: 5, levelMain: 1, expMain: 0, chests: [] },
    };
  });

  // Auto-save
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
      } catch (e) {
        console.error('Không thể lưu game:', e);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [gameState]);

  const [selectedSeed, setSelectedSeed] = useState<CropType | null>(CropType.CARROT);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [spritesLoaded, setSpritesLoaded] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  const playerRef = useRef<PlayerState>({
    x: 400,
    y: 300,
    isMoving: false,
    frame: 0,
    direction: 'right',
  });

  const keysPressed = useRef<Record<string, boolean>>({});

  const spritesRef = useRef<LoadedSprites>({
    idle: null,
    walk: null,
    background: null,
    soil: [null, null],
  });

  const [interactionLabel, setInteractionLabel] = useState<string | null>(null);

  // --- FIX DPI CANVAS (QUAN TRỌNG) ---
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Kích thước hiển thị (CSS pixels)
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      // Kích thước buffer (device pixels)
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    };

    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  // --- Load ảnh ---
  useEffect(() => {
    const loadImg = (src: string): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });

    const loadSprites = async () => {
      const [idleImg, walkImg, bgImg, soil0, soil1] = await Promise.all([
        loadImg(GAME_ASSETS.player_idle),
        loadImg(GAME_ASSETS.player_walk),
        loadImg(GAME_ASSETS.background),
        loadImg(GAME_ASSETS.soil_normal),
        loadImg(GAME_ASSETS.soil_plowed),
      ]);

      spritesRef.current = {
        idle: idleImg,
        walk: walkImg,
        background: bgImg,
        soil: [soil0, soil1],
      };

      setSpritesLoaded(true);
    };

    loadSprites().catch(console.error);
  }, []);

  // EXP/Level
  const addExp = (amount: number) => {
    setGameState((prev) => {
      let { levelMain, expMain } = prev.playerRPG;
      let newExp = expMain + amount;
      let requiredExp = (levelMain * (levelMain + 1) / 2) * 1000;

      while (newExp >= requiredExp) {
        newExp -= requiredExp;
        levelMain++;
        requiredExp = (levelMain * (levelMain + 1) / 2) * 1000;
      }

      return { ...prev, playerRPG: { ...prev.playerRPG, levelMain, expMain: newExp } };
    });
  };

  const handlePlant = (plotIndex: number) => {
    if (!selectedSeed) return;
    const plot = gameState.plots[plotIndex];
    if (!plot.isPlowed) return;
    if (plot.crop) return;
    if (gameState.inventory.seeds[selectedSeed] <= 0) return;

    setGameState((prev) => {
      const newPlots = [...prev.plots];
      newPlots[plotIndex] = { ...plot, crop: selectedSeed, plantedAt: Date.now() };
      const newInventory = { ...prev.inventory };
      newInventory.seeds[selectedSeed]--;
      return { ...prev, plots: newPlots, inventory: newInventory };
    });
    addExp(5);
  };

  const handleHarvest = (plotIndex: number) => {
    const plot = gameState.plots[plotIndex];
    if (!plot.crop || !plot.plantedAt) return;
    const cropConfig = CROPS[plot.crop];
    const isReady = Date.now() - plot.plantedAt >= cropConfig.growthTimeMs;
    if (!isReady) return;

    setGameState((prev) => {
      const newPlots = [...prev.plots];
      newPlots[plotIndex] = { ...plot, crop: null, plantedAt: null, isPlowed: false };
      const newInventory = { ...prev.inventory };
      if (plot.crop) newInventory.crops[plot.crop]++;
      return { ...prev, plots: newPlots, inventory: newInventory };
    });
    addExp(100);
  };

  const handleSoilInteraction = (plotIndex: number) => {
    setGameState((prev) => {
      const newPlots = [...prev.plots];
      const currentPlot = newPlots[plotIndex];
      newPlots[plotIndex] = { ...currentPlot, isPlowed: !currentPlot.isPlowed };
      return { ...prev, plots: newPlots };
    });
  };

  // Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.code] = false; };

    const handleAction = (e: KeyboardEvent) => {
      if (gameState.view !== GameView.FARM) return;
      if (e.code === 'KeyE') checkInteractions(true, 'E');
      if (e.code === 'Space') checkInteractions(true, 'SPACE');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', handleAction);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', handleAction);
    };
  }, [gameState.view, gameState.plots, selectedSeed, gameState.inventory]);

  const checkInteractions = (execute: boolean, keyType?: 'E' | 'SPACE') => {
    const pX = playerRef.current.x;
    const pY = playerRef.current.y;

    const storeRect = { x: 450, y: 50, w: 200, h: 150 };
    const storeCenter = { x: storeRect.x + storeRect.w / 2, y: storeRect.y + storeRect.h / 2 };
    const plotsStartX = 3 * TILE_SIZE;
    const plotsStartY = 4 * TILE_SIZE;

    let label: string | null = null;

    if (Math.hypot(pX - storeCenter.x, pY - storeCenter.y) < 150) {
      label = 'Nhấn E để vào Cửa Hàng';
      if (execute && keyType === 'E') setGameState((prev) => ({ ...prev, view: GameView.STORE }));
    } else {
      const col = Math.floor((pX - plotsStartX) / TILE_SIZE);
      const row = Math.floor((pY - plotsStartY) / TILE_SIZE);

      if (col >= 0 && col < 4 && row >= 0 && row < 4) {
        const index = row * 4 + col;
        const plot = gameState.plots[index];

        if (plot.crop) {
          const cropInfo = CROPS[plot.crop];
          const isReady = plot.plantedAt && (Date.now() - plot.plantedAt) >= cropInfo.growthTimeMs;
          label = isReady ? 'Nhấn E để Thu hoạch' : 'Đang lớn...';
          if (execute && keyType === 'E' && isReady) handleHarvest(index);
        } else {
          if (!plot.isPlowed) label = 'Space: Cuốc đất';
          else label = 'Space: San phẳng | E: Trồng cây';

          if (execute) {
            if (keyType === 'SPACE') handleSoilInteraction(index);
            if (keyType === 'E' && plot.isPlowed) handlePlant(index);
          }
        }
      }
    }

    setInteractionLabel(label);
  };

  // --- GAME LOOP ---
  const gameLoop = useCallback(() => {
    if (gameState.view !== GameView.FARM) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // UPDATE
    const speed = 4;
    let dx = 0, dy = 0;

    if (keysPressed.current['ArrowUp'] || keysPressed.current['KeyW']) dy -= speed;
    if (keysPressed.current['ArrowDown'] || keysPressed.current['KeyS']) dy += speed;
    if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) dx -= speed;
    if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) dx += speed;

    playerRef.current.x = Math.max(0, Math.min(width, playerRef.current.x + dx));
    playerRef.current.y = Math.max(0, Math.min(height, playerRef.current.y + dy));

    const isMoving = dx !== 0 || dy !== 0;
    playerRef.current.isMoving = isMoving;

    if (dx < 0) playerRef.current.direction = 'left';
    if (dx > 0) playerRef.current.direction = 'right';

    if (isMoving) playerRef.current.frame++;
    else playerRef.current.frame = 0;

    checkInteractions(false);

    // RENDER
    ctx.clearRect(0, 0, width, height);

    // Background
    if (spritesRef.current.background) {
      ctx.drawImage(spritesRef.current.background, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#5d8e68';
      ctx.fillRect(0, 0, width, height);
    }

    // Plots
    const plotsStartX = 3 * TILE_SIZE;
    const plotsStartY = 4 * TILE_SIZE;

    gameState.plots.forEach((plot, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = plotsStartX + col * TILE_SIZE;
      const y = plotsStartY + row * TILE_SIZE;

      const soilSprite = plot.isPlowed ? spritesRef.current.soil[1] : spritesRef.current.soil[0];

      if (soilSprite) {
        ctx.drawImage(soilSprite, x, y, TILE_SIZE, TILE_SIZE);
      } else {
        if (!plot.isPlowed) {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        } else {
          ctx.fillStyle = '#6b4423';
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
      }

      if (plot.crop && plot.plantedAt) {
        const info = CROPS[plot.crop];
        const elapsed = Date.now() - plot.plantedAt;
        const progress = Math.min(1, elapsed / info.growthTimeMs);

        ctx.fillStyle = info.color;
        const size = (TILE_SIZE / 2) * (0.3 + 0.6 * progress);
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, size, 0, Math.PI * 2);
        ctx.fill();

        if (progress >= 1) {
          ctx.font = '24px Arial';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(info.icon, x + TILE_SIZE / 2, y + TILE_SIZE / 2);
        }
      }
    });

    // Store
    ctx.fillStyle = '#a1887f';
    ctx.fillRect(450, 50, 200, 150);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '16px Arial';
    ctx.fillText('Cửa Hàng', 550, 125);

    // Player
    if (spritesLoaded) {
      const { x: pX, y: pY, frame, direction } = playerRef.current;

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(pX, pY + TILE_SIZE / 2 - 4, TILE_SIZE / 2.5, TILE_SIZE / 5, 0, 0, Math.PI * 2);
      ctx.fill();

      let spriteToDraw = spritesRef.current.idle;
      if (playerRef.current.isMoving) {
        const animationStep = Math.floor(frame / 10) % 2;
        spriteToDraw = animationStep === 0 ? spritesRef.current.idle : spritesRef.current.walk;
      }

      if (spriteToDraw) {
        const drawX = pX - TILE_SIZE / 2;
        const drawY = pY - TILE_SIZE / 2;

        ctx.save();
        if (direction === 'left') {
          ctx.translate(drawX + TILE_SIZE, drawY);
          ctx.scale(-1, 1);
          ctx.drawImage(spriteToDraw, 0, 0, TILE_SIZE, TILE_SIZE);
        } else {
          ctx.drawImage(spriteToDraw, drawX, drawY, TILE_SIZE, TILE_SIZE);
        }
        ctx.restore();
      }
    }

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Nông Dân', playerRef.current.x, playerRef.current.y - TILE_SIZE / 2 - 5);

    // HUD (giữ nguyên, nhưng giờ không còn bị bể)
    const hudX = 10, hudY = 10, hudW = 180, hudH = 85;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(hudX, hudY, hudW, hudH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(hudX, hudY, hudW, hudH);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Nông Dân (Lv.${gameState.playerRPG.levelMain})`, hudX + 10, hudY + 10);

    const reqExp = (gameState.playerRPG.levelMain * (gameState.playerRPG.levelMain + 1) / 2) * 1000;
    const expPercent = Math.min(1, gameState.playerRPG.expMain / reqExp);

    ctx.fillStyle = '#555';
    ctx.fillRect(hudX + 10, hudY + 30, hudW - 20, 6);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(hudX + 10, hudY + 30, (hudW - 20) * expPercent, 6);

    ctx.font = '13px Arial';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`Xu: ${gameState.money}$`, hudX + 10, hudY + 45);
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`Lượng: ${gameState.playerRPG.luong}`, hudX + 10, hudY + 65);

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState.view, gameState.plots, gameState.money, gameState.playerRPG, spritesLoaded]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameLoop]);

  // Actions mua/bán/nấu
  const buySeed = (type: CropType) => {
    const price = CROPS[type].seedPrice;
    if (gameState.money >= price) {
      setGameState((prev) => ({
        ...prev,
        money: prev.money - price,
        inventory: { ...prev.inventory, seeds: { ...prev.inventory.seeds, [type]: prev.inventory.seeds[type] + 1 } },
      }));
    }
  };

  const sellCrop = (type: CropType) => {
    if (gameState.inventory.crops[type] > 0) {
      setGameState((prev) => ({
        ...prev,
        money: prev.money + CROPS[type].sellPrice,
        inventory: { ...prev.inventory, crops: { ...prev.inventory.crops, [type]: prev.inventory.crops[type] - 1 } },
      }));
    }
  };

  const sellProduct = (type: ProductType) => {
    if (gameState.inventory.products[type] > 0) {
      setGameState((prev) => ({
        ...prev,
        money: prev.money + PRODUCTS[type].sellPrice,
        inventory: { ...prev.inventory, products: { ...prev.inventory.products, [type]: prev.inventory.products[type] - 1 } },
      }));
    }
  };

  const cookProduct = (type: ProductType) => {
    const recipe = PRODUCTS[type];
    const canCook = recipe.ingredients.every((ing) => gameState.inventory.crops[ing.type] >= ing.count);
    if (!canCook) return;

    setGameState((prev) => {
      const newInventory = { ...prev.inventory };
      recipe.ingredients.forEach((ing) => { newInventory.crops[ing.type] -= ing.count; });
      newInventory.products[type]++;
      return { ...prev, inventory: newInventory };
    });
    addExp(200);
  };

  if (!spritesLoaded) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-stone-900 text-white">
        <h1 className="text-2xl animate-pulse">Đang tải tài nguyên game...</h1>
      </div>
    );
  }

  const renderStore = () => (
    <div className="absolute inset-0 z-50 bg-slate-900/95 p-6 pt-20 overflow-y-auto pb-32">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setGameState((p) => ({ ...p, view: GameView.FARM }))}
          className="mb-4 text-white hover:text-green-400"
        >
          ← Quay lại nông trại
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-yellow-400">Cửa Hàng Hạt Giống</h2>
            <p className="text-stone-300">Mua hạt giống để trồng, bán nông sản để kiếm lời!</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-stone-700 p-6 rounded-xl shadow-lg border border-stone-600">
            <h3 className="text-xl font-bold mb-4 text-green-400 border-b border-stone-600 pb-2">Mua Hạt Giống</h3>
            <div className="space-y-4">
              {Object.values(CropType).map((type) => (
                <div key={type} className="flex justify-between items-center bg-stone-800 p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{CROPS[type].icon}</span>
                    <div>
                      <div className="font-bold">{CROPS[type].name}</div>
                      <div className="text-xs text-stone-400">Lớn trong {CROPS[type].growthTimeMs / 1000}s</div>
                    </div>
                  </div>
                  <button
                    onClick={() => buySeed(type)}
                    disabled={gameState.money < CROPS[type].seedPrice}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:bg-stone-600 text-white px-4 py-2 rounded font-bold"
                  >
                    ${CROPS[type].seedPrice}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-stone-700 p-6 rounded-xl shadow-lg border border-stone-600">
            <h3 className="text-xl font-bold mb-4 text-yellow-400 border-b border-stone-600 pb-2">Bán Nông Sản</h3>
            <div className="space-y-4">
              {Object.values(CropType).map((type) => (
                <div key={type} className="flex justify-between items-center bg-stone-800 p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{CROPS[type].icon}</span>
                    <div>
                      <div className="font-bold">{CROPS[type].name}</div>
                      <div className="text-xs text-stone-400">Kho: {gameState.inventory.crops[type]}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => sellCrop(type)}
                    disabled={gameState.inventory.crops[type] <= 0}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:bg-stone-600 text-white px-4 py-2 rounded font-bold"
                  >
                    Bán ${CROPS[type].sellPrice}
                  </button>
                </div>
              ))}

              {Object.values(ProductType).map((type) => (
                <div key={type} className="flex justify-between items-center bg-stone-800 p-3 rounded-lg border border-yellow-500/30">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{PRODUCTS[type].icon}</span>
                    <div>
                      <div className="font-bold text-yellow-200">{PRODUCTS[type].name}</div>
                      <div className="text-xs text-stone-400">Kho: {gameState.inventory.products[type]}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => sellProduct(type)}
                    disabled={gameState.inventory.products[type] <= 0}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:bg-stone-600 text-white px-4 py-2 rounded font-bold"
                  >
                    Bán ${PRODUCTS[type].sellPrice}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-screen h-screen overflow-hidden font-sans bg-[#5d8e68] relative">
      {/* canvas đặt absolute để không bị flex/layout ảnh hưởng */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

      {gameState.view === GameView.FARM && interactionLabel && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full animate-bounce pointer-events-none z-50">
          {interactionLabel}
        </div>
      )}

      {gameState.view === GameView.FARM && (
        <div className="absolute left-4 z-10 bg-stone-800/80 p-2 rounded-lg flex gap-4 backdrop-blur-sm border border-stone-600" style={{ top: '100px' }}>
          {Object.values(CropType).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedSeed(type)}
              className={`
                p-2 rounded-lg flex flex-col items-center gap-1 min-w-[60px] transition-colors
                ${selectedSeed === type ? 'bg-green-600 ring-2 ring-white' : 'bg-stone-700 hover:bg-stone-600'}
              `}
            >
              <span className="text-2xl">{CROPS[type].icon}</span>
              <span className="text-[10px] font-bold text-stone-300">{gameState.inventory.seeds[type]}</span>
            </button>
          ))}
          <div className="border-l border-stone-600 pl-4 flex flex-col justify-center text-xs text-stone-400">
            <div>Di chuyển: <b>WASD</b></div>
            <div>Thao tác: <b>E / SPACE</b></div>
          </div>
        </div>
      )}

      {gameState.view === GameView.STORE && renderStore()}

      <InventoryBar gameState={gameState} onOpenAdvisor={() => setShowAdvisor(true)} />
      {showAdvisor && <AdvisorModal gameState={gameState} onClose={() => setShowAdvisor(false)} />}
    </div>
  );
}
