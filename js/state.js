/**
 * State Management & Data Processing Engine
 * Handles Excel parsing, exclusions, rounds, and persistence
 */
class RaffleState {
  constructor() {
    this.STORAGE_KEY = 'inei_sorteo_state_v1';
    this.MAX_ROUNDS = 10;
    this.MAX_PICK = 10;
    this.participants = [];
    // Configurable: how many sorteos are held and which extraction of each sorteo wins
    this.config = { totalRounds: 3, winnerPick: 3 };
    this.winners = this.emptyWinners();
    this.prizes = this.defaultPrizes();
    this.activeRound = 1;
    // Non-winning balls per round (every extraction before the winning one). They re-enter the next round.
    this.losers = this.emptyLosers();
    this.loadFromStorage();
  }

  get TOTAL_ROUNDS() {
    return this.config.totalRounds;
  }

  get PICKS_PER_ROUND() {
    return this.config.winnerPick;
  }

  rounds() {
    return Array.from({ length: this.config.totalRounds }, (_, i) => i + 1);
  }

  emptyWinners() {
    const o = {};
    for (let r = 1; r <= this.MAX_ROUNDS; r++) o[r] = null;
    return o;
  }

  emptyLosers() {
    const o = {};
    for (let r = 1; r <= this.MAX_ROUNDS; r++) o[r] = [];
    return o;
  }

