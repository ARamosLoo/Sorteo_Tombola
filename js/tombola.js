/**
 * 3D-effect Interactive Lottery Tumbler (Tómbola / Bombo de Bingo)
 * High-performance Canvas animation with physics-based bouncing balls
 */
class TombolaEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = 440;
    this.height = 440;
    this.centerX = 220;
    this.centerY = 210;
    this.radius = 165; // Sphere radius

    this.balls = [];
    this.ballCount = 48;
    this.state = 'idle'; // 'idle', 'mixing', 'stopping', 'locked'
    this.rotationAngle = 0;
    this.rotationSpeed = 0.008;
    this.mixingSpeed = 0.08;
    this.targetRotationSpeed = 0.008;

    this.activeWinningBall = null;
    this.animationFrameId = null;

    this.ballColors = [
      { bg: '#1363D0', text: '#FFFFFF', name: 'blue' },   // INEI Royal Blue
      { bg: '#0A2B68', text: '#FFFFFF', name: 'darkblue' }, // INEI Navy
      { bg: '#00D2FF', text: '#0A2B68', name: 'cyan' },   // INEI Cyan
      { bg: '#F5B027', text: '#000000', name: 'gold' },   // Gold
      { bg: '#FFFFFF', text: '#1363D0', name: 'white' },  // White
      { bg: '#E30613', text: '#FFFFFF', name: 'red' },    // Peru Accent
    ];

    this.initCanvas();
    this.initBalls();
    this.startLoop();
  }

  initCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 440;
    this.height = rect.height || 440;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.centerX = this.width / 2;
    this.centerY = this.height / 2 - 10;
    this.radius = Math.min(this.width, this.height) * 0.38;
  }

  initBalls(sampleNumbers = []) {
    this.balls = [];
    const count = Math.min(Math.max(this.ballCount, 30), 60);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (this.radius - 32);
      const colorObj = this.ballColors[i % this.ballColors.length];
      const number = sampleNumbers[i] || (i + 1);

      this.balls.push({
        x: this.centerX + Math.cos(angle) * dist,
        y: this.centerY + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        r: 17,
        color: colorObj,
        number: String(number),
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
      });
    }
  }

  updateBallsWithParticipants(participants) {
    if (!participants || participants.length === 0) {
      this.initBalls();
      return;
    }
    const numbers = participants.slice(0, 60).map(p => p.ticket);
    this.initBalls(numbers);
  }

  startMixing() {
    this.state = 'mixing';
    this.targetRotationSpeed = 0.09;
    this.activeWinningBall = null;

    // Give high-energy impulse to all balls
    this.balls.forEach(b => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 7 + Math.random() * 8;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
      b.rotSpeed = (Math.random() - 0.5) * 0.3;
    });
  }

  stopMixing(winningTicket = null) {
    this.state = 'stopping';
    this.targetRotationSpeed = 0.015;

    // Pick or prepare the winning ball to float to the center
    if (winningTicket) {
      const ball = this.balls[0];
      ball.number = String(winningTicket);
      ball.color = { bg: '#FFD700', text: '#002B49', name: 'winner-gold' };
      this.activeWinningBall = ball;
    }

    setTimeout(() => {
      this.state = 'locked';
      this.targetRotationSpeed = 0.004;
    }, 1800);
  }

  reset() {
    this.state = 'idle';
    this.targetRotationSpeed = 0.008;
    this.activeWinningBall = null;
  }

  updatePhysics() {
    // Smoothly adjust cage rotation
    this.rotationSpeed += (this.targetRotationSpeed - this.rotationSpeed) * 0.05;
    this.rotationAngle += this.rotationSpeed;

    const gravity = this.state === 'mixing' ? 0.08 : 0.22;
    const friction = this.state === 'mixing' ? 0.992 : 0.97;
    const maxSpeed = this.state === 'mixing' ? 14 : 4;

    this.balls.forEach((ball, idx) => {
      // Swirling centrifugal force during mixing
      if (this.state === 'mixing') {
        const dx = ball.x - this.centerX;
        const dy = ball.y - this.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Vortex swirl
        ball.vx += (-dy / (dist + 1)) * 0.65;
        ball.vy += (dx / (dist + 1)) * 0.65;

        // Random air turbulences
        ball.vx += (Math.random() - 0.5) * 0.8;
        ball.vy += (Math.random() - 0.5) * 0.8;

        // Occasional audio bounce
        if (Math.random() < 0.03 && window.soundEngine) {
          window.soundEngine.playBallBounce();
        }
      } else {
        ball.vy += gravity;
      }

      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx *= friction;
      ball.vy *= friction;
      ball.rot += ball.rotSpeed;

      // Clamp max speed
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed > maxSpeed) {
        ball.vx = (ball.vx / speed) * maxSpeed;
        ball.vy = (ball.vy / speed) * maxSpeed;
      }

      // Constrain inside circle (elastic collision with glass wall)
      const dx = ball.x - this.centerX;
      const dy = ball.y - this.centerY;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const maxDist = this.radius - ball.r - 4;

      if (distFromCenter > maxDist) {
        const nx = dx / distFromCenter;
        const ny = dy / distFromCenter;
        ball.x = this.centerX + nx * maxDist;
        ball.y = this.centerY + ny * maxDist;

        // Reflect velocity along normal
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx -= 1.85 * dot * nx;
        ball.vy -= 1.85 * dot * ny;

        // Spin friction on wall hit
        ball.rotSpeed = (Math.random() - 0.5) * 0.15;
      }
    });

    // Special animation if winning ball is extracted
    if (this.activeWinningBall && (this.state === 'stopping' || this.state === 'locked')) {
      const targetX = this.centerX;
      const targetY = this.centerY;
      this.activeWinningBall.x += (targetX - this.activeWinningBall.x) * 0.08;
      this.activeWinningBall.y += (targetY - this.activeWinningBall.y) * 0.08;
      this.activeWinningBall.vx *= 0.8;
      this.activeWinningBall.vy *= 0.8;
      if (this.activeWinningBall.r < 32) {
        this.activeWinningBall.r += 0.3; // Grow slightly to stand out
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Stand & Base
    this.drawPedestal();

    // 2. Draw Sphere Background (Deep transparent glass)
    const glassGrad = this.ctx.createRadialGradient(
      this.centerX - this.radius * 0.3,
      this.centerY - this.radius * 0.3,
      10,
      this.centerX,
      this.centerY,
      this.radius
    );
    glassGrad.addColorStop(0, 'rgba(19, 99, 208, 0.12)');
    glassGrad.addColorStop(0.7, 'rgba(10, 43, 104, 0.45)');
    glassGrad.addColorStop(1, 'rgba(5, 20, 55, 0.85)');

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = glassGrad;
    this.ctx.fill();

    // Subtle inner glowing grid/ribs
    this.drawSphereRibs();
    this.ctx.restore();

    // 3. Draw All Balls
    this.balls.forEach(ball => {
      if (ball !== this.activeWinningBall) {
        this.drawBall(ball);
      }
    });

    // 4. Draw Winning Ball on Top (if active)
    if (this.activeWinningBall) {
      // Golden aura behind winning ball
      const auraGrad = this.ctx.createRadialGradient(
        this.activeWinningBall.x,
        this.activeWinningBall.y,
        5,
        this.activeWinningBall.x,
        this.activeWinningBall.y,
        this.activeWinningBall.r * 2.2
      );
      auraGrad.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
      auraGrad.addColorStop(0.5, 'rgba(255, 170, 0, 0.3)');
      auraGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(this.activeWinningBall.x, this.activeWinningBall.y, this.activeWinningBall.r * 2.2, 0, Math.PI * 2);
      this.ctx.fillStyle = auraGrad;
      this.ctx.fill();
      this.ctx.restore();

      this.drawBall(this.activeWinningBall, true);
    }

    // 5. Draw Glass Outer Reflection & Rim
    this.drawGlassHighlights();

    // 6. Draw Center Axle and Brass Rings
    this.drawMechanicalFrame();
  }

  drawBall(ball, isWinner = false) {
    const { x, y, r, color, number, rot } = ball;

    this.ctx.save();
    this.ctx.translate(x, y);

    // Ball Drop Shadow inside glass
    this.ctx.beginPath();
    this.ctx.arc(2, 3, r, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    this.ctx.fill();

    // 3D Sphere Radial Gradient
    const ballGrad = this.ctx.createRadialGradient(
      -r * 0.35,
      -r * 0.35,
      r * 0.1,
      0,
      0,
      r
    );
    if (isWinner) {
      ballGrad.addColorStop(0, '#FFF59D');
      ballGrad.addColorStop(0.3, '#FFD700');
      ballGrad.addColorStop(0.85, '#D48806');
      ballGrad.addColorStop(1, '#874D00');
    } else {
      ballGrad.addColorStop(0, '#FFFFFF');
      ballGrad.addColorStop(0.2, color.bg);
      ballGrad.addColorStop(0.85, color.bg);
      ballGrad.addColorStop(1, '#051833');
    }

    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.fillStyle = ballGrad;
    this.ctx.fill();

    // Ball border
    this.ctx.strokeStyle = isWinner ? '#FFE082' : 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = isWinner ? 2.5 : 1;
    this.ctx.stroke();

    // White circle for number
    this.ctx.rotate(rot);
    const badgeR = r * 0.58;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, badgeR, 0, Math.PI * 2);
    this.ctx.fillStyle = isWinner ? '#FFFFFF' : 'rgba(255, 255, 255, 0.92)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Number text
    this.ctx.fillStyle = isWinner ? '#0A2B68' : (color.name === 'gold' ? '#333' : '#0B3880');
    this.ctx.font = `bold ${Math.round(r * 0.65)}px "Segoe UI", Roboto, Arial, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Format number to fit
    const displayNum = number.length > 5 ? number.slice(-4) : number;
    this.ctx.fillText(displayNum, 0, 1);

    this.ctx.restore();
  }

  drawSphereRibs() {
    this.ctx.save();
    this.ctx.translate(this.centerX, this.centerY);
    this.ctx.rotate(this.rotationAngle);

    this.ctx.strokeStyle = 'rgba(0, 210, 255, 0.25)';
    this.ctx.lineWidth = 2;

    // 3 Rotating Longitudinal Ribs
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI) / 3;
      this.ctx.beginPath();
      const xRad = this.radius * Math.cos(ang + this.rotationAngle * 0.5);
      this.ctx.ellipse(0, 0, Math.abs(xRad), this.radius, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Horizontal equator ring
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, this.radius, this.radius * 0.25, 0, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawGlassHighlights() {
    // Outer Metallic Chrome / Gold Ring
    const rimGrad = this.ctx.createLinearGradient(
      this.centerX - this.radius,
      this.centerY - this.radius,
      this.centerX + this.radius,
      this.centerY + this.radius
    );
    rimGrad.addColorStop(0, '#00D2FF');
    rimGrad.addColorStop(0.3, '#1363D0');
    rimGrad.addColorStop(0.5, '#FFFFFF');
    rimGrad.addColorStop(0.7, '#FFD700');
    rimGrad.addColorStop(1, '#0A2B68');

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = rimGrad;
    this.ctx.shadowColor = '#00D2FF';
    this.ctx.shadowBlur = 12;
    this.ctx.stroke();

    // Curved Specular Glass Glare
    this.ctx.shadowBlur = 0;
    this.ctx.beginPath();
    this.ctx.arc(
      this.centerX,
      this.centerY,
      this.radius * 0.92,
      Math.PI * 1.15,
      Math.PI * 1.7
    );
    this.ctx.lineWidth = 7;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    this.ctx.stroke();

    // Small lower counter-reflection
    this.ctx.beginPath();
    this.ctx.arc(
      this.centerX,
      this.centerY,
      this.radius * 0.92,
      Math.PI * 0.2,
      Math.PI * 0.45
    );
    this.ctx.lineWidth = 3.5;
    this.ctx.strokeStyle = 'rgba(0, 210, 255, 0.35)';
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawPedestal() {
    const baseX = this.centerX;
    const baseY = this.centerY + this.radius;

    this.ctx.save();

    // Left and Right Arms supporting the drum
    const armGrad = this.ctx.createLinearGradient(baseX - this.radius - 20, 0, baseX + this.radius + 20, 0);
    armGrad.addColorStop(0, '#0A2B68');
    armGrad.addColorStop(0.5, '#1363D0');
    armGrad.addColorStop(1, '#0A2B68');

    // Triangular / Curved support brackets
    this.ctx.fillStyle = armGrad;
    this.ctx.strokeStyle = '#00D2FF';
    this.ctx.lineWidth = 2;

    // Left pivot
    this.ctx.beginPath();
    this.ctx.moveTo(this.centerX - this.radius - 8, this.centerY);
    this.ctx.lineTo(this.centerX - this.radius - 20, this.centerY + 55);
    this.ctx.lineTo(this.centerX - 60, this.height - 18);
    this.ctx.lineTo(this.centerX - 50, this.height - 18);
    this.ctx.lineTo(this.centerX - this.radius, this.centerY + 45);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Right pivot
    this.ctx.beginPath();
    this.ctx.moveTo(this.centerX + this.radius + 8, this.centerY);
    this.ctx.lineTo(this.centerX + this.radius + 20, this.centerY + 55);
    this.ctx.lineTo(this.centerX + 60, this.height - 18);
    this.ctx.lineTo(this.centerX + 50, this.height - 18);
    this.ctx.lineTo(this.centerX + this.radius, this.centerY + 45);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Base platform
    const platformGrad = this.ctx.createLinearGradient(0, this.height - 24, 0, this.height);
    platformGrad.addColorStop(0, '#1363D0');
    platformGrad.addColorStop(0.5, '#0A2B68');
    platformGrad.addColorStop(1, '#031024');

    this.ctx.fillStyle = platformGrad;
    this.ctx.beginPath();
    this.ctx.roundRect(this.centerX - 120, this.height - 24, 240, 20, [8, 8, 4, 4]);
    this.ctx.fill();
    this.ctx.strokeStyle = '#00D2FF';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Golden INEI Plate on base
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillRect(this.centerX - 40, this.height - 16, 80, 5);

    this.ctx.restore();
  }

  drawMechanicalFrame() {
    this.ctx.save();
    // Central Pivot Axle
    this.ctx.beginPath();
    this.ctx.arc(this.centerX - this.radius - 5, this.centerY, 10, 0, Math.PI * 2);
    this.ctx.arc(this.centerX + this.radius + 5, this.centerY, 10, 0, Math.PI * 2);
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fill();
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();
  }

  startLoop() {
    const loop = () => {
      this.updatePhysics();
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

window.TombolaEngine = TombolaEngine;
