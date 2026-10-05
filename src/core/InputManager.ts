export interface TouchButton {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  isDown: boolean;
  color: string;
}

export class InputManager {
  private static instance: InputManager;
  private keys: Record<string, boolean> = {};

  // 衝刺與重置為一次性觸發緩衝
  private dashBuffer: boolean = false;
  private rewindBuffer: boolean = false;

  // 滑鼠位置（相對於 960x540 邏輯座標）
  public mouseX: number = 480;
  public mouseY: number = 270;
  public isMouseDown: boolean = false;

  // 觸控虛擬搖桿
  public isTouchDevice: boolean = false;
  public joystickActive: boolean = false;
  public joystickOrigin: { x: number; y: number } = { x: 120, y: 440 };
  public joystickCurrent: { x: number; y: number } = { x: 120, y: 440 };
  public joystickVector: { x: number; y: number } = { x: 0, y: 0 };
  private joystickTouchId: number | null = null;

  // 觸控按鈕
  public touchButtons: TouchButton[] = [
    { id: 'dash', label: 'DASH', x: 860, y: 430, radius: 36, isDown: false, color: '#ffe600' },
    { id: 'rewind', label: 'R', x: 770, y: 460, radius: 28, isDown: false, color: '#00f0ff' },
  ];

  private canvas: HTMLCanvasElement | null = null;
  private scaleX: number = 1;
  private scaleY: number = 1;

  public static get(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  public init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.bindKeyboard();
    this.bindMouse();
    this.bindTouch();
  }

  public updateScale(scaleX: number, scaleY: number): void {
    this.scaleX = scaleX;
    this.scaleY = scaleY;
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.code.toLowerCase()] = true;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        this.dashBuffer = true;
      }
      if (e.key.toLowerCase() === 'r') {
        this.rewindBuffer = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this.keys[e.code.toLowerCase()] = false;
    });
  }

  private bindMouse(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas!.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) / this.scaleX;
      this.mouseY = (e.clientY - rect.top) / this.scaleY;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      if (e.button === 2) {
        // 右鍵衝刺
        e.preventDefault();
        this.dashBuffer = true;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private bindTouch(): void {
    if (!this.canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      this.isTouchDevice = true;
      const rect = this.canvas!.getBoundingClientRect();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const tx = (touch.clientX - rect.left) / this.scaleX;
        const ty = (touch.clientY - rect.top) / this.scaleY;

        // 檢查是否命中右側按鈕
        let hitButton = false;
        for (const btn of this.touchButtons) {
          const dx = tx - btn.x;
          const dy = ty - btn.y;
          if (dx * dx + dy * dy <= (btn.radius + 18) * (btn.radius + 18)) {
            btn.isDown = true;
            hitButton = true;
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) {
              navigator.vibrate(25);
            }
            if (btn.id === 'dash') this.dashBuffer = true;
            if (btn.id === 'rewind') this.rewindBuffer = true;
            break;
          }
        }

        // 若不是點擊按鈕，且在螢幕左半邊 (x < 500)，觸發虛擬搖桿
        if (!hitButton && tx < 500 && this.joystickTouchId === null) {
          this.joystickTouchId = touch.identifier;
          this.joystickActive = true;
          this.joystickOrigin = { x: tx, y: ty };
          this.joystickCurrent = { x: tx, y: ty };
          this.joystickVector = { x: 0, y: 0 };
        } else if (!hitButton) {
          // 更新觸控瞄準點
          this.mouseX = tx;
          this.mouseY = ty;
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const rect = this.canvas!.getBoundingClientRect();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          const tx = (touch.clientX - rect.left) / this.scaleX;
          const ty = (touch.clientY - rect.top) / this.scaleY;
          this.joystickCurrent = { x: tx, y: ty };

          const maxDist = 52;
          const deadzone = 5;
          let dx = tx - this.joystickOrigin.x;
          let dy = ty - this.joystickOrigin.y;
          const dist = Math.hypot(dx, dy);

          // 浮動搖桿跟隨機制：若滑動超出範圍，平滑拉近原點以維持精準手感
          if (dist > maxDist) {
            const pull = dist - maxDist;
            this.joystickOrigin.x += (dx / dist) * pull * 0.45;
            this.joystickOrigin.y += (dy / dist) * pull * 0.45;
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
          }

          if (dist < deadzone) {
            this.joystickVector = { x: 0, y: 0 };
          } else {
            // 平滑死區映射與靈敏度加成
            const normalizedDist = Math.min(1.0, ((dist - deadzone) / (maxDist - deadzone)) * 1.12);
            this.joystickVector = {
              x: (dx / dist) * normalizedDist,
              y: (dy / dist) * normalizedDist,
            };
          }
        } else {
          const tx = (touch.clientX - rect.left) / this.scaleX;
          const ty = (touch.clientY - rect.top) / this.scaleY;
          this.mouseX = tx;
          this.mouseY = ty;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.joystickActive = false;
          this.joystickVector = { x: 0, y: 0 };
          this.joystickCurrent = { ...this.joystickOrigin };
        }
        for (const btn of this.touchButtons) {
          btn.isDown = false;
        }
      }
    };

    this.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  }

  // 取得運動向量 (標準化 -1 ~ 1)
  public getMovement(): { x: number; y: number } {
    let dx = 0;
    let dy = 0;

    // 鍵盤輸入
    if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;

    // 虛擬搖桿輸入疊加
    if (this.joystickActive) {
      dx += this.joystickVector.x;
      dy += this.joystickVector.y;
    }

    const length = Math.hypot(dx, dy);
    if (length > 1.0) {
      dx /= length;
      dy /= length;
    }

    return { x: dx, y: dy };
  }

  public consumeDash(): boolean {
    const triggered = this.dashBuffer;
    this.dashBuffer = false;
    return triggered;
  }

  public consumeRewind(): boolean {
    const triggered = this.rewindBuffer;
    this.rewindBuffer = false;
    return triggered;
  }

  public getAimAngle(playerX: number, playerY: number, moveDirX: number, moveDirY: number): number {
    if (this.isTouchDevice && (moveDirX !== 0 || moveDirY !== 0)) {
      return Math.atan2(moveDirY, moveDirX);
    }
    // 滑鼠瞄準
    return Math.atan2(this.mouseY - playerY, this.mouseX - playerX);
  }
}
