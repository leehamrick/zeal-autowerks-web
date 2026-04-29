let audioCtx;
let longPressTimer;
let longPressDelayTimer;
let longPressRepeatTimer;

function playBeep(freq = 440, duration = 80, type = 'square') {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain).connect(audioCtx.destination);
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  osc.type = type;
  gain.gain.value = 0.3;
  osc.start();
  setTimeout(() => { 
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.02); 
    osc.stop(audioCtx.currentTime + 0.1); 
  }, duration);
}

const presets = [
  {name:"Stock D16Y8", block:"D16-D17", crank:"D16", head:"D16Y8", piston:"P2P", rod:"D16-D17", gasket:"D16Y8-D16Z6"},
  {name:"Mini-Me D15+Y8", block:"D15", crank:"D15", head:"D16Y8", piston:"PM3", rod:"D15B", gasket:"D15B7-D16A6"},
  {name:"D16Z6 VTEC", block:"D16-D17", crank:"D16", head:"D16Z6-Y7", piston:"P28-A01", rod:"D16-D17", gasket:"D16Y8-D16Z6"},
  {name:"Vitara Turbo", block:"D16-D17", crank:"D16", head:"D16Z6-Y7", piston:"Vitara", rod:"D16-D17", gasket:"D16Y8-D16Z6"},
  {name:"D17A2 Type-S", block:"D16-D17", crank:"D17", head:"D17A2", piston:"PLR-A0", rod:"D16-D17", gasket:"D17A2"}
];

const values = {
  bore: 75, stroke: 84.5, deckHeight: 212, cylinders: 4,
  chamber: 42.5, dome: -9.5, compHeight: 30.5,
  rodLength: 137, gasketThick: 0.027, gasketBoreDiff: 1,
  milling: 0, rpm: 7200, elevation: 0, boost: 0
};

function updateDisplay(id) {
  const el = document.getElementById(id + '-display');
  if (el) el.textContent = values[id];
}

function autoFill() {
  const block = document.getElementById('block').value;
  const crank = document.getElementById('crank').value;
  const head = document.getElementById('head').value;
  const piston = document.getElementById('piston').value;
  const rod = document.getElementById('rod').value;
  const gasket = document.getElementById('gasket').value;

  // Block
  if (block === "D16-D17") { values.bore = 75; values.deckHeight = 212; }
  else if (block === "D15") { values.bore = 75; values.deckHeight = 207; }

  // Crank
  if (crank === "D17") { values.stroke = 94.4; }
  else if (crank === "D16") { values.stroke = 90.0; }
  else if (crank === "D15") { values.stroke = 84.5; }

  // Head
  if (head === "D15B7-D16A6") { values.chamber = 38.0; }
  else if (head === "D16Z6-Y7") { values.chamber = 34.6; }
  else if (head === "D16Y8") { values.chamber = 32.8; }
  else if (head === "ZC") { values.chamber = 43.8; }
  else if (head === "D17A2") { values.chamber = 35.8; }
  else if (head === "D15Z1") { values.chamber = 25.3; }
  else if (head === "D16A3") { values.chamber = 45.0; }

  // Piston - now fully mapped
  if (piston === "PM3") { values.dome = -1.5; values.compHeight = 30.7; }
  else if (piston === "P07-010") { values.dome = -16.1; values.compHeight = 27.75; }
  else if (piston === "PM6") { values.dome = -3.4; values.compHeight = 29.5; }
  else if (piston === "P2E-000") { values.dome = -7.4; values.compHeight = 30.0; }
  else if (piston === "P28-A01") { values.dome = -10.10; values.compHeight = 30.0; }
  else if (piston === "P2M-00") { values.dome = -7.3; values.compHeight = 29.5; }
  else if (piston === "P2P") { values.dome = -6.2; values.compHeight = 29.3; }
  else if (piston === "PDN-A00") { values.dome = 4.63; values.compHeight = 29.5; }
  else if (piston === "P29") { values.dome = 7.2; values.compHeight = 29.0; }
  else if (piston === "PMS-A00") { values.dome = 4.0; values.compHeight = 27.0; }
  else if (piston === "PG6") { values.dome = 1.5; values.compHeight = 30.0; }
  else if (piston === "PLR-A0") { values.dome = -6.2; values.compHeight = 27.0; }
  else if (piston === "P08-010") { values.dome = -4.5; values.compHeight = 27.4; }
  else if (piston === "Vitara") { values.dome = -15.0; values.compHeight = 28.3; }

  // Connecting Rod
  if (rod === "D16-D17") values.rodLength = 137;
  else if (rod === "D15B") values.rodLength = 134;

  // Head Gasket
  if (gasket === "D15B7-D16A6") { values.gasketThick = 0.048; values.gasketBoreDiff = 0; }
  else if (gasket === "D16Y8-D16Z6") { values.gasketThick = 0.037; values.gasketBoreDiff = 0; }
  else if (gasket === "D16Y8-2layer") { values.gasketThick = 0.025; values.gasketBoreDiff = 0; }
  else if (gasket === "D17A2") { values.gasketThick = 0.026; values.gasketBoreDiff = 0; }

  Object.keys(values).forEach(k => updateDisplay(k));
  calculate();
}

