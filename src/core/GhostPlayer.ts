import { GhostTimeline, RecordedFrame } from '../types';

export interface ActiveGhostState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  actions: number;
  isAlive: boolean;
  glitchTimer: number; // >0 表示發生時空悖論干擾
}

export class GhostPlayer {
  public static interpolateFrame(
    frames: RecordedFrame[],
    currentSeconds: number
  ): { x: number; y: number; angle: number; actions: number } {
    if (frames.length === 0) {
      return { x: 0, y: 0, angle: 0, actions: 0 };
    }

    const rawTick = currentSeconds * 60.0;
    const index = Math.floor(rawTick);
    const alpha = rawTick - index;

    if (index >= frames.length - 1) {
      const last = frames[frames.length - 1];
      return { x: last.x, y: last.y, angle: last.angle, actions: last.actions };
    }

    const f0 = frames[index];
    const f1 = frames[index + 1];

    // 線性插值
    const x = f0.x + (f1.x - f0.x) * alpha;
    const y = f0.y + (f1.y - f0.y) * alpha;

    // 角度最短路徑
    let diff = f1.angle - f0.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    const angle = f0.angle + diff * alpha;

    const actions = alpha > 0.5 ? f1.actions : f0.actions;

    return { x, y, angle, actions };
  }

  public static getGhostsAtTime(
    ghosts: GhostTimeline[],
    currentSeconds: number,
    glitchedGhostIds: Set<string>
  ): ActiveGhostState[] {
    return ghosts.map((g) => {
      const interpolated = this.interpolateFrame(g.frames, currentSeconds);
      const isAlive = !glitchedGhostIds.has(g.id);
      return {
        id: g.id,
        name: g.name,
        color: g.color,
        x: interpolated.x,
        y: interpolated.y,
        angle: interpolated.angle,
        actions: interpolated.actions,
        isAlive,
        glitchTimer: glitchedGhostIds.has(g.id) ? 1.0 : 0,
      };
    });
  }
}
