import { RecordedFrame, GhostTimeline } from '../types';

export class GhostRecorder {
  private currentFrames: RecordedFrame[] = [];
  private isRecording: boolean = false;
  private readonly maxFrames: number = 720; // 12.0s * 60 FPS

  public start(): void {
    this.currentFrames = [];
    this.isRecording = true;
  }

  public recordTick(x: number, y: number, angle: number, actions: number): void {
    if (!this.isRecording) return;
    if (this.currentFrames.length >= this.maxFrames) return;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(angle)) return;

    this.currentFrames.push({
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      angle: Math.round(angle * 1000) / 1000,
      actions,
    });
  }

  public stopAndExport(id: string, name: string, color: string): GhostTimeline {
    this.isRecording = false;
    // 防禦空幀
    const validFrames = this.currentFrames.filter(
      (f) => Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.angle)
    );
    if (validFrames.length === 0) {
      validFrames.push({ x: 0, y: 0, angle: 0, actions: 0 });
    }

    return {
      id,
      name,
      color,
      frames: validFrames,
      totalFrames: validFrames.length,
    };
  }

  public getFrames(): RecordedFrame[] {
    return this.currentFrames;
  }

  public getCurrentFrameCount(): number {
    return this.currentFrames.length;
  }

  public clear(): void {
    this.currentFrames = [];
    this.isRecording = false;
  }
}
