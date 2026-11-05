# VIRTUAL MUSIC STUDIO
> *"Your Instruments. Your Keyboard. Your Music."*

A complete, fully functional, professional-grade **Virtual Music Studio and Digital Audio Workstation (DAW)** web application built with vanilla HTML5, CSS3, modern JavaScript (ES6+), and the Web Audio API.

---

## 🎹 Quick Start

### Option 1: Direct in Any Web Browser (Zero Setup)
Simply double-click or open **`frontend/index.html`** in any modern web browser (Google Chrome, Microsoft Edge, Brave, Firefox, or Safari).
No installation, npm build step, or frontend framework required!

### Option 2: Running with Node.js & Express Server
```bash
# Install dependencies
npm install

# Start local server
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## 🚀 Key Features

### 1. 24 Authentic Playable Musical Instruments
Organized into 5 distinct instrument families with genuine acoustic timbres, dynamic ADSR envelopes, resonant filter modeling, and SoundFont integration:

| Family | Instruments |
| :--- | :--- |
| **Piano Family (6)** | Classical Piano, Grand Classical Piano, Upright Piano, Auditorium Piano, Stage Piano (Rhodes), Jazz Piano |
| **Other Keyboards (2)** | Pipe Organ, Accordion |
| **String Instruments (8)**| Classical Guitar, Flamenco Guitar, Concert Harp, Solo Violin, Double Bass, Sitar, Oud, Koto |
| **Percussion & Mallets (3)** | Tuned Glockenspiel, Mixed Percussion (Taiko/Congas), Caribbean Steel Pan |
| **Wind & Brass (5)** | Andean Pan Flute, Alto Saxophone, Bb Clarinet, French Oboe, Symphonic Brass Ensemble |

### 2. High-Precision QWERTY Keyboard Music Engine
Every key on your physical computer keyboard triggers realistic musical notes with polyphony, sustained chords, velocity sensitivity, and visual on-screen lighting:

- **Lower Row (Natural Notes):** `A` (C4), `S` (D4), `D` (E4), `F` (F4), `G` (G4), `H` (A4), `J` (B4), `K` (C5), `L` (D5), `;` (E5)
- **Upper Row (Chromatic Accidentals):** `W` (C#4), `E` (D#4), `T` (F#4), `Y` (G#4), `U` (A#4), `O` (C#5), `P` (D#5)
- **Octave Shifting:** `Z` (Octave Down) / `X` (Octave Up)
- **Velocity Adjustment:** `C` (Decrease Velocity) / `V` (Increase Velocity)
- **Pedal & Panic:** `Spacebar` (Sustain Pedal) / `Escape` (Panic / Silence All Voices)

### 3. Professional Multi-Track Arranger & Timeline
- Add multiple independent tracks with custom instruments.
- Independent volume faders, stereo panning (`-1.0` to `+1.0`), Mute (M), Solo (S), and Arm for Recording (●).
- Visual note blocks timeline with musical bar indicators and synchronized timecode display.
- Integrated **Piano Roll Editor** with 1/16th note snap-to-grid, note creation, double-click deletion, pitch auditioning, and quantization.

### 4. 16-Step Drum Sequencer
- 8 dynamic drum channels: Kick Drum, Snare, Closed Hi-Hat, Open Hi-Hat, Low Tom, High Tom, Hand Shaker/Clap, World Conga/Bongo.
- Adjustable BPM and swing groove.
- Pre-programmed beat patterns: Rock, Hip-Hop, House/EDM, and Jazz Swing.

### 5. Music Theory & Creative Tools Lab
- **Interactive Circle of Fifths:** Click any node to transpose keys and highlight in-scale notes.
- **Scale Highlighting:** Explores Major, Minor, Harmonic Minor, Pentatonic, Blues, Dorian, Flamenco, and Indian Ragas (Bhairav & Yaman).
- **Chord Progression Generator:** Instant chord demonstrations with arpeggiated playback.

### 6. 16 Musical Genre Explorers
Comprehensive historical overview, typical BPMs, characteristic scales, rhythm styles, audio demonstrations, and 1-click **"Load Studio Preset"** buttons for:
Classical, Jazz, Blues, Rock, Pop, Electronic, Hip-Hop, Folk, Indian Classical, Carnatic, Hindustani, Flamenco, Latin, Ambient, Cinematic, and World Music.

### 7. Interactive Guided Tutorials
Step-by-step interactive lessons with real-time QWERTY keystroke detection, visual target key glows, and audio examples:
- *Mastering the QWERTY Keyboard*
- *Sharps & Flats (The Upper Row)*
- *Playing Your First Triad Chord*
- *Recording Your First Song Take*
- *Playing Indian Classical on the Sitar*
- *Building a 16-Step Drum Groove*

### 8. Full DSP Effects Rack
- 3-Band Parametric Equalizer (Low Shelf 250Hz, Peaking Mid 1200Hz, High Shelf 4500Hz)
- Algorithmic Convolution Reverb with room size and damping
- Stereo Ping-Pong / Tempo Delay with feedback
- Multi-Voice Chorus
- Dynamic Peak Compressor
- Resonant Low-Pass and High-Pass Filters

### 9. Export & Persistence
- **16-bit PCM Stereo WAV Export:** Rendered directly using `OfflineAudioContext` for full composition fidelity.
- **Standard MIDI File (.mid) Export:** Formatted SMF Type 1 with tempo tracks and multi-channel events.
- **IndexedDB Local Storage:** Autosave, project templates, backup, and restore.

---

## 🏛 Project Architecture

```
virtual-music-studio/
├── frontend/
│   ├── index.html              # Main application single-page interface
│   ├── css/
│   │   ├── global.css          # Design system & dark purple theme
│   │   ├── studio.css          # Performance view & visualizer
│   │   ├── keyboard.css        # 88-key piano & QWERTY layout
│   │   ├── instruments.css     # 24-instrument catalog grid
│   │   ├── timeline.css        # DAW timeline & piano roll
│   │   ├── drum-machine.css    # 16-step beat sequencer
│   │   ├── music-lab.css       # Theory lab & circle of fifths
│   │   ├── genre.css           # 16 genre explorer cards
│   │   └── responsive.css      # Desktop, tablet & mobile layout
│   └── js/
│       ├── audio-engine.js         # Core Web Audio API graph & DSP
│       ├── effects.js              # EQ, Reverb, Delay, Chorus, Compressor
│       ├── instrument-catalog.js   # 24 instrument profiles & timbres
│       ├── soundfont-manager.js    # SoundFont loader & acoustic synthesizer
│       ├── instrument-manager.js   # Instrument switching & favorites
│       ├── note-mapper.js          # QWERTY key-to-pitch translation
│       ├── keyboard-controller.js  # Polyphonic voice & visual feedback
│       ├── recording-engine.js     # MIDI event & audio stream capture
│       ├── track-manager.js        # Multi-track sequencing & arranger
│       ├── piano-roll.js           # Interactive note matrix editor
│       ├── drum-machine.js         # 16-step drum rhythm engine
│       ├── music-theory.js         # Chord library, scales, circle of fifths
│       ├── genre-manager.js        # 16 genre encyclopedia & presets
│       ├── tutorial-manager.js     # Interactive learning with key validation
│       ├── project-manager.js      # IndexedDB project persistence
│       ├── export-manager.js       # 16-bit PCM WAV & MIDI encoder
│       └── app.js                  # Main application coordinator
├── backend/
│   ├── server.js               # Express server & static asset host
│   └── package.json            # Backend dependencies
├── package.json
└── README.md
```

---

## ⚖️ Licensing & Audio Attribution

All instrument soundbanks utilized are legally compliant with open licenses:
- **FluidR3 SoundFont:** MIT License / GeneralUser GS Public SoundBank.
- **Chaos SoundFont:** CC0 1.0 Universal Public Domain Dedication.
- **WebAudioFont Player:** Sergey Surikov (MIT License).
- **Application Code:** MIT License.
