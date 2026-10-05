import { LevelConfig, PressurePad, SecurityDoor, LaserHazard, Wall } from '../types';
import { GAME_CONFIG } from '../config/constants';
import { SoundEngine } from '../audio/SoundEngine';
import { ParticleSystem } from './ParticleSystem';

export class StageManager {
  public currentLevel: LevelConfig | null = null;
  public walls: Wall[] = [];
  public pads: PressurePad[] = [];
  public doors: SecurityDoor[] = [];
  public lasers: LaserHazard[] = [];

  public corePosition: { x: number; y: number } = { x: 0, y: 0 };
  public exitPosition: { x: number; y: number } = { x: 0, y: 0 };
  public isCoreExtracted: boolean = false;

  private sound = SoundEngine.get();

  public loadLevel(level: LevelConfig): void {
    this.currentLevel = level;
    // 深拷貝防污染
    this.walls = JSON.parse(JSON.stringify(level.walls));
    this.pads = JSON.parse(JSON.stringify(level.pads));
    this.doors = JSON.parse(JSON.stringify(level.doors));
    this.lasers = JSON.parse(JSON.stringify(level.lasers));
    this.corePosition = { ...level.core };
    this.exitPosition = { ...level.exit };
    this.isCoreExtracted = false;
  }

  public resetMechanisms(): void {
    if (!this.currentLevel) return;
    this.pads = JSON.parse(JSON.stringify(this.currentLevel.pads));
    this.doors = JSON.parse(JSON.stringify(this.currentLevel.doors));
    this.lasers = JSON.parse(JSON.stringify(this.currentLevel.lasers));
    this.isCoreExtracted = false;
  }

  public update(
    dt: number,
    agentPos: { x: number; y: number },
    ghostPositions: { x: number; y: number }[],
    particles: ParticleSystem
  ): void {
    // 1. 更新雷射週期
    for (const laser of this.lasers) {
      if (laser.cycleTime && laser.onDuration && laser.offDuration) {
        laser.timer = (laser.timer || 0) + dt;
        if (laser.timer >= laser.cycleTime) {
          laser.timer -= laser.cycleTime;
        }
        laser.isActive = laser.timer < laser.onDuration;
      }
    }

    // 2. 檢測踏板碰撞 (特工本體 + 所有活著的殘影)
    for (const pad of this.pads) {
      const wasPressed = pad.isPressed;
      let touching = this.checkCircleOverlap(agentPos.x, agentPos.y, GAME_CONFIG.PLAYER_RADIUS, pad.x, pad.y, pad.radius);

      if (!touching) {
        for (const g of ghostPositions) {
          if (this.checkCircleOverlap(g.x, g.y, GAME_CONFIG.PLAYER_RADIUS, pad.x, pad.y, pad.radius)) {
            touching = true;
            break;
          }
        }
      }

      if (touching) {
        pad.isPressed = true;
        pad.holdTimer = GAME_CONFIG.PAD_HOLD_DELAY;
        if (!wasPressed) {
          this.sound.playPedalClick(true);
          particles.emitRipple(pad.x, pad.y, pad.color, 45);
        }
      } else {
        pad.holdTimer -= dt;
        if (pad.holdTimer <= 0) {
          if (pad.isPressed) {
            this.sound.playPedalClick(false);
          }
          pad.isPressed = false;
        }
      }
    }

    // 3. 結算閘門狀態
    for (const door of this.doors) {
      const controllingPads = this.pads.filter((p) => p.targets.includes(door.id));
      const shouldOpen = controllingPads.length > 0 && controllingPads.some((p) => p.isPressed);

      if (shouldOpen) {
        door.openProgress = Math.min(1.0, door.openProgress + dt * GAME_CONFIG.DOOR_SPEED);
      } else {
        door.openProgress = Math.max(0.0, door.openProgress - dt * GAME_CONFIG.DOOR_SPEED);
      }
      door.isOpen = door.openProgress >= 0.85;
    }

    // 4. 核心粒子
    if (!this.isCoreExtracted) {
      particles.emitCoreSparkles(this.corePosition.x, this.corePosition.y);
    }
    // 5. 撤離點漩渦粒子
    particles.emitVortexParticle(this.exitPosition.x, this.exitPosition.y);
  }

  // 特工與牆體/關閉閘門的圓形-AABB 碰撞滑動修正
  public resolveWallCollisions(pos: { x: number; y: number }, radius: number): void {
    // 牆體碰撞
    for (const w of this.walls) {
      this.resolveCircleRect(pos, radius, w.x, w.y, w.w, w.h);
    }

    // 未全開的閘門碰撞
    for (const d of this.doors) {
      if (d.openProgress < 0.85) {
        // 依照 openProgress 縮放閘門碰撞寬度或高度 (門縮進牆體)
        let effectiveW = d.w;
        let effectiveH = d.h;
        let effectiveX = d.x;
        let effectiveY = d.y;

        if (d.orientation === 'vertical') {
          effectiveH = d.h * (1 - d.openProgress);
        } else {
          effectiveW = d.w * (1 - d.openProgress);
        }

        this.resolveCircleRect(pos, radius, effectiveX, effectiveY, effectiveW, effectiveH);
      }
    }
  }

  private resolveCircleRect(
    pos: { x: number; y: number },
    r: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number
  ): void {
    const closestX = Math.max(rx, Math.min(pos.x, rx + rw));
    const closestY = Math.max(ry, Math.min(pos.y, ry + rh));

    const dx = pos.x - closestX;
    const dy = pos.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < r * r && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const overlap = r - dist;
      pos.x += (dx / dist) * overlap;
      pos.y += (dy / dist) * overlap;
    } else if (distSq <= 0.0001) {
      // 玩家中心在矩形內
      pos.x += r;
    }
  }

  // 檢測點與雷射線段的碰撞
  public checkLaserCollision(px: number, py: number, radius: number): boolean {
    for (const l of this.lasers) {
      if (!l.isActive) continue;
      if (this.distToSegment(px, py, l.x1, l.y1, l.x2, l.y2) <= radius) {
        return true;
      }
    }
    return false;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(px - projX, py - projY);
  }

  private checkCircleOverlap(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy <= (r1 + r2) * (r1 + r2);
  }
}
