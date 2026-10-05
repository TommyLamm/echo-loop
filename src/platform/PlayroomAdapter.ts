import { StageSaveData } from '../types';
import { GAME_CONFIG } from '../config/constants';
import { Playroom } from '../playroom-sdk.js';

export class PlayroomAdapter {
  private static currentRunId: string | null = null;
  private static isInitialized = false;

  public static async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const res = await Playroom.ready();
      console.log('[PlayroomAdapter] Ready state:', res);
    } catch (e) {
      console.warn('[PlayroomAdapter] Playroom SDK ready failed or fallback', e);
    }
    this.isInitialized = true;
  }

  public static async startRun(stageId: number): Promise<string | null> {
    this.currentRunId = null;
    try {
      const runRes = await Playroom.startRun();
      if (runRes && runRes.runId) {
        this.currentRunId = runRes.runId;
        console.log(`[PlayroomAdapter] Run started for stage ${stageId}, runId=${this.currentRunId}`);
      }
    } catch (err) {
      console.warn('[PlayroomAdapter] startRun skipped or failed:', err);
    }
    return this.currentRunId;
  }

  public static async finishRun(score: number): Promise<void> {
    if (this.currentRunId) {
      try {
        await Playroom.finishRun({
          runId: this.currentRunId,
          score: Math.round(score),
        });
        console.log(`[PlayroomAdapter] Run finished score=${score}`);
      } catch (err) {
        console.warn('[PlayroomAdapter] finishRun error:', err);
      }
    }
    this.currentRunId = null;
  }

  public static getSaveData(stageId: number): StageSaveData {
    try {
      const raw = localStorage.getItem(`${GAME_CONFIG.STORAGE_PREFIX}:stage:${stageId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      // silent
    }
    return {
      unlocked: stageId === 1,
      highScore: 0,
      stars: 0,
    };
  }

  public static saveStageProgress(stageId: number, score: number, stars: number): void {
    try {
      const current = this.getSaveData(stageId);
      const updated: StageSaveData = {
        unlocked: true,
        highScore: Math.max(current.highScore, Math.round(score)),
        stars: Math.max(current.stars, stars),
        clearedAt: new Date().toISOString(),
      };
      localStorage.setItem(`${GAME_CONFIG.STORAGE_PREFIX}:stage:${stageId}`, JSON.stringify(updated));

      // 解鎖下一關
      const nextId = stageId + 1;
      const nextData = this.getSaveData(nextId);
      if (!nextData.unlocked) {
        nextData.unlocked = true;
        localStorage.setItem(`${GAME_CONFIG.STORAGE_PREFIX}:stage:${nextId}`, JSON.stringify(nextData));
      }
    } catch (e) {
      console.warn('[PlayroomAdapter] LocalStorage write failed', e);
    }
  }

  public static getAllProgress(totalStages: number): Record<number, StageSaveData> {
    const records: Record<number, StageSaveData> = {};
    for (let i = 1; i <= totalStages; i++) {
      records[i] = this.getSaveData(i);
    }
    return records;
  }
}
