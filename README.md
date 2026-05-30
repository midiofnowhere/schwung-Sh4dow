# SH-4d Control for Schwung

This is a Schwung Overtake module for Ableton Move that turns Move into a direct USB MIDI controller for the Roland SH-4d.

## What it does

- Sends notes from Move pads to the SH-4d.
- Maps Move's 8 encoders to SH-4d synth controls.
- Uses Move step buttons to switch parameter pages.
- Uses Shift + jog wheel to change the active SH-4d MIDI part/channel.
- Sends MIDI Start to the SH-4d when Play is pressed on Move.
- Pressing Rec sends a short C note on all 16 MIDI channels for connection testing.
- Sends standard MIDI CC messages

## Pages

1. Tone: cutoff, resonance, attack, decay, sustain, release, vibrato rate, vibrato depth
2. Shape: osc shape, pitch, fine tune, pulse width, supersaw detune, noise level, portamento, bend range
3. Amp/FX: level, pan, drive, chorus, delay, reverb, MFX control 1, MFX control 2
4. Motion: LFO rate, LFO depth, filter env depth, amp env depth, mod amount, velocity, expression, hold
5. Drum 1: controls SH-4d rhythm slots 1-8 on the configured drum MIDI channel
the drums pages are currently not working
## SH-4d setup

1. Connect Ableton Move to the SH-4d over USB MIDI.
2. On the SH-4d, enable USB MIDI and set the receiving part to the same MIDI channel as this module.
3. In Schwung, look under Overtake modules rather than Sound Generators or MIDI FX.

## Package

The downloadable package is `dist/sh4d-control-1.0.9.tar.gz`.use schwung manager to install
