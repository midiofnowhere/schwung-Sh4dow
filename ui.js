import {
  Black,
  BrightRed,
  DarkGrey,
  MidiCC,
  MidiNoteOff,
  MidiNoteOn,
  MovePlay,
  MoveRec,
  MoveMainKnob,
  MoveKnob1,
  MovePads,
  MoveShift,
  MoveSteps,
  White
} from '/data/UserData/schwung/shared/constants.mjs';
import { setLED } from '/data/UserData/schwung/shared/input_filter.mjs';

const DEFAULTS = {
  midiChannel: 1,
  padOctave: 3,
  velocity: 100,
  drumPartChannel: 10,
  externalCable: 0
};

const PAGES = [
  {
    name: "TONE",
    channel: "main",
    controls: [
      ["CUT", 74],   // Filter Cutoff
      ["RES", 71],   // Filter Resonance
      ["ATK", 73],   // AMP Attack
      ["DEC", 75],   // AMP Decay
      ["SUS", 31],   // AMP Sustain (was 70, correct is 31)
      ["REL", 72],   // AMP Release
      ["TIMB", 77],  // Timbre (was VRAT/76 which doesn't exist)
      ["MOD", 1]     // Modulation Wheel (was VDEP/77 — 77 is Timbre, moved there)
    ]
  },
  {
    name: "FILTER",
    channel: "main",
    controls: [
      ["FATK", 82],  // Filter Attack
      ["FDEC", 83],  // Filter Decay
      ["FSUS", 28],  // Filter Sustain
      ["FREL", 29],  // Filter Release
      ["FENV", 81],  // Filter ENV depth
      ["FHPF", 79],  // Filter HPF Cutoff
      ["FKEY", 78],  // Filter Keyboard tracking
      ["DRV", 90]    // Filter Drive (was 12, correct is 90)
    ]
  },
  {
    name: "SHAPE",
    channel: "main",
    controls: [
      ["PIT", 21],   // Pitch
      ["PORT", 84],  // Portamento (was 5, correct is 84)
      ["LFO", 16],   // LFO Rate (was 3, correct is 16)
      ["LFAD", 20],  // LFO Fade Time
      ["LFPT", 18],  // LFO Pitch depth
      ["LFFL", 19],  // LFO Filter depth
      ["LFAM", 80],  // LFO AMP depth
      ["HOLD", 64]   // Hold Pedal
    ]
  },
  {
    name: "AMPFX",
    channel: "main",
    controls: [
      ["LVL", 7],    // AMP Level
      ["PAN", 10],   // AMP Pan
      ["SL1", 85],   // Slider 1
      ["SL2", 86],   // Slider 2
      ["SL3", 87],   // Slider 3
      ["SL4", 88],   // Slider 4
      ["EXP", 11],   // Expression
      ["SOSTN", 66]  // Sostenuto
    ]
  },
  {
    name: "DRUM1",
    channel: "drum",
    controls: [
      ["D01", 36],
      ["D02", 37],
      ["D03", 38],
      ["D04", 39],
      ["D05", 40],
      ["D06", 41],
      ["D07", 42],
      ["D08", 43]
    ]
  },
  {
    name: "DRUM2",
    channel: "drum",
    controls: [
      ["D09", 44],
      ["D10", 45],
      ["D11", 46],
      ["D12", 47],
      ["D13", 48],
      ["D14", 49],
      ["D15", 50],
      ["D16", 51]
    ]
  }
];

let settings = { ...DEFAULTS };
let pageIndex = 0;
let pageValues = PAGES.map(() => new Array(8).fill(64));
let heldPads = new Map();
let sequencerMode = false;
let sequencerRunning = false;
let sequencerSelectedStep = 0;
let sequencerSteps = new Array(16).fill(false);
let sequencerNotes = new Array(16).fill(60);
let sequencerVelocities = new Array(16).fill(100);
let sequencerHeldNote = null;
let sequencerTick = 0;
// Tempo: ticks per step. At ~344 ticks/sec, 10 ticks/step = ~2.06 steps/sec = ~124 BPM (16th notes)
// Range 4-40 ticks/step = ~207 BPM down to ~52 BPM
let sequencerTicksPerStep = 10;
// Active step count — lets you run 1-16 step patterns
let sequencerLength = 16;

