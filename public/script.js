let audioCtx;
let longPressTimer;
let longPressDelayTimer;
let longPressRepeatTimer;
let audioInitialized = false;
let spoolTimer;
let lastBoostVal = 0;
let dangerBeepInterval;
let isWarningDismissed = false;
let isWarningIgnoredForever = false;

// Function to initialize audio on first user interaction
function initAudio() {
    if (!audioInitialized) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Play a silent note to unlock audio engine
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0;
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
        
        audioInitialized = true;
    }
}


function playBeep(freq = 440, duration = 80, type = 'square') {
  if (!audioInitialized || !audioCtx) return;

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

function playTurboSpool() {
    if (!audioInitialized || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Spool up sound (sine wave rising in frequency)
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(3000, audioCtx.currentTime + 0.8);
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.4);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);

    // Blow off valve sound (white noise burst) after spool
    setTimeout(() => {
        const bufferSize = audioCtx.sampleRate * 0.3; // 0.3 seconds of noise
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noiseSrc = audioCtx.createBufferSource();
        noiseSrc.buffer = buffer;
        
        // Use a bandpass filter to make it sound "whoosh-y"
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 4000;
        filter.Q.value = 1;

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

        noiseSrc.connect(filter).connect(noiseGain).connect(audioCtx.destination);
        noiseSrc.start();
    }, 800); // Trigger right as spool finishes
}

const presets = [
  {name:"Stock D16Y8", block:"D16-D17", crank:"D16", head:"D16Y8", piston:"P2P", rod:"D16-D17", gasket:"D16Y8-D16Z6"},
  {name:"Mini-Me", block:"D15", crank:"D15", head:"D16Y8", piston:"PM3", rod:"D15B", gasket:"D15B7-D16A6"}, // Shortened name for mobile
  {name:"D16Z6 VTEC", block:"D16-D17", crank:"D16", head:"D16Z6-Y7", piston:"P28-A01", rod:"D16-D17", gasket:"D16Y8-D16Z6"},
  {name:"Vitara Turbo", block:"D16-D17", crank:"D16", head:"D16Z6-Y7", piston:"Vitara", rod:"D16-D17", gasket:"D16Y8-D16Z6"},
  {name:"D17A2", block:"D16-D17", crank:"D17", head:"D17A2", piston:"PLR-A0", rod:"D16-D17", gasket:"D17A2"}
];

const values = {
  bore: 75, stroke: 90.0, deckHeight: 212, cylinders: 4,
  chamber: 38.0, dome: -3.4, compHeight: 29.5,
  rodLength: 137, gasketThick: 0.048, gasketBoreDiff: 0,
  milling: 0, rpm: 7200, elevation: 0, boost: 0
};

// Input validation limits
const limits = {
    bore: { min: 60, max: 90 },
    stroke: { min: 60, max: 110 },
    deckHeight: { min: 180, max: 250 },
    chamber: { min: 20, max: 60 },
    dome: { min: -50, max: 50 },
    compHeight: { min: 20, max: 50 },
    rodLength: { min: 100, max: 180 },
    gasketThick: { min: 0.01, max: 0.2 },
    gasketBoreDiff: { min: -5, max: 10 },
    milling: { min: -0.1, max: 0.2 },
    rpm: { min: 1000, max: 15000 },
    elevation: { min: 0, max: 15000 },
    boost: { min: 0, max: 60 }
};

function updateDisplay(id) {
  const el = document.getElementById(id + '-display');
  // Use .value since they are now <input> elements
  if (el) el.value = values[id];
}

function handleTurboSoundCheck() {
    // If boost has changed to be > 0, trigger the timer
    if (values.boost > 0) {
        clearTimeout(spoolTimer);
        spoolTimer = setTimeout(() => {
            playTurboSpool();
        }, 1000); // Wait 1 second after last interaction to spool
    }
}

