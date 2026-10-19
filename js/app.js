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
  const roundPillsEl = document.getElementById('round-pills');
  const podiumGrid = document.getElementById('podium-grid');
  let sorteoPills = [];
  const activeSorteoTitle = document.getElementById('active-sorteo-title');
  const activePrizeInput = document.getElementById('active-prize-input');

  // Podium Winner Cards
  let podiumCards = {};

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

  const pickTracker = document.getElementById('pick-tracker');
  const missOverlay = document.getElementById('miss-overlay');

  // App State Flags
  let isDrawInProgress = false;
  let autoStopTimer = null;
  let currentWinner = null;

  // Switch Sound Initial State
  if (window.soundEngine && window.soundEngine.isMuted) {
    btnSoundToggle.classList.add('muted');
    btnSoundToggle.querySelector('.label').textContent = 'Sonido: OFF';
  }

  /* -------------------------------------------------------------
     Sorteo Round Selection & Prize Name Editing
  ------------------------------------------------------------- */
  // Tabs and podium cards depend on how many sorteos are configured
  function buildRoundUI() {
    roundPillsEl.innerHTML = state.rounds()
      .map(r => `<button class="sorteo-pill" data-round="${r}">Sorteo ${r}</button>`)
      .join('');
    sorteoPills = Array.from(roundPillsEl.querySelectorAll('.sorteo-pill'));

    podiumGrid.innerHTML = state.rounds().map(r => `
      <div class="podium-card" id="podium-card-${r}" data-round="${r}">
        <div class="podium-card-top">
          <div class="podium-round-badge">${r}° Sorteo</div>
          <span class="podium-status pending">PENDIENTE</span>
        </div>
        <div class="podium-prize"></div>
        <div class="podium-ticket-box">
          <div class="podium-ticket">Pendiente</div>
        </div>
        <div class="podium-name">En espera de sorteo</div>
        <div class="podium-losers"></div>
        <div class="podium-actions">
          <button class="btn-card-action btn-podium-cert hidden" title="Descargar Diploma Oficial">Diploma</button>
          <button class="btn-card-action danger btn-podium-reset hidden" title="Anular ganador y repetir">Repetir</button>
        </div>
      </div>`).join('');
    podiumCards = {};
    state.rounds().forEach(r => { podiumCards[r] = document.getElementById(`podium-card-${r}`); });
  }

  roundPillsEl.addEventListener('click', (e) => {
    const pill = e.target.closest('.sorteo-pill');
    if (!pill || isDrawInProgress) return;
    selectRound(parseInt(pill.dataset.round, 10));
  });

  buildRoundUI();

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
    } else {
      slot.setIdleDisplay();
    }

    // Bring back the balls that belong in this round (e.g. last round's non-winners)
    if (!isDrawInProgress && !tombola.hasWinnerBall() && drumNeedsRebuild()) {
      refreshTombola();
    }

    updateStatsAndUI();
  }

  function updateStartButtonLabel() {
    const round = state.activeRound;
    if (state.winners[round]) {
      btnStartDraw.disabled = true;
      btnStartDraw.textContent = 'YA TIENE GANADOR';
      return;
    }
    btnStartDraw.disabled = false;
    const pick = state.getPickNumber(round);
    btnStartDraw.textContent = pick >= state.PICKS_PER_ROUND
      ? `¡EXTRACCIÓN FINAL DEL SORTEO N° ${round}!`
      : `¡INICIAR EXTRACCIÓN ${pick} DE ${state.PICKS_PER_ROUND}!`;
  }

  // True when the balls in the drum do not match who should be inside for the active round
  function drumNeedsRebuild() {
    const pool = state.getDrawPool();
    const inPool = new Set(pool.map(p => String(p.ticket)));
    const tickets = tombola.getTickets();
    if (tickets.some(t => !inPool.has(t))) return true;
    return pool.length <= 60 && tickets.length !== pool.length;
  }

  function renderPickTracker() {
    const round = state.activeRound;
    const losers = state.losers[round] || [];
    const winner = state.winners[round];
    let html = '';
    for (let i = 1; i <= state.PICKS_PER_ROUND; i++) {
      let cls = '';
      let ticket = '---';
      let label = 'Pendiente';
      if (i <= losers.length) {
        cls = 'miss'; ticket = losers[i - 1].ticket; label = 'No gana';
      } else if (i === state.PICKS_PER_ROUND && winner) {
        cls = 'win'; ticket = winner.ticket; label = 'Ganador';
      } else if (i === losers.length + 1 && !winner) {
        cls = 'current'; label = i === state.PICKS_PER_ROUND ? 'Extracción final' : 'Siguiente';
      }
      html += `<div class="pick-chip ${cls}"><span class="pc-label">Extracción ${i}</span><span class="pc-ticket">${escapeHtml(ticket)}</span><span class="pc-state">${label}</span></div>`;
    }
    pickTracker.innerHTML = html;
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

    // Validation: Already won this round?
    if (state.winners[state.activeRound]) {
      const confirmOverwrite = confirm(
        `El Sorteo N° ${state.activeRound} ya tiene un ganador (${state.winners[state.activeRound].name}). ¿Deseas anularlo y volver a sortear?`
      );
      if (!confirmOverwrite) return;
      state.resetRoundWinner(state.activeRound);
      updateStatsAndUI();
    }

    // Validation: Any participant left in the drum?
    if (state.getDrawPool().length === 0) {
      alert('No hay participantes habilitados disponibles en la tómbola.');
      return;
    }

    // Set draw state
    isDrawInProgress = true;
    btnStartDraw.classList.add('hidden');

    const proceed = () => {
      if (drumNeedsRebuild()) {
        // Balls rejoining from the previous round drop back into the drum
        slot.setIdleDisplay();
        tombola.updateBallsWithParticipants(state.getDrawPool(), true);
        setTimeout(beginSpin, 1700);
      } else {
        beginSpin();
      }
    };

    // The previous winner's ball leaves the drum before the new draw begins
    if (tombola.hasWinnerBall()) {
      slot.setIdleDisplay();
      tombola.retireWinnerBall(proceed);
    } else {
      proceed();
    }
  }

  function isFinalPick(pool) {
    return state.getPickNumber() >= state.PICKS_PER_ROUND || pool.length === 1;
  }

  function beginSpin() {
    const pool = state.getDrawPool();
    btnStopDraw.textContent = isFinalPick(pool) ? '¡DETENER Y PROCLAMAR GANADOR!' : '¡DETENER EXTRACCIÓN!';
    btnStopDraw.classList.remove('hidden');

    // Start Audio
    if (window.soundEngine) {
      window.soundEngine.startDrumroll();
    }

    // Start 3D Tombola and Rapid Slot
    tombola.startMixing();
    slot.startSpin(pool);

    // Auto-stop countdown (7 seconds of epic suspense)
    autoStopTimer = setTimeout(() => {
      finishDraw();
    }, 7000);
  }

  function finishDraw() {
    clearTimeout(autoStopTimer);
    btnStopDraw.disabled = true;

    const pool = state.getDrawPool();
    if (pool.length === 0) {
      isDrawInProgress = false;
      return;
    }

    const round = state.activeRound;
    const pickNumber = state.getPickNumber(round);
    const finalPick = isFinalPick(pool);

    // Pick the extracted ball completely at random from the balls inside the drum
    const picked = pool[Math.floor(Math.random() * pool.length)];

    // Decelerate Tombola and extract ball
    tombola.stopMixing(picked.ticket, finalPick);

    // Decelerate slot flipper through tension steps
    slot.decelerateAndLock(pool, picked, (p) => {
      if (finalPick) {
        onWinnerProclaimed(p);
      } else {
        onMissProclaimed(p, round, pickNumber);
      }
    }, finalPick);
  }

  function onWinnerProclaimed(winner) {
    currentWinner = winner;
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

  // Extractions 1 and 2 of a round: the ball is out for this round, but returns in the next one
  function onMissProclaimed(participant, round, pickNumber) {
    btnStopDraw.disabled = false;
    btnStopDraw.classList.add('hidden');

    state.addLoser(round, participant);
    updateStatsAndUI();

    if (window.soundEngine) {
      window.soundEngine.playMissSound();
    }
    showMissOverlay(participant, round, pickNumber);

    // The ball leaves the drum while the message is on screen
    setTimeout(() => {
      tombola.retireWinnerBall(() => {
        isDrawInProgress = false;
        btnStartDraw.classList.remove('hidden');
        updateStartButtonLabel();
        renderPool();
      });
    }, 1800);
  }

  let missTimer = null;
  function showMissOverlay(participant, round, pickNumber) {
    document.getElementById('miss-ticket').textContent = participant.ticket;
    document.getElementById('miss-title').textContent = pickNumber < state.PICKS_PER_ROUND - 1 ? '¡MALA SUERTE!' : '¡CASI!';
    document.getElementById('miss-sub').textContent = pickNumber < state.PICKS_PER_ROUND - 1 ? 'Sigue intentando' : 'Suerte para la próxima';
    document.getElementById('miss-name').textContent = participant.name;
    document.getElementById('miss-note').textContent = round < state.TOTAL_ROUNDS
      ? 'Su bola sale de la tómbola en este sorteo y vuelve a entrar en el siguiente.'
      : 'Su bola queda fuera de la tómbola en este sorteo.';

    missOverlay.classList.remove('leaving');
    missOverlay.classList.add('active');
    clearTimeout(missTimer);
    missTimer = setTimeout(hideMissOverlay, 3400);
  }

  function hideMissOverlay() {
    clearTimeout(missTimer);
    missOverlay.classList.add('leaving');
    setTimeout(() => missOverlay.classList.remove('active', 'leaving'), 400);
  }
  missOverlay.addEventListener('click', hideMissOverlay);

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

    // Take the winning ball out of the drum so the next draw starts without it
    retireWinnerAnimation();

    // Automatically advance to the next incomplete round
    let nextRound = state.activeRound < state.TOTAL_ROUNDS ? state.activeRound + 1 : 1;
    for (const r of state.rounds()) {
      if (!state.winners[r]) {
        nextRound = r;
        break;
      }
    }
    selectRound(nextRound);
  });

  function retireWinnerAnimation() {
    if (!tombola.hasWinnerBall() || isDrawInProgress) return;
    isDrawInProgress = true;
    tombola.retireWinnerBall(() => {
      isDrawInProgress = false;
    });
  }

  // Keeps the drum in sync with the participants still in play
  function refreshTombola() {
    tombola.updateBallsWithParticipants(state.getDrawPool());
  }

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
    state.rounds().forEach(round => {
      const card = podiumCards[round];
      const winner = state.winners[round];
      const prize = state.prizes[round] || `${round}° Premio`;

      const prizeEl = card.querySelector('.podium-prize');
      const ticketEl = card.querySelector('.podium-ticket');
      const nameEl = card.querySelector('.podium-name');
      const statusBadge = card.querySelector('.podium-status');
      const certBtn = card.querySelector('.btn-podium-cert');
      const resetBtn = card.querySelector('.btn-podium-reset');
      const losersEl = card.querySelector('.podium-losers');
      const roundLosers = state.losers[round] || [];
      if (losersEl) {
        losersEl.textContent = roundLosers.length
          ? `Sin premio: ${roundLosers.map(l => l.ticket).join(', ')}`
          : '';
      }

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
            refreshTombola();
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
    statWinners.textContent = `${winnersCount} / ${state.TOTAL_ROUNDS}`;

    updatePodiumCards();
    renderPool();
    renderPickTracker();
    updateStartButtonLabel();
  }

  /* -------------------------------------------------------------
     Pool drawer: participants still inside the drum
  ------------------------------------------------------------- */
  const poolDrawer = document.getElementById('pool-drawer');
  const poolBackdrop = document.getElementById('pool-backdrop');
  const poolLists = document.getElementById('pool-lists');
  const poolSearch = document.getElementById('pool-search');
  const poolCountIn = document.getElementById('pool-count-in');
  const poolCountOut = document.getElementById('pool-count-out');

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderPool() {
    const q = poolSearch.value.trim().toLowerCase();
    const match = p => !q || String(p.ticket).toLowerCase().includes(q) || String(p.name).toLowerCase().includes(q);
    const eligible = state.getDrawPool();
    const missed = (state.losers[state.activeRound] || []).filter(match);
    const winnerEntries = state.rounds().filter(r => state.winners[r]).map(r => ({ round: r, w: state.winners[r] }));

    poolCountIn.textContent = eligible.length.toLocaleString();
    poolCountOut.textContent = winnerEntries.length;

    const inRows = eligible.filter(match).map(p =>
      `<div class="pool-row"><span class="t">${escapeHtml(p.ticket)}</span><span class="n">${escapeHtml(p.name)}</span></div>`
    ).join('');
    const missRows = missed.map(l =>
      `<div class="pool-row miss"><span class="t">${escapeHtml(l.ticket)}</span><span class="n">${escapeHtml(l.name)}</span><span class="tag miss">Sin premio</span></div>`
    ).join('');
    const outRows = winnerEntries.filter(e => match(e.w)).map(e =>
      `<div class="pool-row out"><span class="t">${escapeHtml(e.w.ticket)}</span><span class="n">${escapeHtml(e.w.name)}</span><span class="tag">Sorteo ${e.round}</span></div>`
    ).join('');

    poolLists.innerHTML =
      `<div class="pool-section-title">Dentro de la tómbola</div>` +
      (inRows || `<div class="pool-empty">Sin participantes.</div>`) +
      `<div class="pool-section-title">Extraídos en el Sorteo ${state.activeRound} (vuelven al siguiente)</div>` +
      (missRows || `<div class="pool-empty">Aún no hay bolas extraídas.</div>`) +
      `<div class="pool-section-title">Fuera de la tómbola (ganadores)</div>` +
      (outRows || `<div class="pool-empty">Aún no hay ganadores.</div>`);
  }

  function setPoolOpen(open) {
    poolDrawer.classList.toggle('active', open);
    poolBackdrop.classList.toggle('active', open);
    poolDrawer.setAttribute('aria-hidden', String(!open));
    if (open) renderPool();
  }

  document.getElementById('btn-open-pool').addEventListener('click', () => setPoolOpen(true));
  document.getElementById('btn-close-pool').addEventListener('click', () => setPoolOpen(false));
  poolBackdrop.addEventListener('click', () => setPoolOpen(false));
  poolSearch.addEventListener('input', renderPool);

  /* -------------------------------------------------------------
     Closable data-loading reminder
  ------------------------------------------------------------- */
  const reminderAside = document.getElementById('reminder-aside');
  const btnShowReminder = document.getElementById('btn-show-reminder');

  function setReminderVisible(visible) {
    reminderAside.classList.toggle('closed', !visible);
    btnShowReminder.classList.toggle('hidden', visible);
    try { localStorage.setItem('inei_reminder_closed', visible ? '0' : '1'); } catch (e) {}
  }

  document.getElementById('btn-close-reminder').addEventListener('click', () => setReminderVisible(false));
  btnShowReminder.addEventListener('click', () => setReminderVisible(true));
  try { if (localStorage.getItem('inei_reminder_closed') === '1') setReminderVisible(false); } catch (e) {}

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

    refreshTombola();
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
    refreshTombola();
    updateStatsAndUI();
    renderPreviewTable();
    showPasteFeedback(`¡Datos de prueba INEI cargados! ${demo.length} participantes listos para sortear.`, 'success');
  });

  // Clear data
  btnClearData.addEventListener('click', () => {
    if (confirm('¿Estás seguro de vaciar toda la lista de participantes y reiniciar los sorteos?')) {
      state.clearAll();
      refreshTombola();
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
        <td style="font-weight: bold; color: ${isWinner ? '#CFEAFB' : '#2E9BE6'};">${p.ticket}</td>
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
    if (confirm('¿Reiniciar todos los sorteos y borrar todos los ganadores actuales? (Los participantes se mantendrán)')) {
      state.resetAllWinners();
      refreshTombola();
      selectRound(1);
      updateStatsAndUI();
      slot.setIdleDisplay();
      alert('Se han reiniciado todos los sorteos. Todos los participantes vuelven a estar habilitados.');
    }
  });

  /* -------------------------------------------------------------
     Draw configuration: number of sorteos and winning extraction
  ------------------------------------------------------------- */
  const configModal = document.getElementById('config-modal');
  const cfgTotalRounds = document.getElementById('cfg-total-rounds');
  const cfgWinnerPick = document.getElementById('cfg-winner-pick');
  const cfgPreview = document.getElementById('cfg-preview');
  const cfgWarning = document.getElementById('cfg-warning');

  function readCfgValue(input, max) {
    return Math.max(1, Math.min(max, parseInt(input.value, 10) || 1));
  }

  function renderCfgPreview() {
    const rounds = readCfgValue(cfgTotalRounds, state.MAX_ROUNDS);
    const pick = readCfgValue(cfgWinnerPick, state.MAX_PICK);
    const misses = pick - 1;
    cfgPreview.textContent = misses === 0
      ? `Se harán ${rounds} sorteo(s). En cada uno, la primera bola que sale es la ganadora.`
      : `Se harán ${rounds} sorteo(s). En cada uno salen ${misses} bola(s) sin premio y la bola N° ${pick} es la ganadora. Las bolas sin premio vuelven a la tómbola en el sorteo siguiente.`;
  }

  function openConfigModal() {
    if (isDrawInProgress) return;
    cfgTotalRounds.value = state.config.totalRounds;
    cfgWinnerPick.value = state.config.winnerPick;
    cfgWarning.classList.toggle('hidden', !state.hasProgress());
    renderCfgPreview();
    configModal.classList.add('active');
  }

  function closeConfigModal() {
    configModal.classList.remove('active');
  }

  document.getElementById('btn-open-config').addEventListener('click', openConfigModal);
  document.getElementById('btn-close-config').addEventListener('click', closeConfigModal);
  document.getElementById('btn-cancel-config').addEventListener('click', closeConfigModal);
  cfgTotalRounds.addEventListener('input', renderCfgPreview);
  cfgWinnerPick.addEventListener('input', renderCfgPreview);

  document.getElementById('btn-save-config').addEventListener('click', () => {
    const rounds = readCfgValue(cfgTotalRounds, state.MAX_ROUNDS);
    const pick = readCfgValue(cfgWinnerPick, state.MAX_PICK);
    const changed = rounds !== state.config.totalRounds || pick !== state.config.winnerPick;
    if (changed) {
      if (state.hasProgress() && !confirm('Cambiar la configuración reiniciará todos los sorteos y ganadores actuales. ¿Continuar?')) {
        return;
      }
      state.setConfig(rounds, pick);
      buildRoundUI();
      refreshTombola();
      selectRound(1);
    }
    closeConfigModal();
  });

  // Initialize UI with saved data (after all const declarations above)
  refreshTombola();
  selectRound(state.activeRound);
});