// Save/load state UI
// saveLoadMode: false=off, "save"=picking save slot, "load"=picking load slot
let saveLoadMode = false;
let saveLoadFeedback = "";   // brief status message shown after save/load
let saveLoadFeedbackTimer = 0;
const SAVE_DIR = "/data/UserData/schwung/sh4dow/";
const NUM_SLOTS = 4;
let ledRefreshIndex = 0;

function ticksToBPM(ticks) {
  // 344 ticks/sec, 4 steps per beat (16th notes)
  return Math.round((344 / ticks) / 4 * 60);
}

function getStatePath(slot) {
  return SAVE_DIR + "state_" + slot + ".json";
}

function saveState(slot) {
  try {
    if (typeof host_ensure_dir === "function") {
      host_ensure_dir(SAVE_DIR);
    }
    const state = {
      steps: sequencerSteps.slice(),
      notes: sequencerNotes.slice(),
      velocities: sequencerVelocities.slice(),
      length: sequencerLength,
      ticksPerStep: sequencerTicksPerStep,
    };
    const ok = host_write_file(getStatePath(slot), JSON.stringify(state));
    return ok;
  } catch (e) {
    return false;
  }
}

function loadState(slot) {
  try {
    const raw = host_read_file(getStatePath(slot));
    if (!raw) return false;
    const state = JSON.parse(raw);
    if (state.steps) sequencerSteps = state.steps.slice();
    if (state.notes) sequencerNotes = state.notes.slice();
    if (state.velocities) sequencerVelocities = state.velocities.slice();
    if (typeof state.length === "number") sequencerLength = clamp(state.length, 1, 16);
    if (typeof state.ticksPerStep === "number") sequencerTicksPerStep = clamp(state.ticksPerStep, 4, 40);
    return true;
  } catch (e) {
    return false;
  }
}

function slotExists(slot) {
  try {
    return typeof host_file_exists === "function" && host_file_exists(getStatePath(slot));
  } catch (e) {
    return false;
  }
}

function midiNoteName(n) {
  const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const oct = Math.floor(n / 12) - 1;
  return names[n % 12] + oct;
}
let shiftHeld = false;
let channelEditedLocally = false;
let txFlash = 0;
let rxFlash = 0;
let lastInput = "---";
let lastSent = "---";
let omniTestUntil = 0;
let logoMode = true;
let logoFrame = 0;
let logoPulse = 0;
let logoText = "sh4Dow";
let logoDuration = 200;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value | 0));
}

function statusFor(base, channel) {
  return base + clamp(channel, 1, 16) - 1;
}

function mainChannel() {
  return clamp(settings.midiChannel, 1, 16);
}

function drumChannel() {
  return clamp(settings.drumPartChannel, 1, 16);
}

function usbMidiPacketHeader(bytes) {
  const cable = clamp(settings.externalCable, 0, 15);
  let cin = 0x05;
  const status = bytes[0] ?? 0;

  if (bytes.length === 1) {
    if (status >= 0xf8) {
      cin = 0x0f;
    } else {
      cin = 0x05;
    }
  } else {
    const statusNibble = status & 0xf0;
    if (statusNibble === 0x80) cin = 0x08;
    else if (statusNibble === 0x90) cin = 0x09;
    else if (statusNibble === 0xa0) cin = 0x0a;
    else if (statusNibble === 0xb0) cin = 0x0b;
    else if (statusNibble === 0xc0) cin = 0x0c;
    else if (statusNibble === 0xd0) cin = 0x0d;
    else if (statusNibble === 0xe0) cin = 0x0e;
    else cin = 0x0f;
  }

  return (cable << 4) | cin;
}

