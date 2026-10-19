/**
 * Digital Slot & Ticket Display with suspense deceleration curves
 */
class SlotDisplay {
  constructor(ticketElId, nameElId, statusElId) {
    this.ticketEl = document.getElementById(ticketElId);
    this.nameEl = document.getElementById(nameElId);
    this.statusEl = document.getElementById(statusElId);
    this.timer = null;
    this.isSpinning = false;
  }

  setIdleDisplay() {
    this.ticketEl.textContent = '--- ---';
    this.ticketEl.classList.remove('locking-in', 'winner-locked');
    this.nameEl.textContent = 'Presiona "INICIAR SORTEO" para comenzar';
    this.nameEl.classList.remove('winner-name');
    if (this.statusEl) {
      this.statusEl.textContent = 'LISTO PARA SORTEAR';
      this.statusEl.className = 'status-tag status-ready';
    }
  }

  showTicket(ticket, name) {
    this.ticketEl.textContent = ticket;
    this.nameEl.textContent = name;
  }

  startSpin(eligibleParticipants) {
    if (!eligibleParticipants || eligibleParticipants.length === 0) return;
    this.isSpinning = true;
    this.ticketEl.classList.remove('winner-locked');
    this.ticketEl.classList.add('locking-in');
    this.nameEl.classList.remove('winner-name');

    if (this.statusEl) {
      this.statusEl.textContent = 'MEZCLANDO Y SORTEANDO...';
      this.statusEl.className = 'status-tag status-mixing';
    }

    let interval = 45; // Rapid initial spin

    const spinStep = () => {
      if (!this.isSpinning) return;
      const randIdx = Math.floor(Math.random() * eligibleParticipants.length);
      const item = eligibleParticipants[randIdx];
      
      this.ticketEl.textContent = item.ticket;
      this.nameEl.textContent = item.name;

      if (window.soundEngine && Math.random() < 0.6) {
        window.soundEngine.playTick(600 + Math.random() * 300, 0.025);
      }

      this.timer = setTimeout(spinStep, interval);
    };

    spinStep();
  }

  decelerateAndLock(eligibleParticipants, winner, onComplete) {
    this.isSpinning = false;
    clearTimeout(this.timer);

    if (this.statusEl) {
      this.statusEl.textContent = '¡SELECCIONANDO GANADOR!';
      this.statusEl.className = 'status-tag status-suspense';
    }

    // Step sequence with increasing delays: [60, 90, 140, 220, 340, 500, 750]
    const steps = [50, 75, 110, 160, 240, 360, 520, 750, 1050];
    let stepIndex = 0;

    const nextStep = () => {
      if (stepIndex < steps.length - 1) {
        const randIdx = Math.floor(Math.random() * eligibleParticipants.length);
        const item = eligibleParticipants[randIdx];

        this.ticketEl.textContent = item.ticket;
        this.nameEl.textContent = item.name;

        // Progressive tension sound: pitch drops slightly as it slows
        const pitch = 700 - (stepIndex * 40);
        if (window.soundEngine) {
          window.soundEngine.playTick(pitch, 0.045);
        }

        const delay = steps[stepIndex];
        stepIndex++;
        this.timer = setTimeout(nextStep, delay);
      } else {
        // LOCK IN FINAL WINNER
        this.lockWinner(winner);
        if (onComplete) onComplete(winner);
      }
    };

    nextStep();
  }

  lockWinner(winner) {
    clearTimeout(this.timer);
    this.isSpinning = false;

    this.ticketEl.textContent = winner.ticket;
    this.nameEl.textContent = winner.name;

    this.ticketEl.classList.remove('locking-in');
    this.ticketEl.classList.add('winner-locked');
    this.nameEl.classList.add('winner-name');

    if (this.statusEl) {
      this.statusEl.textContent = '¡TENEMOS UN GANADOR!';
      this.statusEl.className = 'status-tag status-winner';
    }
  }

  stopImmediately() {
    this.isSpinning = false;
    clearTimeout(this.timer);
  }
}

window.SlotDisplay = SlotDisplay;