// Handle manual text input
function handleInputChange(id, val) {
    if (!audioInitialized) initAudio(); // Also init audio on input change
    
    let parsed = parseFloat(val);
    
    if (isNaN(parsed)) {
        // Revert to old value if invalid
        updateDisplay(id);
        return;
    }

    // Apply limits
    if (limits[id]) {
        if (parsed < limits[id].min) parsed = limits[id].min;
        if (parsed > limits[id].max) parsed = limits[id].max;
    }

    values[id] = parsed;
    updateDisplay(id);
    
    // Changing a value resets the dismissal state so they get warned again if it's still dangerous
    isWarningDismissed = false; 

    calculate();
    playBeep(880, 40, 'sine');

    if(id === 'boost') handleTurboSoundCheck();
}

function autoFill() {
  if (!audioInitialized) initAudio();
  
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

  isWarningDismissed = false;
  Object.keys(values).forEach(k => updateDisplay(k));
  calculate();
}

function increment(id, step) {
  let newVal = values[id] + step;
  if (limits[id] && newVal > limits[id].max) newVal = limits[id].max;
  
  values[id] = parseFloat(newVal.toFixed(3));
  updateDisplay(id);
  
  isWarningDismissed = false;

  calculate();
  playBeep(880, 30, 'sine');
  if(id === 'boost') handleTurboSoundCheck();
}

function decrement(id, step) {
  let newVal = values[id] - step;
  if (limits[id] && newVal < limits[id].min) newVal = limits[id].min;

  values[id] = parseFloat(newVal.toFixed(3));
  updateDisplay(id);

  isWarningDismissed = false;

  calculate();
  playBeep(660, 30, 'sine');
  if(id === 'boost') handleTurboSoundCheck();
}

function startLongPress(id, step, direction) {
  stopLongPress();
  
  // IMMEDIATELY trigger the first increment/decrement
  if (direction === 1) {
    increment(id, step);
  } else {
    decrement(id, step);
  }

  // Then start the delay for repeating
  longPressDelayTimer = setTimeout(() => {
    longPressRepeatTimer = setInterval(() => {
      let newVal = values[id] + (direction * step);
      
      // Enforce limits during long press
      if (limits[id]) {
          if (newVal > limits[id].max) newVal = limits[id].max;
          if (newVal < limits[id].min) newVal = limits[id].min;
      }

      values[id] = parseFloat(newVal.toFixed(3));
      updateDisplay(id);
      
      isWarningDismissed = false;

      calculate();
      playBeep(880, 20, 'sine');
      if(id === 'boost') handleTurboSoundCheck();
    }, 60); // repeat speed (lower = faster)
  }, 350); // initial delay
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
    btn.className = 'retro-button text-xs sm:text-sm md:text-base w-full md:w-auto md:flex-1'; // Better grid for mobile
    btn.textContent = p.name;
    btn.onclick = (e) => {
        if(!audioInitialized) initAudio(); // Make sure audio is ready
        loadPreset(i, btn);
    }
    container.appendChild(btn);
  });
}

function loadPreset(i, buttonElement) {
  const p = presets[i];
  buttonElement.classList.add('pressed');
  setTimeout(() => buttonElement.classList.remove('pressed'), 120);
  document.querySelectorAll('.retro-button').forEach(b => b.classList.remove('selected'));
  buttonElement.classList.add('selected');
  
  // Play preset load sound
  playBeep(660, 60, 'sawtooth'); setTimeout(() => playBeep(880, 80, 'sawtooth'), 40); setTimeout(() => playBeep(1100, 120, 'sine'), 90);

  if (p.block) document.getElementById('block').value = p.block;
  if (p.crank) document.getElementById('crank').value = p.crank;
  if (p.head) document.getElementById('head').value = p.head;
  if (p.piston) document.getElementById('piston').value = p.piston;
  if (p.rod) document.getElementById('rod').value = p.rod;
  if (p.gasket) document.getElementById('gasket').value = p.gasket;

  autoFill();
}

