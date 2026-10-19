/**
 * Main Application Orchestrator
 * Connects UI, Tombola, Slot, Celebration, and State Engines
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Core Engines
  const tombola = new TombolaEngine('tombola-canvas');
  const slot = new SlotDisplay('slot-ticket', 'slot-name', 'slot-status');
  const celebration = new CelebrationEngine('celebration-canvas');
  const state = window.raffleState;

  // UI Element References
  const btnStartDraw = document.getElementById('btn-start-draw');
  const btnStopDraw = document.getElementById('btn-stop-draw');
  const btnOpenDataModal = document.getElementById('btn-open-data-modal');
  const btnCloseDataModal = document.getElementById('btn-close-data-modal');
  const dataModal = document.getElementById('data-modal');
  const btnProcessPaste = document.getElementById('btn-process-paste');
  const btnLoadDemo = document.getElementById('btn-load-demo');
  const btnClearData = document.getElementById('btn-clear-data');
  const pasteTextarea = document.getElementById('paste-textarea');
  const excelFileInput = document.getElementById('excel-file-input');
  const btnUploadExcel = document.getElementById('btn-upload-excel');
  const pasteFeedback = document.getElementById('paste-feedback');
  const previewContainer = document.getElementById('preview-container');
  const previewTableBody = document.getElementById('preview-table-body');
  const previewCount = document.getElementById('preview-count');

  // Stats Elements
  const statTotal = document.getElementById('stat-total-count');
  const statEligible = document.getElementById('stat-eligible-count');
  const statWinners = document.getElementById('stat-winners-count');

  // Sorteo Tabs / Cards
  const sorteoPills = document.querySelectorAll('.sorteo-pill');
  const activeSorteoTitle = document.getElementById('active-sorteo-title');
  const activePrizeInput = document.getElementById('active-prize-input');

  // Podium Winner Cards
  const podiumCards = {
    1: document.getElementById('podium-card-1'),
    2: document.getElementById('podium-card-2'),
    3: document.getElementById('podium-card-3'),
  };

  // Celebration Modal Elements
  const celebrationModal = document.getElementById('celebration-modal');
  const celebRoundBadge = document.getElementById('celeb-round-badge');
  const celebTicket = document.getElementById('celeb-ticket');
  const celebName = document.getElementById('celeb-name');
  const celebPrize = document.getElementById('celeb-prize');
  const btnDownloadCert = document.getElementById('btn-download-cert');
  const btnNextDraw = document.getElementById('btn-next-draw');
  const btnCloseCeleb = document.getElementById('btn-close-celeb');

  // Header Quick Actions
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnExportResults = document.getElementById('btn-export-results');
  const btnResetAll = document.getElementById('btn-reset-all');

  // App State Flags
  let isDrawInProgress = false;
  let autoStopTimer = null;
  let currentWinner = null;

  // Initialize UI with saved data
  updateStatsAndUI();
  tombola.updateBallsWithParticipants(state.participants);
  slot.setIdleDisplay();

  // Switch Sound Initial State
  if (window.soundEngine && window.soundEngine.isMuted) {
    btnSoundToggle.classList.add('muted');
    btnSoundToggle.querySelector('.label').textContent = 'Sonido: OFF';
  }

  /* -------------------------------------------------------------
     Sorteo Round Selection & Prize Name Editing
  ------------------------------------------------------------- */
  sorteoPills.forEach(pill => {
    pill.addEventListener('click', () => {
      if (isDrawInProgress) return;
      const round = parseInt(pill.dataset.round, 10);
      selectRound(round);
    });
  });

  function selectRound(round) {
    state.activeRound = round;
    state.saveToStorage();

    sorteoPills.forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.round, 10) === round);
    });

    activeSorteoTitle.textContent = `SORTEO N° ${round}`;
    activePrizeInput.value = state.prizes[round] || `${round}° Premio Institucional`;

    // Check if round already won
    if (state.winners[round]) {
      const w = state.winners[round];
      slot.lockWinner(w);
      btnStartDraw.disabled = true;
      btnStartDraw.innerHTML = `<span class="icon">🏆</span> YA TIENE GANADOR`;
    } else {
      slot.setIdleDisplay();
      btnStartDraw.disabled = false;
      btnStartDraw.innerHTML = `<span class="icon">🎲</span> ¡INICIAR SORTEO N° ${round}!`;
    }

    updateStatsAndUI();
  }

  // Update Prize name on input change
  activePrizeInput.addEventListener('input', (e) => {
    state.prizes[state.activeRound] = e.target.value.trim() || `${state.activeRound}° Premio`;
    state.saveToStorage();
    updatePodiumCards();
  });

  /* -------------------------------------------------------------
     Core Draw Workflow (The Roulette / Bingo Sorteo)
  ------------------------------------------------------------- */
  btnStartDraw.addEventListener('click', () => {
    startDraw();
  });

  btnStopDraw.addEventListener('click', () => {
    if (isDrawInProgress) {
      clearTimeout(autoStopTimer);
      finishDraw();
    }
  });

  function startDraw() {
    if (isDrawInProgress) return;

    // Validation: Participants loaded?
    if (!state.participants || state.participants.length === 0) {
      alert('¡Atención! Primero debes cargar la lista de participantes en el botón "Cargar Participantes".');
      openDataModal();
      return;
    }

    // Validation: Any eligible participant left?
    const eligible = state.getEligibleParticipants();
    if (eligible.length === 0) {
      alert('No hay participantes habilitados disponibles. Todos los participantes ya han ganado en sorteos anteriores.');
      return;
    }

    // Validation: Already won this round?
    if (state.winners[state.activeRound]) {
      const confirmOverwrite = confirm(
        `El Sorteo N° ${state.activeRound} ya tiene un ganador (${state.winners[state.activeRound].name}). ¿Deseas anularlo y volver a sortear?`
      );
      if (!confirmOverwrite) return;
      state.resetRoundWinner(state.activeRound);
    }

    // Set draw state
    isDrawInProgress = true;
    btnStartDraw.classList.add('hidden');
    btnStopDraw.classList.remove('hidden');

    // Start Audio
    if (window.soundEngine) {
      window.soundEngine.startDrumroll();
    }

    // Start 3D Tombola and Rapid Slot
    tombola.startMixing();
    slot.startSpin(eligible);

    // Auto-stop countdown (7 seconds of epic suspense)
    autoStopTimer = setTimeout(() => {
      finishDraw();
    }, 7000);
  }

  function finishDraw() {
    clearTimeout(autoStopTimer);
    btnStopDraw.disabled = true;

    const eligible = state.getEligibleParticipants();
    if (eligible.length === 0) {
      isDrawInProgress = false;
      return;
    }

    // Pick Winner completely randomly from eligible pool
    const winnerIndex = Math.floor(Math.random() * eligible.length);
    currentWinner = eligible[winnerIndex];

    // Decelerate Tombola and extract ball
    tombola.stopMixing(currentWinner.ticket);

    // Decelerate slot flipper through tension steps
    slot.decelerateAndLock(eligible, currentWinner, (winner) => {
      onWinnerProclaimed(winner);
    });
  }

  function onWinnerProclaimed(winner) {
    isDrawInProgress = false;
    btnStopDraw.disabled = false;
    btnStopDraw.classList.add('hidden');
    btnStartDraw.classList.remove('hidden');

    // Register in state (Excludes them forever from subsequent rounds!)
    state.setWinner(state.activeRound, winner);
    updateStatsAndUI();

    // Sound fanfare and applause!
    if (window.soundEngine) {
      window.soundEngine.playFanfare();
    }

    // Launch celebratory modal and fireworks
    setTimeout(() => {
      openCelebrationModal(winner, state.activeRound);
    }, 800);
  }

  /* -------------------------------------------------------------
     Celebration Modal & Winner Diploma
  ------------------------------------------------------------- */
  function openCelebrationModal(winner, round) {
    celebRoundBadge.textContent = `¡GANADOR DEL ${round}° SORTEO INSTITUCIONAL!`;
    celebTicket.textContent = winner.ticket;
    celebName.textContent = winner.name;
    celebPrize.textContent = `Premio: ${state.prizes[round] || 'Premio Institucional'}`;

    celebrationModal.classList.add('active');
    celebration.start();
  }

  btnCloseCeleb.addEventListener('click', () => {
    celebrationModal.classList.remove('active');
    celebration.stop();
  });

  btnNextDraw.addEventListener('click', () => {
    celebrationModal.classList.remove('active');
    celebration.stop();

    // Automatically advance to the next incomplete round
    let nextRound = state.activeRound < 3 ? state.activeRound + 1 : 1;
    for (let r = 1; r <= 3; r++) {
      if (!state.winners[r]) {
        nextRound = r;
        break;
      }
    }
    selectRound(nextRound);
  });

  btnDownloadCert.addEventListener('click', () => {
    if (currentWinner) {
      celebration.generateCertificate(
        currentWinner,
        state.activeRound,
        state.prizes[state.activeRound] || 'Premio Especial'
      );
    }
  });

  /* -------------------------------------------------------------
     Podium & Winner Cards Render
  ------------------------------------------------------------- */
  function updatePodiumCards() {
    [1, 2, 3].forEach(round => {
      const card = podiumCards[round];
      const winner = state.winners[round];
      const prize = state.prizes[round] || `${round}° Premio`;

      const prizeEl = card.querySelector('.podium-prize');
      const ticketEl = card.querySelector('.podium-ticket');
      const nameEl = card.querySelector('.podium-name');
      const statusBadge = card.querySelector('.podium-status');
      const certBtn = card.querySelector('.btn-podium-cert');
      const resetBtn = card.querySelector('.btn-podium-reset');

      prizeEl.textContent = prize;

      if (winner) {
        card.classList.add('has-winner');
        ticketEl.textContent = winner.ticket;
        nameEl.textContent = winner.name;
        statusBadge.textContent = '¡GANADOR!';
        statusBadge.className = 'podium-status winner';
        if (certBtn) certBtn.classList.remove('hidden');
        if (resetBtn) resetBtn.classList.remove('hidden');

        certBtn.onclick = (e) => {
          e.stopPropagation();
          celebration.generateCertificate(winner, round, prize);
        };

        resetBtn.onclick = (e) => {
          e.stopPropagation();
          if (confirm(`¿Anular el ganador del Sorteo N° ${round} (${winner.name}) para volver a sortearlo?`)) {
            state.resetRoundWinner(round);
            selectRound(round);
            updateStatsAndUI();
          }
        };
      } else {
        card.classList.remove('has-winner');
        ticketEl.textContent = 'Pendiente';
        nameEl.textContent = 'En espera de sorteo';
        statusBadge.textContent = state.activeRound === round ? 'EN CURSO' : 'PENDIENTE';
        statusBadge.className = `podium-status ${state.activeRound === round ? 'active' : 'pending'}`;
        if (certBtn) certBtn.classList.add('hidden');
        if (resetBtn) resetBtn.classList.add('hidden');
      }

      card.onclick = () => {
        if (!isDrawInProgress) {
          selectRound(round);
        }
      };
    });
  }

  /* -------------------------------------------------------------
     Stats & Global Counters
  ------------------------------------------------------------- */
  function updateStatsAndUI() {
    const total = state.participants.length;
    const eligible = state.getEligibleParticipants().length;
    const winnersCount = Object.values(state.winners).filter(Boolean).length;

    statTotal.textContent = total.toLocaleString();
    statEligible.textContent = eligible.toLocaleString();
    statWinners.textContent = `${winnersCount} / 3`;

    updatePodiumCards();
  }

  /* -------------------------------------------------------------
     Excel Copy-Paste & File Modal Logic
  ------------------------------------------------------------- */
  btnOpenDataModal.addEventListener('click', openDataModal);
  btnCloseDataModal.addEventListener('click', closeDataModal);

  function openDataModal() {
    dataModal.classList.add('active');
    renderPreviewTable();
  }

  function closeDataModal() {
    dataModal.classList.remove('active');
  }

  // Process text pasted from Excel
  btnProcessPaste.addEventListener('click', () => {
    const text = pasteTextarea.value.trim();
    if (!text) {
      showPasteFeedback('El cuadro de texto está vacío. Pega tus datos de Excel primero.', 'error');
      return;
    }

    const result = state.parsePastedData(text);
    if (!result.success) {
      showPasteFeedback(result.error, 'error');
      return;
    }

    state.participants = result.data;
    state.saveToStorage();

    tombola.updateBallsWithParticipants(state.participants);
    updateStatsAndUI();
    renderPreviewTable();

    let msg = `¡Éxito! Se cargaron ${result.totalParsed} participantes correctamente.`;
    if (result.skippedHeader) {
      msg += ' (Se omitió la fila de encabezados automáticamente).';
    }
    if (result.duplicatesCount > 0) {
      msg += ` [Aviso: Se omitieron ${result.duplicatesCount} tickets duplicados].`;
    }
    showPasteFeedback(msg, 'success');
  });

  // Load Demo Data (60 INEI workers)
  btnLoadDemo.addEventListener('click', () => {
    const demo = state.loadDemoData();
    tombola.updateBallsWithParticipants(demo);
    updateStatsAndUI();
    renderPreviewTable();
    showPasteFeedback(`¡Datos de prueba INEI cargados! ${demo.length} participantes listos para sortear.`, 'success');
  });

  // Clear data
  btnClearData.addEventListener('click', () => {
    if (confirm('¿Estás seguro de vaciar toda la lista de participantes y reiniciar los sorteos?')) {
      state.clearAll();
      tombola.updateBallsWithParticipants([]);
      updateStatsAndUI();
      renderPreviewTable();
      pasteTextarea.value = '';
      slot.setIdleDisplay();
      showPasteFeedback('Se borraron todos los participantes.', 'info');
    }
  });

  // File Upload (.xlsx, .csv)
  btnUploadExcel.addEventListener('click', () => excelFileInput.click());

  excelFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        if (!window.XLSX) {
          throw new Error('Módulo SheetJS no disponible para leer .xlsx directamente.');
        }
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const csvContent = XLSX.utils.sheet_to_csv(sheet);

        pasteTextarea.value = csvContent;
        btnProcessPaste.click();
      } catch (err) {
        showPasteFeedback('Error leyendo archivo Excel: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    excelFileInput.value = ''; // Reset
  });

  function showPasteFeedback(text, type = 'info') {
    pasteFeedback.textContent = text;
    pasteFeedback.className = `feedback-box ${type}`;
    pasteFeedback.classList.remove('hidden');
  }

  function renderPreviewTable() {
    previewTableBody.innerHTML = '';
    const list = state.participants;
    previewCount.textContent = `${list.length} registros`;

    if (list.length === 0) {
      previewTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 24px; color: #88a0c0;">No hay participantes cargados. Pega columnas desde Excel o pulsa "Cargar Demostración INEI".</td></tr>`;
      return;
    }

    const wonTickets = Object.values(state.winners).filter(Boolean).map(w => w.ticket);

    // Show first 20 entries in preview
    list.slice(0, 25).forEach((p, idx) => {
      const isWinner = wonTickets.includes(p.ticket);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: bold; color: ${isWinner ? '#FFD700' : '#00D2FF'};">${p.ticket}</td>
        <td>${p.name}</td>
        <td><span class="preview-badge ${isWinner ? 'won' : 'eligible'}">${isWinner ? 'Ganador (Excluido)' : 'Habilitado'}</span></td>
      `;
      previewTableBody.appendChild(tr);
    });

    if (list.length > 25) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="3" style="text-align:center; font-style: italic; color: #88a0c0;">... y ${list.length - 25} participantes más.</td>`;
      previewTableBody.appendChild(tr);
    }
  }

  /* -------------------------------------------------------------
     Header Controls (Sound, Fullscreen, Export, Reset)
  ------------------------------------------------------------- */
  btnSoundToggle.addEventListener('click', () => {
    if (window.soundEngine) {
      const isMuted = window.soundEngine.toggleMute();
      btnSoundToggle.classList.toggle('muted', isMuted);
      btnSoundToggle.querySelector('.label').textContent = isMuted ? 'Sonido: OFF' : 'Sonido: ON';
    }
  });

  btnFullscreen.addEventListener('click', () => {
    if (window.electronAPI && window.electronAPI.toggleFullscreen) {
      window.electronAPI.toggleFullscreen();
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.warn(err));
      } else {
        document.exitFullscreen().catch(err => console.warn(err));
      }
    }
  });

  btnExportResults.addEventListener('click', () => {
    state.exportResultsCSV();
  });

  btnResetAll.addEventListener('click', () => {
    if (confirm('¿Reiniciar los 3 sorteos y borrar todos los ganadores actuales? (Los participantes se mantendrán)')) {
      state.resetAllWinners();
      selectRound(1);
      updateStatsAndUI();
      slot.setIdleDisplay();
      alert('Se han reiniciado los 3 sorteos. Todos los participantes vuelven a estar habilitados.');
    }
  });
});
