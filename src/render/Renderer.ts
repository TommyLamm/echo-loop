import { GAME_CONFIG } from '../config/constants';
import { ActiveGhostState } from '../core/GhostPlayer';
import { StageManager } from '../core/StageManager';
import { ParticleSystem } from '../core/ParticleSystem';
import { InputManager } from '../core/InputManager';
import { GameState, StageSaveData } from '../types';
import { LEVELS } from '../config/levels';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width = GAME_CONFIG.CANVAS_WIDTH;
  private height = GAME_CONFIG.CANVAS_HEIGHT;

  // 震動系統
  private trauma = 0;
  private maxShakeOffset = 18;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public update(dt: number): void {
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 2.2);
    }
  }

  public render(params: {
    state: GameState;
    stageManager: StageManager;
    particles: ParticleSystem;
    input: InputManager;
    agentPos: { x: number; y: number; angle: number; isDashing: boolean };
    ghosts: ActiveGhostState[];
    remainingSeconds: number;
    currentLoop: number;
    maxLoops: number;
    isRewinding: boolean;
    rewindProgress: number; // 0 ~ 1
    selectedLevelId: number;
    allProgress: Record<number, StageSaveData>;
    victoryData?: { score: number; stars: number; timeBonus: number; loopBonus: number; penalty: number };
    gameoverReason?: string;
    isMuted: boolean;
  }): void {
    const ctx = this.ctx;
    ctx.save();

    // 螢幕震動位移
    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma * this.maxShakeOffset;
      const offsetX = (Math.random() * 2 - 1) * shake;
      const offsetY = (Math.random() * 2 - 1) * shake;
      ctx.translate(offsetX, offsetY);
    }

    // 1. 清空與繪製深黑底色
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, this.width, this.height);

    if (params.state === 'TITLE') {
      this.renderTitleScreen(ctx, params.input, params.isMuted);
    } else if (params.state === 'LEVEL_SELECT') {
      this.renderLevelSelect(ctx, params.allProgress, params.input, params.isMuted);
    } else {
      // 遊戲中、倒流中、通關或失敗
      this.renderGameWorld(params);
      this.renderHUD(params);

      // 觸控虛擬控制
      this.renderTouchControls(ctx, params.input);

      // 倒流特效
      if (params.isRewinding) {
        this.renderRewindOverlay(ctx, params.rewindProgress);
      }

      // 結算彈窗
      if (params.state === 'VICTORY' && params.victoryData) {
        this.renderVictoryModal(ctx, params.victoryData, params.stageManager.currentLevel?.id ?? 1);
      } else if (params.state === 'GAMEOVER') {
        this.renderGameOverModal(ctx, params.gameoverReason ?? '時空連續體崩潰');
      }
    }

    ctx.restore();
  }

  // --- 世界渲染 ---
  private renderGameWorld(params: {
    stageManager: StageManager;
    particles: ParticleSystem;
    agentPos: { x: number; y: number; angle: number; isDashing: boolean };
    ghosts: ActiveGhostState[];
  }): void {
    const ctx = this.ctx;
    const sm = params.stageManager;

    // 1. 高科技數位格網與動態流動光脈衝
    this.renderGrid(ctx);

    // 2. 機關連線 (踏板至閘門、傳送門的發光管線)
    this.renderWires(ctx, sm);

    // 3. 量子傳送門 (Teleporters)
    this.renderTeleporters(ctx, sm);

    // 4. EMP 電磁終端 (EMP Terminals)
    this.renderEmpTerminals(ctx, sm);

    // 5. 踏板
    this.renderPads(ctx, sm);

    // 6. 撤離裂縫 (Exit Rift)
    this.renderExitRift(ctx, sm.exitPosition.x, sm.exitPosition.y, sm.isCoreExtracted);

    // 7. 量子數據核心 (Core)
    if (!sm.isCoreExtracted) {
      this.renderQuantumCore(ctx, sm.corePosition.x, sm.corePosition.y);
    }

    // 8. 殘影幽靈 (Echo Clones)
    for (const ghost of params.ghosts) {
      if (ghost.isAlive) {
        this.renderGhostAgent(ctx, ghost.x, ghost.y, ghost.angle, ghost.color, ghost.name);
      }
    }

    // 9. 特工本體 (Agent)
    this.renderMainAgent(ctx, params.agentPos.x, params.agentPos.y, params.agentPos.angle, params.agentPos.isDashing, sm.isCoreExtracted);

    // 10. 牆壁與閘門
    this.renderWalls(ctx, sm);
    this.renderDoors(ctx, sm);

    // 11. 致命雷射 (帶充能預警動畫)
    this.renderLasers(ctx, sm);

    // 12. 粒子特效
    params.particles.render(ctx);

    // 13. EMP 全場癱瘓視覺警示光效
    if (sm.isEmpActive) {
      this.renderEmpActiveAura(ctx, sm.empRemainingTimer);
    }
  }

  // 高科技數位格網與動態流動光脈衝
  private renderGrid(ctx: CanvasRenderingContext2D): void {
    const tileSize = 32;
    const now = Date.now() / 1000;

    // 底層精細網格
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 180, 240, 0.055)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.width; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y <= this.height; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // 十字座標微光節點
    ctx.fillStyle = 'rgba(0, 240, 255, 0.16)';
    for (let x = tileSize * 2; x < this.width; x += tileSize * 3) {
      for (let y = tileSize * 2; y < this.height; y += tileSize * 3) {
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }

    // 動態流動光脈衝 (Circuit Pulses)
    ctx.lineWidth = 2;
    // 橫向光脈衝 1 (上方區域)
    const pulse1X = ((now * 220) % (this.width + 300)) - 150;
    const pulse1Y = 160;
    const grad1 = ctx.createLinearGradient(pulse1X - 80, pulse1Y, pulse1X + 80, pulse1Y);
    grad1.addColorStop(0, 'rgba(0, 240, 255, 0)');
    grad1.addColorStop(0.5, 'rgba(0, 240, 255, 0.45)');
    grad1.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.strokeStyle = grad1;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, pulse1X - 80), pulse1Y);
    ctx.lineTo(Math.min(this.width, pulse1X + 80), pulse1Y);
    ctx.stroke();

    // 橫向光脈衝 2 (下方區域)
    const pulse2X = this.width - (((now * 180) % (this.width + 300)) - 150);
    const pulse2Y = 384;
    const grad2 = ctx.createLinearGradient(pulse2X - 70, pulse2Y, pulse2X + 70, pulse2Y);
    grad2.addColorStop(0, 'rgba(255, 0, 204, 0)');
    grad2.addColorStop(0.5, 'rgba(255, 0, 204, 0.4)');
    grad2.addColorStop(1, 'rgba(255, 0, 204, 0)');
    ctx.strokeStyle = grad2;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, pulse2X - 70), pulse2Y);
    ctx.lineTo(Math.min(this.width, pulse2X + 70), pulse2Y);
    ctx.stroke();

    // 縱向光脈衝 (中央走廊)
    const pulse3Y = ((now * 200) % (this.height + 200)) - 100;
    const pulse3X = 480;
    const grad3 = ctx.createLinearGradient(pulse3X, pulse3Y - 60, pulse3X, pulse3Y + 60);
    grad3.addColorStop(0, 'rgba(0, 255, 136, 0)');
    grad3.addColorStop(0.5, 'rgba(0, 255, 136, 0.35)');
    grad3.addColorStop(1, 'rgba(0, 255, 136, 0)');
    ctx.strokeStyle = grad3;
    ctx.beginPath();
    ctx.moveTo(pulse3X, Math.max(0, pulse3Y - 60));
    ctx.lineTo(pulse3X, Math.min(this.height, pulse3Y + 60));
    ctx.stroke();

    ctx.restore();
  }

  private renderWires(ctx: CanvasRenderingContext2D, sm: StageManager): void {
    ctx.save();
    for (const pad of sm.pads) {
      for (const targetId of pad.targets) {
        const door = sm.doors.find((d) => d.id === targetId);
        if (door) {
          ctx.beginPath();
          ctx.moveTo(pad.x, pad.y);
          ctx.lineTo(door.x + door.w / 2, door.y + door.h / 2);
          ctx.strokeStyle = pad.isPressed ? 'rgba(0, 240, 255, 0.55)' : 'rgba(0, 180, 240, 0.12)';
          ctx.lineWidth = pad.isPressed ? 2.5 : 1.5;
          ctx.setLineDash([6, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    // 踏板至傳送門管線
    for (const t of sm.teleporters) {
      if (t.requiresPadId) {
        const pad = sm.pads.find((p) => p.id === t.requiresPadId);
        if (pad) {
          ctx.beginPath();
          ctx.moveTo(pad.x, pad.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = t.isActive ? 'rgba(0, 240, 255, 0.6)' : 'rgba(0, 180, 240, 0.12)';
          ctx.lineWidth = t.isActive ? 2.5 : 1.2;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    ctx.restore();
  }

  // 渲染傳送門
  private renderTeleporters(ctx: CanvasRenderingContext2D, sm: StageManager): void {
    ctx.save();
    const now = Date.now() / 350;

    for (const t of sm.teleporters) {
      // 導引連接線 (入口 -> 出口)
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.targetX, t.targetY);
      ctx.strokeStyle = t.isActive ? 'rgba(0, 240, 255, 0.28)' : 'rgba(100, 120, 140, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 1. 入口 (Entry)
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.shadowColor = t.isActive ? t.color : '#334155';
      ctx.shadowBlur = t.isActive ? 18 : 4;

      // 旋轉多角星環
      ctx.rotate(now);
      ctx.beginPath();
      ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
      ctx.strokeStyle = t.isActive ? t.color : '#475569';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // 內部逆向漩渦環
      ctx.rotate(-now * 2);
      ctx.beginPath();
      ctx.arc(0, 0, t.radius * 0.6, 0, Math.PI * 1.5);
      ctx.strokeStyle = t.isActive ? '#ffffff' : '#64748b';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // 入口標籤
      ctx.fillStyle = t.isActive ? t.color : '#64748b';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.isActive ? 'PORTAL [ACTIVE]' : 'PORTAL [OFFLINE]', t.x, t.y + t.radius + 14);

      // 2. 出口 (Target)
      ctx.save();
      ctx.translate(t.targetX, t.targetY);
      ctx.shadowColor = t.isActive ? '#00ff88' : '#334155';
      ctx.shadowBlur = t.isActive ? 14 : 4;

      ctx.rotate(-now);
      ctx.beginPath();
      ctx.arc(0, 0, t.radius * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = t.isActive ? '#00ff88' : '#475569';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
      ctx.fillStyle = t.isActive ? '#00ff88' : '#64748b';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT LINK', t.targetX, t.targetY + t.radius + 12);
    }
    ctx.restore();
  }

  // 渲染 EMP 終端
  private renderEmpTerminals(ctx: CanvasRenderingContext2D, sm: StageManager): void {
    ctx.save();
    const now = Date.now() / 300;

    for (const emp of sm.empTerminals) {
      ctx.save();
      ctx.translate(emp.x, emp.y);

      const activeColor = emp.isCharged ? '#00ff88' : emp.color;
      ctx.shadowColor = activeColor;
      ctx.shadowBlur = emp.isCharged ? 20 : 8;

      // 八角形底座
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + (emp.isCharged ? now * 0.5 : 0);
        const px = Math.cos(a) * emp.radius;
        const py = Math.sin(a) * emp.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = emp.isCharged ? 'rgba(0, 255, 136, 0.28)' : 'rgba(20, 30, 45, 0.85)';
      ctx.fill();
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // 充能進度光弧 (如果充能中)
      if (emp.chargeTimer > 0) {
        const progress = emp.chargeTimer / emp.maxChargeTime;
        ctx.beginPath();
        ctx.arc(0, 0, emp.radius * 0.65, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // 中心圖標
      ctx.shadowBlur = 0;
      ctx.fillStyle = emp.isCharged ? '#080c14' : '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emp.isCharged ? 'CHARGED' : 'EMP', 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }

  // 全場 EMP 爆發活躍光環
  private renderEmpActiveAura(ctx: CanvasRenderingContext2D, timer: number): void {
    ctx.save();
    // 四周電磁干擾邊框
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, this.width, this.height);

    // 頂部全息警示
    ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fillText(`⚡ EMP OVERRIDE ACTIVE // LASERS OFFLINE (${timer.toFixed(1)}s) ⚡`, this.width / 2, 54);
    ctx.restore();
  }

  private renderPads(ctx: CanvasRenderingContext2D, sm: StageManager): void {
    ctx.save();
    for (const pad of sm.pads) {
      // 底座
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, pad.radius, 0, Math.PI * 2);
      ctx.fillStyle = pad.isPressed ? 'rgba(0, 240, 255, 0.35)' : 'rgba(20, 30, 45, 0.8)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = pad.color;
      ctx.shadowColor = pad.color;
      ctx.shadowBlur = pad.isPressed ? 16 : 6;
      ctx.stroke();

      // 內部同心環
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, pad.isPressed ? pad.radius * 0.55 : pad.radius * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = pad.color;
      ctx.fill();

      // 踏板圖示標籤
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#080c14';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pad.id.replace('pad-', 'P'), pad.x, pad.y);
    }
    ctx.restore();
  }

  private renderWalls(ctx: CanvasRenderingContext2D, sm: StageManager): void {
    ctx.save();
    for (const w of sm.walls) {
      // 牆體主體
      ctx.fillStyle = '#121929';
      ctx.fillRect(w.x, w.y, w.w, w.h);

      // 牆體外框金屬高光
      ctx.strokeStyle = '#24324f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w.x, w.y, w.w, w.h);

      // 頂部賽博青邊線
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.x + w.w, w.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderDoors(ctx: CanvasRenderingContext2D, sm: StageManager): void {
    ctx.save();
    for (const d of sm.doors) {
      if (d.openProgress < 0.95) {
        let drawW = d.w;
        let drawH = d.h;
        let drawX = d.x;
        let drawY = d.y;

        if (d.orientation === 'vertical') {
          drawH = d.h * (1 - d.openProgress);
        } else {
          drawW = d.w * (1 - d.openProgress);
        }

        // 能量門底色
        ctx.fillStyle = 'rgba(255, 50, 80, 0.25)';
        ctx.fillRect(drawX, drawY, drawW, drawH);

        // 能量門格柵
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 8;
        ctx.strokeRect(drawX, drawY, drawW, drawH);

        // 內部流光條紋
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        const offset = (Date.now() / 20) % 14;
        if (d.orientation === 'vertical') {
          for (let y = drawY + offset; y < drawY + drawH; y += 14) {
            ctx.moveTo(drawX + 2, y);
            ctx.lineTo(drawX + drawW - 2, y);
          }
        } else {
          for (let x = drawX + offset; x < drawX + drawW; x += 14) {
            ctx.moveTo(x, drawY + 2);
            ctx.lineTo(x, drawY + drawH - 2);
          }
        }
        ctx.stroke();
      } else {
        // 全開時呈現綠色通暢標記
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(d.x, d.y, d.w, d.h);
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  private renderLasers(ctx: CanvasRenderingContext2D, sm: StageManager): void {
    ctx.save();
    const now = Date.now();

    for (const l of sm.lasers) {
      // 判斷是否即將開啟 (充能預警階段：倒數 <= 0.65s)
      const isPrecharging =
        !l.isActive &&
        l.cycleTime !== undefined &&
        l.timer !== undefined &&
        l.cycleTime - l.timer <= 0.65;

      const chargeScale = isPrecharging ? Math.min(1.0, (0.65 - (l.cycleTime! - l.timer!)) / 0.65) : 0;

      // 1. 發射基座 (x1, y1) 與 (x2, y2)
      const renderEmitter = (x: number, y: number) => {
        ctx.save();
        ctx.translate(x, y);

        // 基座外圍金屬框
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (l.isActive) {
          // 發射活躍紅光脈動光暈
          const pulse = 10 + Math.sin(now / 50) * 4;
          ctx.shadowColor = '#ff0033';
          ctx.shadowBlur = pulse + 8;
          ctx.fillStyle = '#ff1144';
          ctx.beginPath();
          ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
          ctx.fill();

          // 核心白熱發射點
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (isPrecharging) {
          // 即將發射：警告紅光充能脈衝
          const warnPulse = 8 + Math.sin(now / 35) * 6;
          ctx.shadowColor = '#ff6600';
          ctx.shadowBlur = warnPulse;
          ctx.fillStyle = '#ff4400';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();

          // 蓄能向心收縮環
          const ringR = 12 * (1.0 - chargeScale);
          ctx.strokeStyle = 'rgba(255, 100, 0, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, ringR, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // 待機暗紅指示燈
          ctx.fillStyle = 'rgba(255, 34, 85, 0.4)';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      };

      renderEmitter(l.x1, l.y1);
      renderEmitter(l.x2, l.y2);

      // 2. 雷射光束主體
      if (l.isActive) {
        // 雷射外暈
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.strokeStyle = 'rgba(255, 20, 80, 0.35)';
        ctx.lineWidth = 14;
        ctx.stroke();

        // 雷射主體
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.strokeStyle = '#ff0044';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#ff2255';
        ctx.shadowBlur = 16;
        ctx.stroke();

        // 雷射核心純白高能光束
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      } else if (isPrecharging) {
        // 充能警告：急促閃爍指示線
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        const flashAlpha = 0.3 + Math.sin(now / 35) * 0.25;
        ctx.strokeStyle = `rgba(255, 80, 20, ${flashAlpha})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // 待機微弱指示線
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.strokeStyle = 'rgba(255, 34, 85, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  private renderQuantumCore(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);

    const now = Date.now() / 600;
    const scale = 1.0 + Math.sin(now * 3) * 0.08;
    ctx.scale(scale, scale);

    // 外發光
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 20;

    // 旋轉多邊形
    ctx.rotate(now);
    const size = 15;
    ctx.fillStyle = '#ffe600';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const px = Math.cos(a) * size;
      const py = Math.sin(a) * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 內核心
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  private renderExitRift(ctx: CanvasRenderingContext2D, x: number, y: number, isUnlocked: boolean): void {
    ctx.save();
    ctx.translate(x, y);

    const now = Date.now() / 400;
    const color = isUnlocked ? '#00f0ff' : 'rgba(100, 140, 170, 0.4)';

    ctx.shadowColor = color;
    ctx.shadowBlur = isUnlocked ? 25 : 8;

    // 旋轉環
    for (let r = 26; r >= 10; r -= 7) {
      ctx.beginPath();
      ctx.arc(0, 0, r, now * (r % 2 === 0 ? 1 : -1), now * (r % 2 === 0 ? 1 : -1) + Math.PI * 1.5);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 標籤
    ctx.fillStyle = isUnlocked ? '#00f0ff' : '#718096';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RIFT', 0, 36);

    ctx.restore();
  }

  private renderGhostAgent(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    color: string,
    name: string
  ): void {
    ctx.save();
    const now = Date.now();

    // 1. 全像身後幽靈拖尾 (Hologram Echo Trails)
    for (let t = 2; t >= 1; t--) {
      ctx.save();
      const trailOffset = t * 7;
      const tx = x - Math.cos(angle) * trailOffset;
      const ty = y - Math.sin(angle) * trailOffset;
      ctx.translate(tx, ty);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.22 / t;

      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, -9);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, 9);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);

    // 名稱與輪次霓虹指示
    ctx.fillStyle = color;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(`◆ ${name}`, 0, -23);
    ctx.shadowBlur = 0;

    // 隨機微小全像時空抖動
    const glitchJitter = Math.random() < 0.15 ? (Math.random() - 0.5) * 3 : 0;
    ctx.translate(glitchJitter, 0);

    ctx.rotate(angle);

    // 2. 全像底盤旋轉虛線能量環
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.globalAlpha = 0.65;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. 特工戰術菱形 (半透明霓虹主體)
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fill();

    // 4. 全像橫紋掃描線
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    const scanOffset = (now / 20) % 6;
    for (let sy = -16; sy <= 16; sy += 4) {
      ctx.fillRect(-16, sy + scanOffset, 32, 1.5);
    }

    // 隨機全息雜訊錯位橫條
    if (Math.random() < 0.25) {
      const sliceY = (Math.random() - 0.5) * 20;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(-16, sliceY, 32, 2.5);
    }

    ctx.restore();
    ctx.restore();
  }

  private renderMainAgent(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    isDashing: boolean,
    hasCore: boolean
  ): void {
    ctx.save();
    ctx.translate(x, y);

    // 若攜帶核心，身上有光環圍繞
    if (hasCore) {
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 15;
      ctx.stroke();
    }

    // 瞄準指示光束
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(80, 0);
    ctx.strokeStyle = 'rgba(255, 230, 0, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.restore();

    ctx.rotate(angle);

    // 主體外光
    ctx.shadowColor = isDashing ? '#00f0ff' : '#ffe600';
    ctx.shadowBlur = isDashing ? 22 : 14;

    // 物理底盤
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fillStyle = isDashing ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 230, 0, 0.15)';
    ctx.fill();
    ctx.strokeStyle = isDashing ? '#00f0ff' : '#ffe600';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // 戰術三角形特工
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-11, -10);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fillStyle = isDashing ? '#ffffff' : '#ffe600';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  // --- HUD 介面 ---
  private renderHUD(params: {
    remainingSeconds: number;
    currentLoop: number;
    maxLoops: number;
    stageManager: StageManager;
    isMuted: boolean;
  }): void {
    const ctx = this.ctx;
    ctx.save();

    // 頂部狀態橫條
    ctx.fillStyle = 'rgba(10, 14, 23, 0.85)';
    ctx.fillRect(0, 0, this.width, 36);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 36);
    ctx.lineTo(this.width, 36);
    ctx.stroke();

    // 1. 關卡資訊與迴圈進度
    const sm = params.stageManager;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`LV.${sm.currentLevel?.id ?? 1} ${sm.currentLevel?.name ?? ''}`, 16, 23);

    // 迴圈方塊指示器
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText('LOOP:', 180, 23);

    for (let l = 1; l <= params.maxLoops; l++) {
      const bx = 225 + (l - 1) * 22;
      const by = 13;
      if (l < params.currentLoop) {
        ctx.fillStyle = '#00f0ff'; // 過去已錄製的殘影
      } else if (l === params.currentLoop) {
        ctx.fillStyle = '#ffe600'; // 當前特工本體
      } else {
        ctx.fillStyle = '#334155'; // 未來剩餘預算
      }
      ctx.fillRect(bx, by, 16, 12);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, 16, 12);
    }

    // 2. 中央時鐘倒數 12.0s
    const rem = Math.max(0, params.remainingSeconds);
    const isUrgent = rem <= 3.2;

    const clockCx = this.width / 2;
    const clockCy = 18;

    ctx.textAlign = 'center';
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = isUrgent ? '#ff3366' : '#00f0ff';
    ctx.shadowColor = isUrgent ? '#ff3366' : '#00f0ff';
    ctx.shadowBlur = isUrgent ? 15 : 8;
    ctx.fillText(`${rem.toFixed(2)}s`, clockCx, 25);
    ctx.shadowBlur = 0;

    // 3. 核心狀態
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px monospace';
    if (sm.isCoreExtracted) {
      ctx.fillStyle = '#00ff88';
      ctx.fillText('[CORE EXTRACTED! GET TO RIFT]', this.width - 16, 23);
    } else {
      ctx.fillStyle = '#ffe600';
      ctx.fillText('[RETRIEVE DATA CORE]', this.width - 16, 23);
    }

    ctx.restore();
  }

  // --- 手機虛擬控制按鈕 ---
  private renderTouchControls(ctx: CanvasRenderingContext2D, input: InputManager): void {
    if (!input.isTouchDevice && !input.joystickActive) return;

    ctx.save();
    // 1. 虛擬搖桿
    if (input.joystickActive) {
      // 搖桿底盤
      ctx.beginPath();
      ctx.arc(input.joystickOrigin.x, input.joystickOrigin.y, 50, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 搖桿指針頭
      ctx.beginPath();
      ctx.arc(input.joystickCurrent.x, input.joystickCurrent.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.fill();
    }

    // 2. 右側虛擬按鈕
    for (const btn of input.touchButtons) {
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.radius, 0, Math.PI * 2);
      ctx.fillStyle = btn.isDown ? 'rgba(255, 255, 255, 0.4)' : 'rgba(15, 23, 42, 0.7)';
      ctx.fill();
      ctx.strokeStyle = btn.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = btn.color;
      ctx.shadowBlur = btn.isDown ? 16 : 6;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x, btn.y);
    }

    ctx.restore();
  }

  // --- 倒流時空負片特效 (Paradox Rewind: CRT + RGB 色像差 + 膠卷倒帶滑動) ---
  private renderRewindOverlay(ctx: CanvasRenderingContext2D, progress: number): void {
    ctx.save();
    const now = Date.now();

    // 1. RGB 色像差 (Chromatic Aberration) 震盪底層
    const rgbShift = Math.sin(now / 18) * 16;
    // 紅色色差偏移
    ctx.fillStyle = 'rgba(255, 0, 70, 0.18)';
    ctx.fillRect(rgbShift, 0, this.width, this.height);
    // 青藍色色差偏移
    ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
    ctx.fillRect(-rgbShift, 0, this.width, this.height);

    // 隨機橫條色差切片錯位
    for (let i = 0; i < 4; i++) {
      const sliceY = ((now * (i + 1) * 37) % this.height);
      const sliceH = 14 + (i * 8);
      const sliceShift = (Math.random() - 0.5) * 30;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 0, 180, 0.25)';
      ctx.fillRect(sliceShift, sliceY, this.width, sliceH);
    }

    // 2. 膠卷倒帶滑動效果 (Film Rewind Strip)
    const filmSpeed = (now * 1.8) % 22;
    // 頂部膠卷帶 (y: 0 ~ 26)
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, this.width, 26);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.lineTo(this.width, 26);
    ctx.stroke();

    // 頂部齒孔 (Sprocket holes)
    ctx.fillStyle = '#ffffff';
    for (let x = -filmSpeed; x < this.width + 22; x += 22) {
      ctx.fillRect(x, 7, 12, 12);
    }

    // 底部膠卷帶 (y: this.height - 26 ~ this.height)
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, this.height - 26, this.width, 26);
    ctx.beginPath();
    ctx.moveTo(0, this.height - 26);
    ctx.lineTo(this.width, this.height - 26);
    ctx.stroke();

    // 底部齒孔
    for (let x = -filmSpeed; x < this.width + 22; x += 22) {
      ctx.fillRect(x, this.height - 19, 12, 12);
    }

    // 3. CRT 掃描線 (精密光柵)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    for (let y = 0; y < this.height; y += 3) {
      ctx.fillRect(0, y, this.width, 1.2);
    }

    // 滾動光亮掃描線 (Rolling Scanbar)
    const rollingScanY = (now / 2.5) % (this.height + 80) - 40;
    const scanGrad = ctx.createLinearGradient(0, rollingScanY - 30, 0, rollingScanY + 30);
    scanGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
    scanGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.2)');
    scanGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, Math.max(0, rollingScanY - 30), this.width, 60);

    // 四角 CRT 暗角暈影 (Radial Vignette)
    const vignette = ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.width * 0.28,
      this.width / 2,
      this.height / 2,
      this.width * 0.58
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 5, 15, 0.7)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.width, this.height);

    // 4. 中央巨型倒流視覺與時間碼逆轉
    const cx = this.width / 2;
    const cy = this.height / 2;

    // 色像差標題雙重投影
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';

    // 紅色偏差影
    ctx.fillStyle = 'rgba(255, 0, 80, 0.75)';
    ctx.fillText('<< PARADOX REWINDING <<', cx + rgbShift * 0.6, cy - 10);

    // 青色偏差影
    ctx.fillStyle = 'rgba(0, 240, 255, 0.75)';
    ctx.fillText('<< PARADOX REWINDING <<', cx - rgbShift * 0.6, cy - 10);

    // 純白主字體
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 24;
    ctx.fillText('<< PARADOX REWINDING <<', cx, cy - 10);
    ctx.shadowBlur = 0;

    // 逆轉時間碼與幀率計數
    const frameRemain = Math.floor((1 - progress) * 720);
    const secRemain = ((1 - progress) * 12.0).toFixed(2);
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(`● REC [REV-SPEED 16X] // REVERTING TIME TO 00:00.00`, cx, cy + 30);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#ffe600';
    ctx.fillText(`FRAME: ${frameRemain.toString().padStart(4, '0')} / 0720 | TIMESTAMP: ${secRemain}s`, cx, cy + 52);

    // 逆轉進度指示條
    const barW = 280;
    const barH = 8;
    const barX = cx - barW / 2;
    const barY = cy + 72;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#00f0ff';
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fillRect(barX, barY, barW * progress, barH);

    ctx.restore();
  }

  // --- 標題畫面 ---
  private renderTitleScreen(ctx: CanvasRenderingContext2D, input: InputManager, isMuted: boolean): void {
    this.renderGrid(ctx);

    const cx = this.width / 2;
    const cy = this.height / 2;

    ctx.save();

    // 賽博裝飾光環
    ctx.beginPath();
    ctx.arc(cx, cy - 40, 160, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 標題
    ctx.textAlign = 'center';
    ctx.font = 'bold 54px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 25;
    ctx.fillText('ECHO LOOP', cx, cy - 70);

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fillText('TIME PARADOX // 殘影特工：時間迴圈', cx, cy - 25);

    // 說明簡介
    ctx.shadowBlur = 0;
    ctx.font = '14px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('12 秒極限時空潛入 × 殘影協同解謎', cx, cy + 18);
    ctx.fillText('操作本體錄製軌跡，與上一輪的自己跨時空開門、引開雷射、奪取量子核心！', cx, cy + 42);

    // 開始按鈕
    const btnW = 240;
    const btnH = 50;
    const btnX = cx - btnW / 2;
    const btnY = cy + 85;

    // 滑鼠 hover 判定
    const isHover =
      input.mouseX >= btnX && input.mouseX <= btnX + btnW && input.mouseY >= btnY && input.mouseY <= btnY + btnH;

    ctx.fillStyle = isHover ? '#00f0ff' : 'rgba(0, 240, 255, 0.2)';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = isHover ? '#080c14' : '#ffffff';
    ctx.fillText('START MISSION / 開始行動', cx, btnY + 32);

    // 操作指南提示
    ctx.font = '12px monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('WASD / 方向鍵移動 | Space 衝刺 | R 回溯重置 | 支援手機觸控搖桿', cx, this.height - 25);

    ctx.restore();
  }

  // --- 關卡選擇畫面 (3x3 網格 9 大任務關卡) ---
  private renderLevelSelect(
    ctx: CanvasRenderingContext2D,
    allProgress: Record<number, StageSaveData>,
    input: InputManager,
    isMuted: boolean
  ): void {
    this.renderGrid(ctx);

    ctx.save();

    // 計算總星數
    let totalStars = 0;
    LEVELS.forEach((l) => {
      const p = allProgress[l.id];
      if (p) totalStars += p.stars || 0;
    });

    // 頂部標題
    ctx.textAlign = 'left';
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 14;
    ctx.fillText('SELECT MISSION // 選擇任務關卡', 49, 44);
    ctx.shadowBlur = 0;

    // 總星級計數徽章
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#ffe600';
    ctx.fillText(`★ TOTAL STARS: ${totalStars} / ${LEVELS.length * 3}`, this.width - 49, 44);

    // 關卡網格 (3 列 x 3 行 = 9 關)
    const cardW = 270;
    const cardH = 118;
    const gapX = 26;
    const gapY = 16;
    const startX = 49;
    const startY = 68;

    LEVELS.forEach((level, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      const progress = allProgress[level.id] || { unlocked: level.id === 1, highScore: 0, stars: 0 };
      const isUnlocked = progress.unlocked;

      const isHover =
        isUnlocked &&
        input.mouseX >= x &&
        input.mouseX <= x + cardW &&
        input.mouseY >= y &&
        input.mouseY <= y + cardH;

      // 卡片底色
      ctx.fillStyle = !isUnlocked
        ? 'rgba(15, 23, 42, 0.45)'
        : isHover
        ? 'rgba(0, 240, 255, 0.22)'
        : 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(x, y, cardW, cardH);

      ctx.strokeStyle = !isUnlocked ? '#334155' : isHover ? '#00f0ff' : 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = isHover ? 2.5 : 1.5;
      ctx.strokeRect(x, y, cardW, cardH);

      // 卡片文字
      ctx.textAlign = 'left';
      ctx.fillStyle = isUnlocked ? '#ffffff' : '#64748b';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`LV.${level.id} ${level.name}`, x + 14, y + 25);

      ctx.fillStyle = isUnlocked ? '#00f0ff' : '#475569';
      ctx.font = '11px monospace';
      ctx.fillText(`// ${level.subName}`, x + 14, y + 43);

      // 描述 / 迴圈配額
      ctx.fillStyle = isUnlocked ? '#94a3b8' : '#334155';
      ctx.font = '11px monospace';
      ctx.fillText(`迴圈上限: ${level.maxLoops} 次 | 倒數: ${level.loopDuration}s`, x + 14, y + 68);

      if (isUnlocked) {
        // 星級
        ctx.fillStyle = '#ffe600';
        ctx.font = '17px monospace';
        const starsText = '★'.repeat(progress.stars) + '☆'.repeat(Math.max(0, 3 - progress.stars));
        ctx.fillText(starsText, x + 14, y + 98);

        // 最高分
        ctx.textAlign = 'right';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px monospace';
        ctx.fillText(`BEST: ${progress.highScore.toLocaleString()} PTS`, x + cardW - 14, y + 97);
      } else {
        ctx.fillStyle = '#ff3366';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('🔒 LOCKED // 未解鎖', x + 14, y + 96);
      }
    });

    // 底部返回按鈕
    const backBtnW = 140;
    const backBtnH = 36;
    const backX = 49;
    const backY = this.height - 46;
    const isBackHover =
      input.mouseX >= backX && input.mouseX <= backX + backBtnW && input.mouseY >= backY && input.mouseY <= backY + backBtnH;

    ctx.fillStyle = isBackHover ? 'rgba(0, 240, 255, 0.35)' : 'rgba(30, 41, 59, 0.75)';
    ctx.fillRect(backX, backY, backBtnW, backBtnH);
    ctx.strokeStyle = '#00f0ff';
    ctx.strokeRect(backX, backY, backBtnW, backBtnH);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('< BACK / 返回', backX + backBtnW / 2, backY + 23);

    ctx.restore();
  }

  // --- 通關結算面板 ---
  private renderVictoryModal(
    ctx: CanvasRenderingContext2D,
    data: { score: number; stars: number; timeBonus: number; loopBonus: number; penalty: number },
    currentLevelId: number
  ): void {
    ctx.save();

    // 暗色半透明遮罩
    ctx.fillStyle = 'rgba(5, 8, 14, 0.75)';
    ctx.fillRect(0, 0, this.width, this.height);

    // 面板框
    const mw = 480;
    const mh = 360;
    const mx = (this.width - mw) / 2;
    const my = (this.height - mh) / 2;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 20;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.shadowBlur = 0;

    // 標題
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('MISSION COMPLETE!', this.width / 2, my + 45);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText('時空數據核心成功回收 // EXTRACTION SUCCESS', this.width / 2, my + 72);

    // 星級
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#ffe600';
    ctx.fillText('★'.repeat(data.stars) + '☆'.repeat(3 - data.stars), this.width / 2, my + 120);

    // 得分細項
    ctx.textAlign = 'left';
    ctx.font = '14px monospace';
    ctx.fillStyle = '#94a3b8';
    const sx = mx + 60;
    ctx.fillText(`基礎過關獎勵:       +10,000`, sx, my + 160);
    ctx.fillText(`剩餘時間加成:       +${data.timeBonus}`, sx, my + 185);
    ctx.fillText(`殘影節約加成:       +${data.loopBonus}`, sx, my + 210);
    if (data.penalty > 0) {
      ctx.fillStyle = '#ff3366';
      ctx.fillText(`時空悖論懲罰:       -${data.penalty}`, sx, my + 235);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`總分: ${data.score.toLocaleString()} PTS`, sx, my + 270);

    // 按鈕：下一關 / 重試
    const btnW = 160;
    const btnH = 42;
    const btnY = my + mh - 55;

    // Retry
    const rX = mx + 50;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(rX, btnY, btnW, btnH);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(rX, btnY, btnW, btnH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('RETRY / 重試', rX + btnW / 2, btnY + 26);

    // Next
    const nX = mx + mw - 50 - btnW;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(nX, btnY, btnW, btnH);
    ctx.fillStyle = '#080c14';
    ctx.fillText(currentLevelId >= LEVELS.length ? 'FINISH / 完成' : 'NEXT / 下一關', nX + btnW / 2, btnY + 26);

    ctx.restore();
  }

  // --- 失敗面板 ---
  private renderGameOverModal(ctx: CanvasRenderingContext2D, reason: string): void {
    ctx.save();

    ctx.fillStyle = 'rgba(5, 8, 14, 0.8)';
    ctx.fillRect(0, 0, this.width, this.height);

    const mw = 440;
    const mh = 260;
    const mx = (this.width - mw) / 2;
    const my = (this.height - mh) / 2;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 20;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3366';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('TEMPORAL COLLAPSE', this.width / 2, my + 55);

    ctx.fillStyle = '#ffffff';
    ctx.font = '15px monospace';
    ctx.fillText(reason, this.width / 2, my + 95);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('殘影紀錄已清空，點擊下方重新重構時空！', this.width / 2, my + 125);

    // 重試按鈕
    const btnW = 200;
    const btnH = 44;
    const btnX = (this.width - btnW) / 2;
    const btnY = my + mh - 70;

    ctx.fillStyle = '#ff3366';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('RETRY / 重新挑戰', btnX + btnW / 2, btnY + 28);

    ctx.restore();
  }
}
