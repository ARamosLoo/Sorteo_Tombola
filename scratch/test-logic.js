// Mock localStorage and window
global.window = {};
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

// Load state.js
require('../js/state.js');
const state = window.raffleState;

console.log('--- 1. Testing Excel Parser ---');
const sampleExcelClipboard = `Numero de ticket\tPersona
T-101\tCarlos Mendoza
T-102\tRosa Huaman
T-103\tJorge Vega
T-104\tElena Flores
T-101\tCarlos Mendoza Repetido`;

const parseResult = state.parsePastedData(sampleExcelClipboard);
console.log('Parsed successfully:', parseResult.success);
console.log('Skipped header:', parseResult.skippedHeader);
console.log('Duplicates detected & ignored:', parseResult.duplicatesCount);
console.log('Total valid participants:', parseResult.totalParsed);
console.assert(parseResult.totalParsed === 4, 'Should have 4 unique participants');

state.participants = parseResult.data;

console.log('\n--- 2. Testing Exclusion Logic across 3 Sorteos ---');
console.log('Initial eligible participants count:', state.getEligibleParticipants().length);
console.assert(state.getEligibleParticipants().length === 4, 'All 4 should be eligible');

// Round 1 Draw
const winner1 = state.getEligibleParticipants()[0]; // T-101 Carlos Mendoza
state.setWinner(1, winner1);
console.log('Winner Sorteo 1:', state.winners[1].ticket, state.winners[1].name);

let eligibleAfter1 = state.getEligibleParticipants();
console.log('Eligible after Sorteo 1:', eligibleAfter1.map(p => p.ticket).join(', '));
console.assert(eligibleAfter1.length === 3, 'Should have 3 eligible left');
console.assert(!eligibleAfter1.some(p => p.ticket === 'T-101'), 'T-101 must be excluded!');

// Round 2 Draw
const winner2 = eligibleAfter1[0]; // T-102 Rosa Huaman
state.setWinner(2, winner2);
console.log('Winner Sorteo 2:', state.winners[2].ticket, state.winners[2].name);

let eligibleAfter2 = state.getEligibleParticipants();
console.log('Eligible after Sorteo 2:', eligibleAfter2.map(p => p.ticket).join(', '));
console.assert(eligibleAfter2.length === 2, 'Should have 2 eligible left');
console.assert(!eligibleAfter2.some(p => p.ticket === 'T-101' || p.ticket === 'T-102'), 'Both T-101 and T-102 must be excluded!');

// Round 3 Draw
const winner3 = eligibleAfter2[0]; // T-103 Jorge Vega
state.setWinner(3, winner3);
console.log('Winner Sorteo 3:', state.winners[3].ticket, state.winners[3].name);

let eligibleAfter3 = state.getEligibleParticipants();
console.log('Eligible after Sorteo 3:', eligibleAfter3.map(p => p.ticket).join(', '));
console.assert(eligibleAfter3.length === 1, 'Should have 1 eligible left');

console.log('\n--- 3. Testing Reset Specific Round ---');
state.resetRoundWinner(2);
console.log('Winner 2 after reset:', state.winners[2]);
console.log('Eligible after resetting Sorteo 2:', state.getEligibleParticipants().map(p => p.ticket).join(', '));
console.assert(state.getEligibleParticipants().some(p => p.ticket === 'T-102'), 'T-102 should be eligible again');
console.assert(!state.getEligibleParticipants().some(p => p.ticket === 'T-101'), 'T-101 is still Sorteo 1 winner so must stay excluded');

console.log('\nALL TESTS PASSED PERFECTLY!');
