import { Game } from './core/Game';
import { GAME_CONFIG } from './config/constants';
import { InputManager } from './core/InputManager';

function init(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element #game-canvas not found!');
    return;
  }

  // 設置邏輯解析度
  canvas.width = GAME_CONFIG.CANVAS_WIDTH;
  canvas.height = GAME_CONFIG.CANVAS_HEIGHT;

  function resize(): void {
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    // 計算等比縮放尺寸 (16:9)
    const targetRatio = GAME_CONFIG.CANVAS_WIDTH / GAME_CONFIG.CANVAS_HEIGHT;
    const windowRatio = windowW / windowH;

    let displayW = windowW;
    let displayH = windowH;

    if (windowRatio > targetRatio) {
      displayW = windowH * targetRatio;
      displayH = windowH;
    } else {
      displayW = windowW;
      displayH = windowW / targetRatio;
    }

    canvas.style.width = `${Math.floor(displayW)}px`;
    canvas.style.height = `${Math.floor(displayH)}px`;

    const scaleX = displayW / GAME_CONFIG.CANVAS_WIDTH;
    const scaleY = displayH / GAME_CONFIG.CANVAS_HEIGHT;
    InputManager.get().updateScale(scaleX, scaleY);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  const game = new Game(canvas);
  game.start();
}

window.addEventListener('DOMContentLoaded', init);