function sendExternal(bytes) {
  txFlash = 12;
  const midiBytes = [bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0];
  const header = usbMidiPacketHeader(bytes.filter((b) => b != null));
  const packet = [header, midiBytes[0], midiBytes[1], midiBytes[2]];
  lastSent = `C${settings.externalCable}:${packet.map((b) => String(b).padStart(3, '0')).join(' ')}`;

  let sent = false;
  let method = "none";
  let errorMessage = "";

  if (typeof move_midi_external_send === "function") {
    try {
      move_midi_external_send(packet);
      sent = true;
      method = "move_midi_external_send";
    } catch (error) {
      method = "move_midi_external_send(err)";
      errorMessage = String(error);
    }
  }

  if (!sent && typeof host_send_midi_external === "function") {
    try {
      host_send_midi_external(packet);
      sent = true;
      method = "host_send_midi_external(packet)";
    } catch (error) {
      errorMessage = String(error);
      try {
        host_send_midi_external(midiBytes);
        sent = true;
        method = "host_send_midi_external(bytes)";
      } catch (error2) {
        method = "host_send_midi_external(err)";
        errorMessage = String(error2);
      }
    }
  }

  if (!sent && typeof send_midi_external === "function") {
    try {
      send_midi_external(packet);
      sent = true;
      method = "send_midi_external(packet)";
    } catch (error) {
      errorMessage = String(error);
      try {
        send_midi_external(midiBytes);
        sent = true;
        method = "send_midi_external(bytes)";
      } catch (error2) {
        method = "send_midi_external(err)";
        errorMessage = String(error2);
      }
    }
  }

  if (!sent && typeof host_module_send_midi === "function") {
    try {
      host_module_send_midi(midiBytes);
      sent = true;
      method = "host_module_send_midi";
    } catch (error) {
      method = "host_module_send_midi(err)";
      errorMessage = String(error);
    }
  }

  if (!sent) {
    lastSent = `ERR ${lastSent}`;
    if (errorMessage) {
      lastSent += ` ${errorMessage}`;
    }
  } else {
    lastSent = `${method} ${lastSent}`;
  }

  draw();
}

function sendCc(channel, cc, value) {
  sendExternal([statusFor(0xb0, channel), clamp(cc, 0, 127), clamp(value, 0, 127)]);
}

function sendNote(channel, note, velocity) {
  sendExternal([statusFor(velocity > 0 ? 0x90 : 0x80, channel), clamp(note, 0, 127), clamp(velocity, 0, 127)]);
}

function sendMidiStart() {
  sendExternal([0xfa]);
}

function sendAllChannelsNote(note, velocity) {
  for (let channel = 1; channel <= 16; channel += 1) {
    sendNote(channel, note, velocity);
  }
}

function triggerOmniTest() {
  sendAllChannelsNote(60, 110);
  omniTestUntil = 8;
}

function activePage() {
  return PAGES[pageIndex % PAGES.length];
}

function controlChannel(page) {
  return page.channel === "drum" ? drumChannel() : mainChannel();
}

function drawLogo() {
  // Pulse cycle: 16 ticks — first 8 normal (white text on black), last 8 inverted (black text on white)
  const cycle = logoFrame % 16;
  const inverted = cycle >= 8;

  // Clear to black first
  if (typeof clear_screen === "function") {
    clear_screen();
  }

  // Fill screen white for the bright half of the pulse — try all available APIs
  if (inverted) {
    // Try display object API (OOP style)
    if (typeof display !== "undefined" && typeof display.fillRect === "function") {
      display.fillRect(0, 0, 128, 64, 1);
    }
    // Also try global fill_rect
    if (typeof fill_rect === "function") {
      fill_rect(0, 0, 128, 64, 1);
    }
    // Fallback: print solid block lines to fill screen visually
    if (typeof print === "function") {
      const block = "██████████████████████████";
      for (let row = 0; row < 64; row += 8) {
        print(0, row, block, 1);
      }
    }
  }

  const textColor = inverted ? 0 : 1;

  if (typeof print === "function") {
    // Title — double-printed for bold effect
    const title = "  sh4Dow";
    print(1, 4, title, textColor);
    print(2, 4, title, textColor);

    print(4, 18, "Roland SH-4d", textColor);
    print(4, 28, "MIDI Controller", textColor);

    print(0, 40, "---------------------", textColor);

    const subPulse = (logoFrame % 8) < 4;
    if (subPulse) {
      print(4, 48, "v1.1.2  by clairebear", textColor);
    }

    print(4, 58, "USB MIDI  Move->SH4d", textColor);
  }
}