function dismissWarning(forever = false) {
    if (forever) {
        isWarningIgnoredForever = true;
    } else {
        isWarningDismissed = true;
    }
    
    const warningEl = document.getElementById('danger-warning');
    if (warningEl) {
        warningEl.classList.add('hidden');
    }
    if (dangerBeepInterval) {
        clearInterval(dangerBeepInterval);
        dangerBeepInterval = null;
    }
    // Play a low pitched confirm sound
    playBeep(220, 150, 'square');
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
  const milling        = values.milling;

  const pi = 3.1415926535;

  const sweptVolume = ((bore / 2) * (bore / 2)) * pi * stroke / 1000 * 4;
  const pistonDomeDisplacement = dome * 4;
  const millingMm = milling * 25.4;
  const pistonToDeckHeight = deckHeight - rodLength - compHeight - (stroke / 2) - millingMm;
  const headGasketVolume = 
    (((bore - (-gasketBoreDiff)) / 2) * ((bore - (-gasketBoreDiff)) / 2)) * 
    pi * 
    ((gasketThick * 25.4) - (-pistonToDeckHeight)) / 1000 * 4;
  const combustionChamberVolume = chamber * 4;
  const tdcVolume = sweptVolume - pistonDomeDisplacement + combustionChamberVolume + headGasketVolume;
  const bdcVolume = combustionChamberVolume + headGasketVolume - pistonDomeDisplacement;
  
  // Prevent Infinity/NaN
  let staticCR = tdcVolume / bdcVolume;
  if (!isFinite(staticCR) || staticCR < 0) staticCR = 0;

  const rodRatio        = stroke > 0 ? rodLength / stroke : 0;
  const effectiveCR     = (staticCR * (1 + values.boost / 14.7)) - (values.elevation / 1000 * 0.2);
  const meanPistonSpeed = (stroke / 1000) * values.rpm * 2 / 60;
  const maxPistonAccel  = (pi * pi * stroke * values.rpm * values.rpm) / (90000 * 1000);
  const totalDisplacement = sweptVolume;


  // --- DANGER TO MANIFOLD CHECK ---
  const warningEl = document.getElementById('danger-warning');
  if (warningEl && !isWarningIgnoredForever) {
      // Arbitrary danger limits: Mean piston speed > 25m/s OR Effective CR > 14:1
      if ((meanPistonSpeed > 25 || effectiveCR > 14) && !isWarningDismissed) {
          warningEl.classList.remove('hidden');
          
          // Start aggressive beeping if it's not already beeping
          if (!dangerBeepInterval) {
              dangerBeepInterval = setInterval(() => {
                  playBeep(900, 100, 'square'); // Harsh, high pitched beep
              }, 250); 
          }

      } else {
          warningEl.classList.add('hidden');
          if (dangerBeepInterval) {
              clearInterval(dangerBeepInterval);
              dangerBeepInterval = null;
          }
      }
  }


  const resultsHTML = `
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

  // Update Desktop Results
  const container = document.getElementById('results');
  if(container) {
      const newContainer = container.cloneNode(false);
      newContainer.innerHTML = resultsHTML;
      container.parentNode.replaceChild(newContainer, container);
  }

  // Update Mobile Sticky Bar
  const stickyCr = document.getElementById('sticky-cr');
  const stickyDisp = document.getElementById('sticky-disp');
  if(stickyCr) stickyCr.innerText = `${staticCR.toFixed(2)}:1`;
  if(stickyDisp) stickyDisp.innerText = `${totalDisplacement.toFixed(0)} cc`;

  // Update Mobile Modal Content
  const modalContent = document.getElementById('mobile-results-content');
  if(modalContent) {
      // Create a fresh clone to trigger animation in modal too
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = resultsHTML;
      modalContent.innerHTML = '';
      modalContent.appendChild(tempDiv);
  }
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

    // Remove the inline onclick handlers since we handle it here
    btn.removeAttribute('onclick');

    const start = (e) => {
      // Don't prevent default on touchstart immediately if we want scrolling to work, 
      // but we DO want to prevent it so it doesn't fire a duplicate click event.
      // Easiest fix for mobile buttons not working is ensuring we immediately trigger
      // the first step, then wait for the long press.
      if (e.cancelable) e.preventDefault(); 
      document.getElementById(id + '-display').blur();
      
      // Initialize audio if not already done
      if (!audioInitialized) {
          initAudio();
      }

      startLongPress(id, step, isIncrement ? 1 : -1);
    };

    const stop = (e) => {
      if (e.cancelable) e.preventDefault();
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
};