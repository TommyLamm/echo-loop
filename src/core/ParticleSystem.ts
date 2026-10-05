export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape: 'circle' | 'square' | 'line';
  alpha: number;
}

export interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private ripples: Ripple[] = [];

  public update(dt: number): void {
    // 更新粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }

    // 更新波紋
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += (r.maxRadius - r.radius) * dt * 8.0;
      r.alpha -= dt * 2.2;
      if (r.alpha <= 0) {
        this.ripples.splice(i, 1);
      }
    }
  }

  public emitDashTrail(x: number, y: number, angle: number, color: string): void {
    for (let i = 0; i < 4; i++) {
      const speed = Math.random() * -120 - 40;
      const spread = (Math.random() - 0.5) * 0.8;
      const dir = angle + spread;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        life: 0.35,
        maxLife: 0.35,
        size: Math.random() * 4 + 2,
        color,
        shape: 'square',
        alpha: 0.8,
      });
    }
  }

  public emitRipple(x: number, y: number, color: string, maxRadius = 40): void {
    this.ripples.push({
      x,
      y,
      radius: 5,
      maxRadius,
      color,
      alpha: 0.85,
    });
  }

  public emitGlitchExplosion(x: number, y: number, color: string): void {
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 220 + 60;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Math.random() * 0.5 + 0.3,
        maxLife: 0.8,
        size: Math.random() * 6 + 3,
        color,
        shape: 'square',
        alpha: 1.0,
      });
    }
  }

  public emitVortexParticle(x: number, y: number): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 45 + 20;
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist;
    // 朝向中心吸入
    const speed = 70;
    this.particles.push({
      x: px,
      y: py,
      vx: -Math.cos(angle) * speed - Math.sin(angle) * 40,
      vy: -Math.sin(angle) * speed + Math.cos(angle) * 40,
      life: 0.5,
      maxLife: 0.5,
      size: Math.random() * 3 + 1.5,
      color: '#00f0ff',
      shape: 'circle',
      alpha: 0.7,
    });
  }

  public emitCoreSparkles(x: number, y: number): void {
    if (Math.random() < 0.3) {
      const ox = (Math.random() - 0.5) * 30;
      const oy = (Math.random() - 0.5) * 30;
      this.particles.push({
        x: x + ox,
        y: y + oy,
        vx: 0,
        vy: -Math.random() * 20 - 10,
        life: 0.4,
        maxLife: 0.4,
        size: Math.random() * 2.5 + 1.5,
        color: '#ffe600',
        shape: 'circle',
        alpha: 0.9,
      });
    }
  }

  // 殘影移動時的量子光點粒子
  public emitQuantumTrail(x: number, y: number, color: string): void {
    if (Math.random() < 0.6) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 8;
      this.particles.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        life: 0.35,
        maxLife: 0.35,
        size: Math.random() * 2.8 + 1.2,
        color,
        shape: Math.random() < 0.5 ? 'square' : 'circle',
        alpha: 0.85,
      });
    }
  }

  // 全像干擾微波紋
  public emitHoloRipple(x: number, y: number, color: string): void {
    this.ripples.push({
      x,
      y,
      radius: 4,
      maxRadius: 24,
      color,
      alpha: 0.6,
    });
  }

  // 量子傳送閃光
  public emitTeleportFlash(x: number, y: number, color: string): void {
    this.emitRipple(x, y, color, 55);
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = Math.random() * 120 + 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4,
        maxLife: 0.4,
        size: Math.random() * 3.5 + 2,
        color,
        shape: 'square',
        alpha: 1.0,
      });
    }
  }

  // 全場 EMP 衝擊波
  public emitEmpShockwave(x: number, y: number): void {
    this.emitRipple(x, y, '#00f0ff', 120);
    this.emitRipple(x, y, '#ffffff', 80);
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 180 + 40;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5,
        maxLife: 0.5,
        size: Math.random() * 4 + 2,
        color: i % 2 === 0 ? '#00f0ff' : '#c040ff',
        shape: 'square',
        alpha: 1.0,
      });
    }
  }

  // 殘影移動時伴隨飄散的量子星塵微粒 (Quantum Stardust)
  public emitQuantumStardust(x: number, y: number, color: string): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 14;
    const speed = Math.random() * 25 + 5;
    this.particles.push({
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * speed,
      vy: -Math.random() * speed * 0.7 - 8,
      life: Math.random() * 0.45 + 0.25,
      maxLife: 0.7,
      size: Math.random() * 2.2 + 1.0,
      color,
      shape: Math.random() < 0.3 ? 'square' : 'circle',
      alpha: 0.9,
    });
  }

  // 重力反轉力場衝擊波
  public emitGravityPulse(x: number, y: number): void {
    this.emitRipple(x, y, '#c040ff', 70);
    this.emitRipple(x, y, '#00f0ff', 40);
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const speed = Math.random() * 80 + 50;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4,
        maxLife: 0.4,
        size: Math.random() * 3 + 2,
        color: '#c040ff',
        shape: 'circle',
        alpha: 0.9,
      });
    }
  }

  // 稜鏡偏折聚焦火花 (Prism Sparks)
  public emitPrismSparks(x: number, y: number, color: string = '#00f0ff'): void {
    if (Math.random() < 0.5) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 100 + 40;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25,
        maxLife: 0.25,
        size: Math.random() * 2.5 + 1,
        color,
        shape: 'square',
        alpha: 1.0,
      });
    }
  }


  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // 渲染波紋
    for (const r of this.ripples) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.alpha;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 渲染粒子
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      if (p.shape === 'square') {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  public clear(): void {
    this.particles = [];
    this.ripples = [];
  }
}