function increment(id, step) {
  values[id] = parseFloat((values[id] + step).toFixed(3));
  updateDisplay(id);
  calculate();
  playBeep(880, 30, 'sine');
}

function decrement(id, step) {
  values[id] = parseFloat((values[id] - step).toFixed(3));
  updateDisplay(id);
  calculate();
  playBeep(660, 30, 'sine');
}

function startLongPress(id, step, direction) {
  stopLongPress();
  longPressDelayTimer = setTimeout(() => {
    longPressRepeatTimer = setInterval(() => {
      values[id] = parseFloat((values[id] + direction * step).toFixed(3));
      updateDisplay(id);
      calculate();
      playBeep(880, 20, 'sine');
    }, 60); // repeat speed (lower = faster)
  }, 350); // initial delay (350ms feels natural and prevents accidental repeats)
}

function stopLongPress() {
  if (longPressDelayTimer) {
    clearTimeout(longPressDelayTimer);
    longPressDelayTimer = null;
  }
  if (longPressRepeatTimer) {
    clearInterval(longPressRepeatTimer);
    longPressRepeatTimer = null;
  }
}

function createPresetButtons() {
  const container = document.getElementById('preset-container');
  container.innerHTML = '';
  presets.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'retro-button flex-1 md:flex-none text-sm md:text-base';
    btn.textContent = p.name;
    btn.onclick = () => loadPreset(i, btn);
    container.appendChild(btn);
  });
}

function loadPreset(i, buttonElement) {
  const p = presets[i];
  buttonElement.classList.add('pressed');
  setTimeout(() => buttonElement.classList.remove('pressed'), 120);
  document.querySelectorAll('.retro-button').forEach(b => b.classList.remove('selected'));
  buttonElement.classList.add('selected');
  
  playBeep(660, 60, 'sawtooth'); setTimeout(() => playBeep(880, 80, 'sawtooth'), 40); setTimeout(() => playBeep(1100, 120, 'sine'), 90);

  if (p.block) document.getElementById('block').value = p.block;
  if (p.crank) document.getElementById('crank').value = p.crank;
  if (p.head) document.getElementById('head').value = p.head;
  if (p.piston) document.getElementById('piston').value = p.piston;
  if (p.rod) document.getElementById('rod').value = p.rod;
  if (p.gasket) document.getElementById('gasket').value = p.gasket;

  autoFill();
}

