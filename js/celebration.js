/**
 * High-Impact Celebration Engine
 * Full-screen Confetti particles, Fireworks explosions, and Certificate generator
 */
class CelebrationEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.particles = [];
    this.fireworks = [];
    this.isActive = false;
    this.animationId = null;

    this.colors = [
      '#FFD700', // Gold
      '#1363D0', // INEI Royal Blue
      '#00D2FF', // Cyan
      '#FFFFFF', // White
      '#E30613', // Red Peru
      '#FFA726', // Orange
      '#4CAF50', // Emerald Green
    ];

    this.initCanvas();
    window.addEventListener('resize', () => this.initCanvas());
  }

  initCanvas() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  start() {
    this.isActive = true;
    this.particles = [];
    this.fireworks = [];

    // Trigger initial massive confetti explosion
    this.spawnConfettiBurst(this.width * 0.25, this.height * 0.6, 90);
    this.spawnConfettiBurst(this.width * 0.75, this.height * 0.6, 90);
    this.spawnConfettiBurst(this.width * 0.5, this.height * 0.4, 120);

    // Launch continuous fireworks
    this.fireworkTimer = setInterval(() => {
      if (!this.isActive) return;
      this.launchRocket();
    }, 650);

    if (window.soundEngine) {
      window.soundEngine.playPop();
    }

    if (!this.animationId) {
      this.loop();
    }
  }

  stop() {
    this.isActive = false;
    clearInterval(this.fireworkTimer);
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  spawnConfettiBurst(originX, originY, count = 80) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 14;
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];
      const isRibbon = Math.random() > 0.65;

      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4, // Upward bias
        size: isRibbon ? 16 + Math.random() * 12 : 7 + Math.random() * 8,
        width: isRibbon ? 4 : 8,
        color: color,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        tilt: Math.random() * 10,
        tiltSpeed: 0.1 + Math.random() * 0.1,
        life: 0,
        maxLife: 260 + Math.random() * 100,
        isRibbon: isRibbon,
        gravity: 0.18 + Math.random() * 0.08,
        friction: 0.965,
      });
    }
  }

  launchRocket() {
    const startX = this.width * 0.15 + Math.random() * (this.width * 0.7);
    const targetX = startX + (Math.random() - 0.5) * 200;
    const targetY = this.height * 0.15 + Math.random() * (this.height * 0.35);

    this.fireworks.push({
      x: startX,
      y: this.height,
      targetX: targetX,
      targetY: targetY,
      vx: (targetX - startX) * 0.035,
      vy: -15 - Math.random() * 5,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      trail: [],
      exploded: false,
    });
  }

  explodeRocket(fw) {
    const count = 60 + Math.floor(Math.random() * 40);
    const color = fw.color;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;

      this.particles.push({
        x: fw.x,
        y: fw.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 3,
        color: Math.random() > 0.3 ? color : '#FFFFFF',
        alpha: 1,
        life: 0,
        maxLife: 70 + Math.random() * 40,
        gravity: 0.08,
        friction: 0.95,
        isSparkle: true,
      });
    }

    if (window.soundEngine && Math.random() < 0.6) {
      window.soundEngine.playPop();
    }
  }

  loop() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Update & draw fireworks rockets
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const fw = this.fireworks[i];
      if (!fw.exploded) {
        fw.trail.push({ x: fw.x, y: fw.y });
        if (fw.trail.length > 7) fw.trail.shift();

        fw.x += fw.vx;
        fw.y += fw.vy;
        fw.vy += 0.25; // gravity

        // Draw rocket trail
        this.ctx.beginPath();
        this.ctx.moveTo(fw.trail[0].x, fw.trail[0].y);
        for (const pt of fw.trail) {
          this.ctx.lineTo(pt.x, pt.y);
        }
        this.ctx.strokeStyle = fw.color;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = fw.color;
        this.ctx.shadowBlur = 10;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        if (fw.vy >= -1 || fw.y <= fw.targetY) {
          fw.exploded = true;
          this.explodeRocket(fw);
          this.fireworks.splice(i, 1);
        }
      }
    }

    // Update & draw confetti and sparkle particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;

      if (p.life >= p.maxLife || p.y > this.height + 50) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vx *= p.friction;
      p.vy *= p.friction;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;

      if (p.isSparkle) {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = alpha;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 8;
        this.ctx.fill();
        this.ctx.restore();
      } else {
        // Confetti Ribbon / Square
        p.rotation += p.rotationSpeed;
        p.tilt += p.tiltSpeed;
        const scaleX = Math.cos(p.tilt);

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.scale(scaleX, 1);

        this.ctx.fillStyle = p.color;
        if (p.isRibbon) {
          this.ctx.fillRect(-p.width / 2, -p.size / 2, p.width, p.size);
        } else {
          this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        }
        this.ctx.restore();
      }
    }

    if (this.isActive || this.particles.length > 0 || this.fireworks.length > 0) {
      this.animationId = requestAnimationFrame(() => this.loop());
    } else {
      this.animationId = null;
    }
  }

  // Generates an official Certificate of Winner in Canvas and downloads as PNG
  generateCertificate(winner, roundNumber, prizeName) {
    const certCanvas = document.createElement('canvas');
    certCanvas.width = 1200;
    certCanvas.height = 800;
    const ctx = certCanvas.getContext('2d');

    // Background Gradient (Institutional Luxury Blue)
    const bg = ctx.createLinearGradient(0, 0, 1200, 800);
    bg.addColorStop(0, '#041126');
    bg.addColorStop(0.5, '#0A2B68');
    bg.addColorStop(1, '#020C1C');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 800);

    // Golden Outer Border
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 10;
    ctx.strokeRect(30, 30, 1140, 740);

    // Inner Delicate Border
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(45, 45, 1110, 710);

    // Header Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('INSTITUTO NACIONAL DE ESTADÍSTICA E INFORMÁTICA - INEI', 600, 110);

    ctx.fillStyle = '#00D2FF';
    ctx.font = '600 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText('COMITÉ DE BIENESTAR Y ACTIVIDADES INSTITUCIONALES', 600, 145);

    // Decorative Gold Line
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(400, 170, 400, 4);

    // Main Certificate Heading
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 46px "Segoe UI", Georgia, serif';
    ctx.fillText('CERTIFICADO OFICIAL DE GANADOR', 600, 240);

    ctx.fillStyle = '#E0E8F5';
    ctx.font = '22px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Se certifica solemnemente que en el marco del ${roundNumber}° GRAN SORTEO INSTITUCIONAL`, 600, 295);
    ctx.fillText('ha resultado ganador(a) acreditado(a):', 600, 330);

    // Winner Name in Large Golden Box
    ctx.fillStyle = 'rgba(19, 99, 208, 0.35)';
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(150, 370, 900, 100, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
    ctx.fillText(winner.name.toUpperCase(), 600, 435);

    // Ticket & Prize Details
    ctx.fillStyle = '#00D2FF';
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`N° DE TICKET GANADOR: [ ${winner.ticket} ]`, 600, 520);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'italic 22px "Segoe UI", Georgia, serif';
    ctx.fillText(`PREMIO: ${prizeName.toUpperCase()}`, 600, 560);

    // Date
    const today = new Date().toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    ctx.fillStyle = '#A0B4D0';
    ctx.font = '16px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Emitido en Lima, a los ${today}`, 600, 620);

    // Signatures
    ctx.strokeStyle = '#A0B4D0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(250, 700);
    ctx.lineTo(470, 700);
    ctx.moveTo(730, 700);
    ctx.lineTo(950, 700);
    ctx.stroke();

    ctx.fillStyle = '#E0E8F5';
    ctx.font = '15px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Comisión Organizadora del Sorteo', 360, 725);
    ctx.fillText('Supervisión y Control Institucional', 840, 725);

    // Trigger download
    const link = document.createElement('a');
    link.download = `Certificado_Ganador_${winner.ticket}_Sorteo_${roundNumber}.png`;
    link.href = certCanvas.toDataURL('image/png');
    link.click();
  }
}

window.CelebrationEngine = CelebrationEngine;
