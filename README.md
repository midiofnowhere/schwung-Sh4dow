# sh4Dow: Roland SH-4d Controller for Ableton Move

**sh4Dow** is a specialized Schwung Overtake module designed to bridge the gap between the tactile, portable interface of the Ableton Move and the powerful synthesis engine of the **Roland SH-4d**. By mapping the Move’s physical controls directly to the SH-4d’s MIDI CC parameters, this module enables deep, hands-on sound design and performance manipulation without requiring direct interaction with the SH-4d’s own interface.

---

## 🚀 About the Roland SH-4d
The Roland SH-4d is a versatile desktop synthesizer featuring a multi-timbral engine capable of classic analog-style modeling, wavetable synthesis, and high-quality drum sounds. Its complex architecture benefits greatly from dedicated hardware control, which is exactly what **sh4Dow** provides: a seamless way to tweak filter cutoffs, envelopes, LFOs, and effects across 16 different MIDI channels.

---

## 🎹 Control Pages & Mapping

Navigate between parameter pages using the Move’s **Step Buttons 1–4**.

| Page | Description | Key Parameters |
| :--- | :--- | :--- |
| **TONE** | Core Synth Engine | Cutoff, Resonance, AMP Attack, Decay, Sustain, Release, Timbre, Mod |
| **FILTER** | Filter Shaping | Filter Attack, Decay, Sustain, Release, Env Depth, HPF, Key Track, Drive |
| **SHAPE** | Pitch & LFOs | Pitch, Portamento, LFO Rate, LFO Fade, LFO Depth (Pitch/Filter/Amp), Hold |
| **AMP/FX** | Dynamics & MFX | Level, Pan, Sliders 1–4, Expression, Sostenuto |
| **DRUM 1** | Rhythm Slots 1–8 | Controls rhythm parts 1–8 on the designated drum MIDI channel |

---

## ⚙️ Setup Guide

1.  **Hardware Connection**: Connect the Ableton Move to the SH-4d using a dedicated **USB MIDI interface**.
2.  **SH-4d Configuration**: Enable USB MIDI on the SH-4d and ensure the receiving MIDI part is set to the same MIDI channel as the **sh4Dow** module.
3.  **Module Installation**: 
    * Download the package `dist/sh4d-control-1.0.9.tar.gz`.
    * Use the Schwung manager to install the package.
    * In the Schwung menu, navigate to the **Overtake** section to load the module.
4.  **Parameter Alignment**: Configure the chain parameters (`MIDI Channel`, `Pad Octave`, `Drum Channel`) within the Schwung module settings to match your SH-4d patch structure.

---

## 🛠 Advanced Sequencer Workflow

* **Toggle Sequencer**: Press **REC** to enter or exit Sequencer Mode.
* **Connection Test**: Pressing **REC** sends a short C note (MIDI 60) across all 16 MIDI channels to verify your USB MIDI interface connection.
* **Synchronization**: Pressing **PLAY** on the Move sends a standard MIDI Start message to the SH-4d, ensuring your external synth stays in perfect time with your Move project.
* **MIDI Routing**: Use **Shift + Jog Wheel (Main Knob)** to change the active SH-4d MIDI part/channel on the fly.

---

## 🚧 Status: Work in Progress
Thank you so much for using **sh4Dow**! Your support and feedback are incredibly appreciated as we refine this controller.

Please note that this module is under active development:
* **Sequencer Functionality**: The built-in sequencer engine is a work-in-progress; advanced timing and playback features are still being optimized.
* **Drum Pages**: The Drum 1 and Drum 2 pages are currently under construction and are not yet fully functional for triggering internal SH-4d rhythm slots.

**Coming Soon:** We are excited to announce that a similar module is currently in development to provide deep, dedicated control for the **Korg Volca FM**! Stay tuned for updates. 

*Developed by clairebear | Version 1.2.3*

Yup trans rights