function calculate() {
  const bore           = values.bore;
  const stroke         = values.stroke;
  const deckHeight     = values.deckHeight;
  const chamber        = values.chamber;
  const dome           = values.dome;
  const compHeight     = values.compHeight;
  const rodLength      = values.rodLength;
  const gasketThick    = values.gasketThick;
  const gasketBoreDiff = values.gasketBoreDiff;
  const milling        = values.milling;     // now used

  const pi = 3.1415926535;

  // Swept volume (total for 4 cylinders) in cc
  const sweptVolume = ((bore / 2) * (bore / 2)) * pi * stroke / 1000 * 4;

  const pistonDomeDisplacement = dome * 4;

  // Real piston-to-deck height, now includes milling (in mm)
  const millingMm = milling * 25.4;
  const pistonToDeckHeight = deckHeight - rodLength - compHeight - (stroke / 2) - millingMm;

  // Head gasket volume
  const headGasketVolume = 
    (((bore - (-gasketBoreDiff)) / 2) * ((bore - (-gasketBoreDiff)) / 2)) * 
    pi * 
    ((gasketThick * 25.4) - (-pistonToDeckHeight)) / 1000 * 4;

  const combustionChamberVolume = chamber * 4;

  // Compression ratio
  const tdcVolume = sweptVolume - pistonDomeDisplacement + combustionChamberVolume + headGasketVolume;
  const bdcVolume = combustionChamberVolume + headGasketVolume - pistonDomeDisplacement;

  const staticCR = tdcVolume / bdcVolume;

  // Extra values
  const rodRatio        = rodLength / stroke;
  const effectiveCR     = staticCR * (1 + values.boost / 14.7);
  const meanPistonSpeed = (stroke / 1000) * values.rpm * 2 / 60;
  const maxPistonAccel  = (pi * pi * stroke * values.rpm * values.rpm) / (90000 * 1000);

  const totalDisplacement = sweptVolume;   // already in cc

  const container = document.getElementById('results');
  container.innerHTML = `
    <div class="text-center mb-6">
      <div class="text-[#00ffcc] text-xs tracking-[4px]">STATIC COMPRESSION</div>
      <div class="text-6xl md:text-5xl font-black text-[#ffcc00] leading-none">${staticCR.toFixed(2)}:1</div>
    </div>
    <div class="mt-6 space-y-4 text-sm">
      <div class="flex justify-between"><span class="text-[#00ffcc]">DISPLACEMENT</span><span class="font-black text-[#ffcc00]">${totalDisplacement.toFixed(0)} cc</span></div>
      <div class="flex justify-between"><span class="text-[#00ffcc]">PISTON-TO-DECK</span><span class="font-black text-[#ffcc00]">${pistonToDeckHeight.toFixed(3)} mm</span></div>
      <div class="flex justify-between"><span class="text-[#00ffcc]">ROD/STROKE RATIO</span><span class="font-black">${rodRatio.toFixed(2)}</span></div>
      <div class="flex justify-between"><span class="text-[#00ffcc]">EFFECTIVE CR</span><span class="font-black text-[#ffcc00]">${effectiveCR.toFixed(2)}:1</span></div>
      <div class="flex justify-between"><span class="text-[#00ffcc]">MEAN PISTON SPEED</span><span class="font-black">${meanPistonSpeed.toFixed(1)} m/s</span></div>
      <div class="flex justify-between"><span class="text-[#00ffcc]">MAX PISTON ACCEL</span><span class="font-black">${maxPistonAccel.toFixed(0)} m/s²</span></div>
    </div>
  `;
}

window.onload = () => {
  createPresetButtons();
  Object.keys(values).forEach(k => updateDisplay(k));
  calculate();

  document.querySelectorAll('.custom-number button').forEach(btn => {
    const onclickStr = btn.getAttribute('onclick');
    const idMatch = onclickStr.match(/'(.*?)'/);
    const id = idMatch ? idMatch[1] : null;
    const stepMatch = onclickStr.match(/, ([\d.]+)/);
    const step = stepMatch ? parseFloat(stepMatch[1]) : 0.1;
    const isIncrement = btn.textContent.trim() === '+';

    if (!id) return;

    const start = (e) => {
      e.preventDefault();
      startLongPress(id, step, isIncrement ? 1 : -1);
    };

    const stop = (e) => {
      e.preventDefault();
      stopLongPress();
    };

    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchend', stop);
    btn.addEventListener('touchcancel', stop);
    btn.addEventListener('contextmenu', (e) => e.preventDefault()); // stops Android copy menu
  });

  // Boot sound
  setTimeout(() => playBeep(440, 100), 300);
  setTimeout(() => playBeep(660, 100), 450);
  setTimeout(() => playBeep(880, 180), 600);
};