function draw() {
  if (logoMode) {
    return drawLogo();
  }

  if (typeof clear_screen === "function") {
    clear_screen();
  }

  const page = activePage();
  if (typeof print === "function") {
    const channel = controlChannel(page);
    const controlsA = page.controls.slice(0, 4).map((control, index) => `${index + 1}:${control[0]}`).join(" ");
    const controlsB = page.controls.slice(4, 8).map((control, index) => `${index + 5}:${control[0]}`).join(" ");
    const values = pageValues[pageIndex];
    const valuesA = values.slice(0, 4).map((value, index) => `${index + 1}:${value}`).join(" ");
    const valuesB = values.slice(4, 8).map((value, index) => `${index + 5}:${value}`).join(" ");

    const flags = `${rxFlash > 0 ? " RX" : ""}${txFlash > 0 ? " TX" : ""}`;
    // Save/load UI overlay
    if (saveLoadMode) {
      print(0, 0, "SAVE/LOAD PATTERN", 1);
      print(0, 12, "Steps 1-4: SAVE", 1);
      print(0, 22, "Steps 5-8: LOAD", 1);
      print(0, 34, "---------------------", 1);
      for (let s = 0; s < NUM_SLOTS; s++) {
        const exists = slotExists(s);
        print(0, 44 + s * 0, "", 1); // spacer
      }
      // Show which slots have data
      let slotLine = "";
      for (let s = 0; s < NUM_SLOTS; s++) {
        slotLine += slotExists(s) ? (s + 1) + "=" : (s + 1) + "- ";
      }
      print(0, 44, "Slots: " + slotLine.trim(), 1);
      print(0, 54, "Shift+Play to cancel", 1);
      return;
    }

    // Feedback flash after save/load
    if (saveLoadFeedbackTimer > 0) {
      saveLoadFeedbackTimer -= 1;
      print(0, 56, saveLoadFeedback.slice(0, 21), 1);
    }

    if (sequencerMode) {
      const bpm = ticksToBPM(sequencerTicksPerStep);
      const header = `SEQ ${sequencerRunning ? "PLAY" : "STOP"} S${sequencerSelectedStep + 1}`;
      print(0, 0, header.slice(0, 21), 1);
      print(0, 12, `NOTE ${midiNoteName(sequencerNotes[sequencerSelectedStep])}  (${sequencerNotes[sequencerSelectedStep]})`.slice(0, 21), 1);
      print(0, 24, `VEL  ${sequencerVelocities[sequencerSelectedStep]}  knob1=edit`.slice(0, 21), 1);
      print(0, 38, `ACT ${sequencerSteps[sequencerSelectedStep] ? "YES" : "NO"}`.slice(0, 21), 1);
      const lenStr = shiftHeld ? `LEN ${sequencerLength} <shift+knob>` : `BPM ${bpm} LEN ${sequencerLength}`;
      print(0, 50, lenStr.slice(0, 21), 1);
      return;
    }

    // Show a small "SEQ>" running indicator on the CC pages when sequencer is active
    const seqIndicator = sequencerRunning ? ` >S${sequencerSelectedStep + 1}` : "";

    const pageNum = `[${pageIndex + 1}/${PAGES.length}]`;
    print(0, 0, `SH4d ${page.name} ${pageNum}${seqIndicator}`.slice(0, 21), 1);
    print(0, 10, `CH${channel}${flags}`.slice(0, 21), 1);
    print(0, 22, controlsA.slice(0, 21), 1);
    print(0, 34, controlsB.slice(0, 21), 1);
    print(0, 46, valuesA.slice(0, 21), 1);
    print(0, 58, (rxFlash > 0 ? lastInput : valuesB).slice(0, 21), 1);
  }
}

function refreshSomeLeds() {
  const leds = [...MovePads, ...MoveSteps];
  const batchSize = 8;

  for (let count = 0; count < batchSize; count += 1) {
    const led = leds[ledRefreshIndex % leds.length];

    if (MoveSteps.includes(led)) {
      const stepIndex = MoveSteps.indexOf(led);
      if (sequencerMode) {
        if (stepIndex === sequencerSelectedStep) {
          setLED(led, White);
        } else {
          setLED(led, sequencerSteps[stepIndex] ? BrightGreen : DarkGrey);
        }
      } else {
        setLED(led, stepIndex === pageIndex ? White : Black);
      }
    } else {
      setLED(led, heldPads.has(led) ? BrightRed : DarkGrey);
    }

    ledRefreshIndex += 1;
  }
}