  defaultPrizes() {
    const o = {};
    for (let r = 1; r <= this.MAX_ROUNDS; r++) o[r] = `${r}° Premio Institucional`;
    return o;
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.participants = parsed.participants || [];
        this.config = Object.assign(this.config, parsed.config || {});
        this.winners = Object.assign(this.emptyWinners(), parsed.winners || {});
        this.prizes = Object.assign(this.defaultPrizes(), parsed.prizes || {});
        this.losers = Object.assign(this.emptyLosers(), parsed.losers || {});
        this.activeRound = Math.min(parsed.activeRound || 1, this.config.totalRounds);
      }
    } catch (e) {
      console.warn('Error loading state from localStorage:', e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          participants: this.participants,
          winners: this.winners,
          prizes: this.prizes,
          activeRound: this.activeRound,
          losers: this.losers,
          config: this.config,
        })
      );
    } catch (e) {
      console.warn('Error saving state to localStorage:', e);
    }
  }

  // True when any extraction or winner has already been recorded
  hasProgress() {
    return this.rounds().some(r => this.winners[r] || (this.losers[r] || []).length > 0);
  }

  // Changes the number of sorteos and which extraction wins. Existing progress is cleared.
  setConfig(totalRounds, winnerPick) {
    const clamp = (v, max) => Math.max(1, Math.min(max, parseInt(v, 10) || 1));
    this.config = {
      totalRounds: clamp(totalRounds, this.MAX_ROUNDS),
      winnerPick: clamp(winnerPick, this.MAX_PICK),
    };
    this.winners = this.emptyWinners();
    this.losers = this.emptyLosers();
    this.activeRound = 1;
    this.saveToStorage();
  }

  // Returns all participants eligible for the current or next draw
  // (Excludes anyone who has already won in ANY of the draws!)
  getEligibleParticipants() {
    const wonTickets = this.rounds()
      .map(r => this.winners[r])
      .filter(w => w)
      .map(w => String(w.ticket).trim().toLowerCase());

    return this.participants.filter(
      p => !wonTickets.includes(String(p.ticket).trim().toLowerCase())
    );
  }

  // Participants whose balls are inside the drum for the given round:
  // everyone who has not won, minus the balls already extracted (and lost) in this round
  getDrawPool(round = this.activeRound) {
    const out = (this.losers[round] || []).map(l => String(l.ticket).trim().toLowerCase());
    return this.getEligibleParticipants().filter(
      p => !out.includes(String(p.ticket).trim().toLowerCase())
    );
  }

  // 1 = first extraction of the round; the winning one is PICKS_PER_ROUND
  getPickNumber(round = this.activeRound) {
    return (this.losers[round] || []).length + 1;
  }

  addLoser(round, participant) {
    if (!this.losers[round]) this.losers[round] = [];
    this.losers[round].push({ ticket: participant.ticket, name: participant.name });
    this.saveToStorage();
  }

  // Set winner for the given round
  setWinner(round, winner) {
    if (!this.winners[round]) {
      this.winners[round] = {
        ticket: winner.ticket,
        name: winner.name,
        wonAt: new Date().toISOString(),
        prize: this.prizes[round],
      };
      this.saveToStorage();
    }
  }

  // Reset a specific round's winner
  resetRoundWinner(round) {
    this.winners[round] = null;
    this.losers[round] = [];
    this.saveToStorage();
  }

  // Full reset with all winners cleared
  resetAllWinners() {
    this.winners = this.emptyWinners();
    this.losers = this.emptyLosers();
    this.activeRound = 1;
    this.saveToStorage();
  }

  // Clear all participants and winners
  clearAll() {
    this.participants = [];
    this.winners = this.emptyWinners();
    this.losers = this.emptyLosers();
    this.activeRound = 1;
    this.saveToStorage();
  }

  // Check if all draws have winners
  areAllRoundsComplete() {
    return this.rounds().every(r => this.winners[r]);
  }

  /**
   * Smart Excel Clipboard & Text Parser
   * Handles:
   * - Excel Ctrl+V tab-separated columns: [Ticket] \t [Persona]
   * - Comma, semicolon, pipe separators
   * - Automatic header removal
   * - Duplicate ticket detection and sanitization
   */
  parsePastedData(rawText) {
    if (!rawText || !rawText.trim()) {
      return { success: false, error: 'El texto pegado está vacío.' };
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      return { success: false, error: 'No se encontraron líneas válidas.' };
    }

    const parsedList = [];
    const seenTickets = new Set();
    let duplicatesCount = 0;
    let skippedHeader = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect separator: Tab, Semicolon, Comma, Pipe
      let parts = [];
      if (line.includes('\t')) {
        parts = line.split('\t');
      } else if (line.includes(';')) {
        parts = line.split(';');
      } else if (line.includes('|')) {
        parts = line.split('|');
      } else if (line.includes(',')) {
        // Handle comma while respecting possible quotes
        parts = line.split(',');
      } else {
        // Fallback: split on multiple spaces
        parts = line.split(/\s{2,}/);
      }

      parts = parts.map(p => p.replace(/^["']|["']$/g, '').trim()).filter(Boolean);

      if (parts.length >= 2) {
        let ticket = parts[0];
        let name = parts.slice(1).join(' ').trim();

        // Check if first line is a table header (e.g. "Ticket", "N°", "Nombre", "Persona")
        if (i === 0) {
          const lowerTicket = ticket.toLowerCase();
          const lowerName = name.toLowerCase();
          const isHeader =
            lowerTicket.includes('ticket') ||
            lowerTicket.includes('nro') ||
            lowerTicket.includes('número') ||
            lowerTicket.includes('codigo') ||
            lowerTicket.includes('id') ||
            lowerName.includes('nombre') ||
            lowerName.includes('persona') ||
            lowerName.includes('participante') ||
            lowerName.includes('colaborador');

          if (isHeader) {
            skippedHeader = true;
            continue;
          }
        }

        // Deduplication check
        const cleanTicket = String(ticket).trim();
        const normKey = cleanTicket.toLowerCase();

        if (seenTickets.has(normKey)) {
          duplicatesCount++;
          continue; // Ignore duplicate ticket to maintain integrity
        }

        seenTickets.add(normKey);
        parsedList.push({
          ticket: cleanTicket,
          name: name,
        });
      }
    }

    if (parsedList.length === 0) {
      return {
        success: false,
        error:
          'No se pudieron identificar las 2 columnas (Número de Ticket y Persona). Asegúrate de copiar ambas columnas desde Excel.',
      };
    }

    return {
      success: true,
      data: parsedList,
      totalParsed: parsedList.length,
      duplicatesCount: duplicatesCount,
      skippedHeader: skippedHeader,
    };
  }

  // Load 60 realistic INEI staff entries for 1-click test
  loadDemoData() {
    const demoStaff = [
      { ticket: 'T-1001', name: 'Lic. Rosa Huamán Castillo - Dir. Censos' },
      { ticket: 'T-1002', name: 'Ing. Carlos Mendoza Quispe - Informática' },
      { ticket: 'T-1003', name: 'Mag. Elena Flores Ramos - Cuentas Nacionales' },
      { ticket: 'T-1004', name: 'Eco. Jorge Sánchez Vega - Indicadores Económicos' },
      { ticket: 'T-1005', name: 'Lic. Carmen Torres Paredes - Recursos Humanos' },
      { ticket: 'T-1006', name: 'Ing. Miguel Ángel Benites - Cartografía Digital' },
      { ticket: 'T-1007', name: 'Dra. Patricia Silva Morales - Metodologías' },
      { ticket: 'T-1008', name: 'Lic. Fernando Castro Vidal - Difusión y Comunicaciones' },
      { ticket: 'T-1009', name: 'Lic. Silvia Delgado Rivas - Estadística Social' },
      { ticket: 'T-1010', name: 'Ing. David Romero Salazar - Infraestructura TI' },
      { ticket: 'T-1011', name: 'Bach. Andrea Morales Pinedo - Logística' },
      { ticket: 'T-1012', name: 'Eco. Raúl Villanueva Gil - Cuentas Agropecuarias' },
      { ticket: 'T-1013', name: 'Lic. Maritza Huaccachi Ortiz - Encuestas de Hogares' },
      { ticket: 'T-1014', name: 'Ing. Víctor Callao Cárdenas - Seguridad de Datos' },
      { ticket: 'T-1015', name: 'Lic. Jessica Espinoza Chávez - Secretaría General' },
      { ticket: 'T-1016', name: 'Eco. Alberto Guevara Tello - Índice de Precios' },
      { ticket: 'T-1017', name: 'Lic. Vanessa Alarcón Pinto - Asesoría Jurídica' },
      { ticket: 'T-1018', name: 'Ing. Julio César Vargas - Big Data Institucional' },
      { ticket: 'T-1019', name: 'Lic. Lucía Cárdenas Bravo - Control Patrimonial' },
      { ticket: 'T-1020', name: 'Eco. Héctor Barrientos Solís - Planificación y Presupuesto' },
      { ticket: 'T-1021', name: 'Ing. Gabriela Ticona Maquera - Desarrollo de Sistemas' },
      { ticket: 'T-1022', name: 'Lic. César Augusto Palacios - Oficina de Administración' },
      { ticket: 'T-1023', name: 'Lic. Diana Ramos Coronado - Bienestar Social' },
      { ticket: 'T-1024', name: 'Eco. Walter Zúñiga Farfán - Estadísticas Demográficas' },
      { ticket: 'T-1025', name: 'Ing. Roxana Medina Salcedo - Telecomunicaciones' },
      { ticket: 'T-1026', name: 'Lic. Manuel Carranza Núñez - Biblioteca Institucional' },
      { ticket: 'T-1027', name: 'Lic. Gladys Chumpitaz Lara - Archivo Central' },
      { ticket: 'T-1028', name: 'Eco. Pedro Pablo Valdivia - Estadísticas Ambientales' },
      { ticket: 'T-1029', name: 'Ing. Renzo Montoya Córdova - Centro de Cómputo' },
      { ticket: 'T-1030', name: 'Lic. Milagros Solano Díaz - Tesorería' },
      { ticket: 'T-1031', name: 'Lic. Gonzalo Navarrete Rea - Monitoreo Operativo' },
      { ticket: 'T-1032', name: 'Ing. Fiorella Bendezú López - Base de Datos' },
      { ticket: 'T-1033', name: 'Eco. Daniel Portocarrero - Indicadores Laborales' },
      { ticket: 'T-1034', name: 'Lic. Cecilia Gamboa Rivas - Trámite Documentario' },
      { ticket: 'T-1035', name: 'Bach. Javier Chiroque Silva - Soporte Técnico' },
      { ticket: 'T-1036', name: 'Lic. Tania Luján Espinoza - Cooperación Técnica' },
      { ticket: 'T-1037', name: 'Ing. Marcos Peñaloza Ríos - Analítica de Datos' },
      { ticket: 'T-1038', name: 'Eco. Brenda Vilca Quispe - Pobreza y Vulnerabilidad' },
      { ticket: 'T-1039', name: 'Lic. Oscar Valenzuela Paucar - Supervisión Departamental' },
      { ticket: 'T-1040', name: 'Lic. Miriam Córdova Peña - Registro de Personal' },
      { ticket: 'T-1041', name: 'Ing. Enrique Saldaña Reyna - Nube Gubernamental' },
      { ticket: 'T-1042', name: 'Eco. Karina Villacorta Soto - Comercio Exterior' },
      { ticket: 'T-1043', name: 'Lic. Ricardo Bazán Cruz - Imagen Institucional' },
      { ticket: 'T-1044', name: 'Bach. Paola Santillán Vera - Contabilidad' },
      { ticket: 'T-1045', name: 'Ing. Christian Oblitas Lazo - SIG y Georreferenciación' },
      { ticket: 'T-1046', name: 'Lic. Gisella Prado Hurtado - Capacitación' },
      { ticket: 'T-1047', name: 'Eco. Mauricio Leyva Fuentes - Estadísticas Financieras' },
      { ticket: 'T-1048', name: 'Lic. Yolanda Meléndez Arce - Auditoría Interna' },
      { ticket: 'T-1049', name: 'Ing. Jonathan Vera Orosco - Servidores y Almacenamiento' },
      { ticket: 'T-1050', name: 'Lic. Beatriz Yupanqui Chilo - Unidad Formuladora' },
      { ticket: 'T-1051', name: 'Eco. Gustavo Adolfo Neyra - Indicadores Sociales' },
      { ticket: 'T-1052', name: 'Lic. Lourdes Cuentas Barreto - Gestión Documental' },
      { ticket: 'T-1053', name: 'Ing. Diego Alonso Meza - Arquitectura de Software' },
      { ticket: 'T-1054', name: 'Lic. Stephanie Loayza Ponce - Seguridad y Salud en Trabajo' },
      { ticket: 'T-1055', name: 'Eco. Arturo Calderón Rojas - Mercado Cambiario' },
      { ticket: 'T-1056', name: 'Bach. Claudia Hinostroza Díaz - Mesa de Partes' },
      { ticket: 'T-1057', name: 'Ing. Andrés Farfán Velasco - Inteligencia Institucional' },
      { ticket: 'T-1058', name: 'Lic. Katherine Zevallos Ramos - Abastecimiento' },
      { ticket: 'T-1059', name: 'Eco. José Luis Huanca Condori - Censos Económicos' },
      { ticket: 'T-1060', name: 'Lic. Norka Valderrama Chávez - Presidencia Ejecutiva' },
    ];

    this.participants = demoStaff;
    this.saveToStorage();
    return demoStaff;
  }

  // Export current state to CSV
  exportResultsCSV() {
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'TIPO,SORTEO,NUMERO_TICKET,PERSONA,FECHA_SORTEO\r\n';

    this.rounds().forEach(round => {
      const winner = this.winners[round];
      if (winner) {
        csv += `GANADOR,Sorteo ${round},"${winner.ticket}","${winner.name}","${new Date(winner.wonAt).toLocaleString('es-PE')}"\r\n`;
      } else {
        csv += `PENDIENTE,Sorteo ${round},---,---,---\r\n`;
      }
    });

    this.rounds().forEach(round => {
      (this.losers[round] || []).forEach((l, i) => {
        csv += `DESCARTADO,Sorteo ${round} - Extracción ${i + 1},"${l.ticket}","${l.name}",---\r\n`;
      });
    });

    csv += '\r\nLISTA COMPLETA DE PARTICIPANTES CARGADOS\r\n';
    csv += 'NUMERO_TICKET,PERSONA,ESTADO\r\n';

    const wonTickets = Object.values(this.winners).filter(Boolean).map(w => w.ticket);

    this.participants.forEach(p => {
      const estado = wonTickets.includes(p.ticket) ? 'GANADOR PREVIO (EXCLUIDO)' : 'HABILITADO';
      csv += `"${p.ticket}","${p.name}","${estado}"\r\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Resultados_Gran_Sorteo_INEI_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }
}

window.raffleState = new RaffleState();