function readParam(name, fallback) {
  if (typeof host_module_get_param === "function") {
    const raw = host_module_get_param(name);
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readChainParams() {
  const midiChannel = readParam("midi_channel", settings.midiChannel);

  settings = {
    midiChannel: channelEditedLocally ? settings.midiChannel : midiChannel,
    padOctave: readParam("pad_octave", settings.padOctave),
    velocity: readParam("velocity", settings.velocity),
    drumPartChannel: readParam("drum_channel", settings.drumPartChannel),
    externalCable: readParam("external_cable", settings.externalCable)
  };
}

function setPage(index) {
  pageIndex = clamp(index, 0, PAGES.length - 1);
  draw();
  ledRefreshIndex = MovePads.length;
}

function noteFromPad(padNote) {
  const padIndex = MovePads.indexOf(padNote);
  const base = clamp(settings.padOctave, 0, 8) * 12;
  return clamp(base + Math.max(0, padIndex), 0, 127);
}

function knobIndexFromCc(cc) {
  if (cc >= MoveKnob1 && cc < MoveKnob1 + 8) {
    return cc - MoveKnob1;
  }
  return -1;
}

function relativeDelta(value) {
  if (value >= 1 && value <= 63) {
    return value;
  }

  if (value >= 64 && value <= 127) {
    return value - 128;
  }

  return 0;
}

function releaseHeldPads(channel) {
  for (const held of heldPads.values()) {
    if (held.channel === channel) {
      sendNote(channel, held.note, 0);
    }
  }
  heldPads.clear();
}

function setMidiChannelFromJog(value) {
  const delta = relativeDelta(value);
  if (delta === 0) {
    return true;
  }

  const previousChannel = mainChannel();
  const nextChannel = clamp(previousChannel + (delta > 0 ? 1 : -1), 1, 16);
  if (nextChannel === previousChannel) {
    return true;
  }

  releaseHeldPads(previousChannel);
  settings.midiChannel = nextChannel;
  channelEditedLocally = true;

  if (typeof host_module_set_param === "function") {
    host_module_set_param("midi_channel", String(nextChannel));
  }

  draw();
  return true;
}

function handleControl(cc, value) {
  if (cc === MovePlay && value > 0) {
    // Shift+play opens save/load mode (works from any view)
    if (shiftHeld) {
      saveLoadMode = saveLoadMode ? false : "pick";
      draw();
      return true;
    }
    if (sequencerMode) {
      sequencerRunning = !sequencerRunning;
      if (!sequencerRunning && sequencerHeldNote) {
        sendNote(sequencerHeldNote.channel, sequencerHeldNote.note, 0);
        sequencerHeldNote = null;
      }
      draw();
      return true;
    }
    sendMidiStart();
    return true;
  }

  if (cc === MoveRec && value > 0) {
    if (shiftHeld) {
      // Shift+REC = clear all steps and stop
      sequencerSteps = new Array(16).fill(false);
      sequencerNotes = new Array(16).fill(60);
      sequencerVelocities = new Array(16).fill(100);
      sequencerRunning = false;
      if (sequencerHeldNote) {
        try { sendNote(sequencerHeldNote.channel, sequencerHeldNote.note, 0); } catch (e) {}
        sequencerHeldNote = null;
      }
      sequencerSelectedStep = 0;
      draw();
      return true;
    }
    sequencerMode = !sequencerMode;
    // Do NOT stop playback when toggling view — sequencer keeps running in background
    draw();
    return true;
  }

  if (cc === MoveShift) {
    shiftHeld = value > 0;
    return true;
  }

  if (cc === MoveMainKnob) {
    if (sequencerMode && shiftHeld) {
      // Shift+main knob = adjust step length (1-16)
      const delta = relativeDelta(value);
      sequencerLength = clamp(sequencerLength - delta, 1, 16);
      draw();
      return true;
    }
    if (sequencerMode) {
      // Main knob = adjust tempo
      const delta = relativeDelta(value);
      sequencerTicksPerStep = clamp(sequencerTicksPerStep - delta, 4, 40);
      draw();
      return true;
    }
    if (shiftHeld) {
      return setMidiChannelFromJog(value);
    }
    return false;
  }

  // In sequencer mode, knob 1 edits velocity of selected step
  if (sequencerMode) {
    const knobIndex = knobIndexFromCc(cc);
    if (knobIndex === 0) {
      const delta = relativeDelta(value);
      sequencerVelocities[sequencerSelectedStep] = clamp(
        sequencerVelocities[sequencerSelectedStep] + delta, 1, 127
      );
      draw();
      return true;
    }
    // Let other knobs fall through to CC control (tweak synth while seq plays)
  }

  const knobIndex = knobIndexFromCc(cc);
  if (knobIndex < 0) {
    return false;
  }

  const page = activePage();
  const control = page.controls[knobIndex];
  if (!control) {
    return false;
  }

  const values = pageValues[pageIndex];
  const nextValue = clamp(values[knobIndex] + relativeDelta(value), 0, 127);
  values[knobIndex] = nextValue;
  if (page.channel === "drum") {
    sendNote(drumChannel(), control[1], nextValue);
  } else {
    sendCc(controlChannel(page), control[1], nextValue);
  }
  draw();
  return true;
}

function handlePad(status, note, velocity) {
  if (!MovePads.includes(note)) {
    return false;
  }

  const outNote = noteFromPad(note);
  const channel = mainChannel();
  if (sequencerMode) {
    try {
      // ensure selected step is valid
      sequencerSelectedStep = clamp(sequencerSelectedStep, 0, sequencerSteps.length - 1);

      if (status === MidiNoteOn && velocity > 0) {
        sequencerNotes[sequencerSelectedStep] = outNote;
        sequencerVelocities[sequencerSelectedStep] = clamp(settings.velocity, 1, 127);
        sequencerSteps[sequencerSelectedStep] = true;
        try { sendNote(channel, outNote, sequencerVelocities[sequencerSelectedStep]); } catch (e) {}
        try { setLED(note, BrightRed); } catch (e) {}
        draw();
        return true;
      }

      if (status === MidiNoteOff || (status === MidiNoteOn && velocity === 0)) {
        try { sendNote(channel, outNote, 0); } catch (e) {}
        try { setLED(note, DarkGrey); } catch (e) {}
        return true;
      }
    } catch (error) {
      // swallow errors to avoid crashing the module
      try { console.log('Sequencer pad handler error: ' + String(error)); } catch (e) {}
      return false;
    }

    return false;
  }

  if (status === MidiNoteOn && velocity > 0) {
    try {
      heldPads.set(note, { note: outNote, channel });
      try { sendNote(channel, outNote, clamp(settings.velocity, 1, 127)); } catch (e) {}
      try { setLED(note, BrightRed); } catch (e) {}
    } catch (e) {
      try { console.log('Pad press error: ' + String(e)); } catch (e2) {}
    }
    return true;
  }

  if (status === MidiNoteOff || (status === MidiNoteOn && velocity === 0)) {
    try {
      const held = heldPads.get(note);
      try { sendNote(held?.channel ?? channel, held?.note ?? outNote, 0); } catch (e) {}
      heldPads.delete(note);
      try { setLED(note, DarkGrey); } catch (e) {}
    } catch (e) {
      try { console.log('Pad release error: ' + String(e)); } catch (e2) {}
    }
    return true;
  }

  return false;
}

function handleStep(status, note, velocity) {
  if (status !== MidiNoteOn || velocity === 0 || !MoveSteps.includes(note)) {
    return false;
  }

  const index = MoveSteps.indexOf(note);

  // Save/load slot picker — steps 1-4 = save slots, steps 5-8 = load slots
  if (saveLoadMode) {
    const slot = index; // 0-indexed slot (we support 0-3 = save, 4-7 = load)
    if (slot < NUM_SLOTS) {
      // Save to slot (steps 1-4)
      const ok = saveState(slot);
      saveLoadFeedback = ok ? "SAVED> slot " + (slot + 1) : "SAVE FAILED";
      saveLoadFeedbackTimer = 30;
      saveLoadMode = false;
      draw();
      return true;
    } else if (slot < NUM_SLOTS * 2) {
      // Load from slot (steps 5-8)
      const loadSlot = slot - NUM_SLOTS;
      const ok = loadState(loadSlot);
      saveLoadFeedback = ok ? "LOADED slot " + (loadSlot + 1) : "SLOT EMPTY";
      saveLoadFeedbackTimer = 30;
      saveLoadMode = false;
      draw();
      return true;
    } else {
      // Any other step cancels
      saveLoadMode = false;
      draw();
      return true;
    }
  }

  if (sequencerMode) {
    try {
      const safeIndex = clamp(index, 0, sequencerSteps.length - 1);
      if (shiftHeld) {
        sequencerSteps[safeIndex] = !sequencerSteps[safeIndex];
      }
      sequencerSelectedStep = safeIndex;
      draw();
      return true;
    } catch (error) {
      try { console.log('Sequencer step handler error: ' + String(error)); } catch (e) {}
      return false;
    }
  }

  if (index < PAGES.length) {
    setPage(index);
    return true;
  }

  return false;
}

globalThis.init = function() {
  settings = { ...DEFAULTS };
  pageIndex = 0;
  pageValues = PAGES.map(() => new Array(8).fill(64));
  heldPads.clear();
  sequencerMode = false;
  sequencerRunning = false;
  sequencerSelectedStep = 0;
  sequencerSteps = new Array(16).fill(false);
  sequencerNotes = new Array(16).fill(60);
  sequencerVelocities = new Array(16).fill(100);
  sequencerHeldNote = null;
  sequencerTick = 0;
  sequencerTicksPerStep = 10;
  sequencerLength = 16;
  shiftHeld = false;
  channelEditedLocally = false;
  txFlash = 0;
  rxFlash = 0;
  lastInput = "---";
  lastSent = "---";
  omniTestUntil = 0;
  logoMode = true;
  logoFrame = 0;
  logoPulse = 0;
  readChainParams();
  draw();
  ledRefreshIndex = 0;
};

globalThis.tick = function() {
  try {
    readChainParams();
  if (omniTestUntil > 0) {
    omniTestUntil -= 1;
    if (omniTestUntil === 0) {
      sendAllChannelsNote(60, 0);
    }
  }
  if (txFlash > 0) {
    txFlash -= 1;
    if (txFlash === 0) {
      draw();
    }
  }
  if (rxFlash > 0) {
    rxFlash -= 1;
    if (rxFlash === 0) {
      draw();
    }
  }

  if (logoMode) {
    logoFrame += 1;
    if (logoFrame >= logoDuration) {
      logoMode = false;
      draw();
    } else if (logoFrame % 4 === 0) {
      draw();
    }
    return;
  }

    if (sequencerRunning) {  // runs regardless of which view is active
      try {
        sequencerTick += 1;
        if (sequencerTick >= sequencerTicksPerStep) {
          sequencerTick = 0;
          if (sequencerHeldNote) {
            try { sendNote(sequencerHeldNote.channel, sequencerHeldNote.note, 0); } catch (e) {}
          }
          sequencerSelectedStep = (sequencerSelectedStep + 1) % sequencerLength;
          if (sequencerSteps[sequencerSelectedStep]) {
            const note = sequencerNotes[sequencerSelectedStep];
            const velocity = sequencerVelocities[sequencerSelectedStep];
            try { sendNote(mainChannel(), note, velocity); } catch (e) {}
            sequencerHeldNote = { channel: mainChannel(), note };
          } else {
            sequencerHeldNote = null;
          }
          draw();
        }
      } catch (e) {
        try { console.log('Sequencer tick error: ' + String(e)); } catch (e2) {}
      }
    }

    refreshSomeLeds();
  } catch (e) {
    try { console.log('Tick handler error: ' + String(e)); } catch (e2) {}
  }
};

function processIncomingMidi(data) {
  rxFlash = 12;
  lastInput = data.slice(0, 4).map((byte) => String(byte ?? 0).padStart(3, "0")).join(" ");
  draw();

  // Detect USB-MIDI packet header: if the first byte looks like a CIN (0x00-0x0F)
  // then the real MIDI bytes start at offset 1. Otherwise assume raw MIDI (offset 0).
  const offset = (data.length >= 4 && data[0] >= 0x00 && data[0] <= 0x0f) ? 1 : 0;
  const statusByte = data[offset] || 0;
  const status = statusByte & 0xf0;
  const noteOrCc = data[offset + 1] || 0;
  const value = data[offset + 2] || 0;

  // Always try to handle control-style buttons (PLAY/REC) by their id regardless
  // of whether they arrived as CC or Note messages.
  // If this is a CC message, give `handleControl` first dibs (encoders, shift, jog, etc.)
  if (status === 0xb0) {
    if (handleControl(noteOrCc, value)) return;
  } else if (noteOrCc === MovePlay || noteOrCc === MoveRec) {
    // Also ensure Play/Rec sent as Notes are handled.
    if (handleControl(noteOrCc, value)) return;
  }

  // Next, try step handling (step buttons / page selectors)
  if (handleStep(status, noteOrCc, value)) {
    return;
  }

  // Finally, default to pad handling
  handlePad(status, noteOrCc, value);
}

globalThis.onMidiMessageInternal = function(data) {
  if (!data) return;
  try {
    processIncomingMidi(data);
  } catch (e) {
    try { console.log('onMidiMessageInternal error: ' + String(e)); } catch (e2) {}
  }
};

globalThis.onMidiMessageExternal = function(data) {
  if (!data) return;
  try {
    processIncomingMidi(data);
  } catch (e) {
    try { console.log('onMidiMessageExternal error: ' + String(e)); } catch (e2) {}
  }
};
