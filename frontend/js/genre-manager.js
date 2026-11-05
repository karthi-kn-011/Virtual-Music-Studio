/**
 * Virtual Music Studio - Genre Explorer
 * In-depth encyclopedia of 16 musical genres with historical context, common instruments,
 * typical BPMs, scale & progression analysis, interactive demos, and 1-click studio setup presets.
 */

const GENRES_DATA = [
  {
    id: 'classical',
    name: 'Classical',
    period: 'Baroque, Classical & Romantic Eras',
    bpmRange: '60 - 132 BPM',
    defaultBpm: 92,
    timeSignature: '4/4 or 3/4',
    description: 'Sophisticated Western art music renowned for formal balance, harmonic counterpoint, emotional range, and rich orchestral sonorities.',
    commonInstruments: ['Grand Classical Piano', 'Violin', 'Double Bass', 'Harp', 'Oboe', 'Clarinet'],
    primaryInstrumentId: 'grand_classical_piano',
    recommendedInstruments: ['grand_classical_piano', 'violin', 'double_bass', 'harp', 'oboe', 'brass_ensemble'],
    scales: ['Major (Ionian)', 'Harmonic Minor', 'Melodic Minor'],
    progressions: ['I - IV - V - I', 'ii - V7 - I', 'Circle of Fifths Cadence'],
    rhythmStyle: 'Rubato, lyrical phrasing, precise dynamic articulation',
    practiceTask: 'Play a C Major triad (C-E-G) on the Grand Classical Piano with gentle dynamics, then add an arpeggio in the left hand.',
    demoNotes: [
      { note: 60, delay: 0, dur: 450 },
      { note: 64, delay: 300, dur: 450 },
      { note: 67, delay: 600, dur: 600 },
      { note: 72, delay: 900, dur: 900 },
      { note: 71, delay: 1400, dur: 350 },
      { note: 69, delay: 1750, dur: 350 },
      { note: 67, delay: 2100, dur: 800 }
    ]
  },
  {
    id: 'jazz',
    name: 'Jazz',
    period: '20th Century to Contemporary',
    bpmRange: '80 - 240 BPM',
    defaultBpm: 130,
    timeSignature: '4/4 (Swing)',
    description: 'Rooted in African American blues and ragtime, characterized by swing rhythm, complex extended chords, syncopation, and spontaneous improvisation.',
    commonInstruments: ['Jazz Piano', 'Saxophone', 'Double Bass', 'Clarinet', 'Mixed Percussion'],
    primaryInstrumentId: 'jazz_piano',
    recommendedInstruments: ['jazz_piano', 'saxophone', 'double_bass', 'clarinet'],
    scales: ['Dorian Mode', 'Blues Scale', 'Bebop Dominant', 'Melodic Minor'],
    progressions: ['ii - V - I (Dm7 - G7 - Cmaj7)', 'iii - vi - ii - V', 'Coltrane Changes'],
    rhythmStyle: 'Swung eighth notes, syncopated chord comps, walking basslines',
    practiceTask: 'Comp a Dm7 chord (D-F-A-C) on the offbeats while feeling the ride cymbal swing.',
    demoNotes: [
      { note: 62, delay: 0, dur: 350 },
      { note: 65, delay: 250, dur: 350 },
      { note: 69, delay: 500, dur: 400 },
      { note: 72, delay: 750, dur: 600 },
      { note: 71, delay: 1100, dur: 300 },
      { note: 68, delay: 1400, dur: 400 },
      { note: 67, delay: 1800, dur: 700 }
    ]
  },
  {
    id: 'blues',
    name: 'Blues',
    period: 'Delta & Chicago Eras to Modern',
    bpmRange: '70 - 120 BPM',
    defaultBpm: 88,
    timeSignature: '12/8 or 4/4 Shuffle',
    description: 'The foundation of modern rock, soul, and jazz. Expresses deep pathos, call-and-response phrasing, and bent "blue notes".',
    commonInstruments: ['Classical Guitar', 'Stage Piano', 'Organ', 'Saxophone'],
    primaryInstrumentId: 'classical_guitar',
    recommendedInstruments: ['classical_guitar', 'stage_piano', 'organ', 'saxophone'],
    scales: ['Minor Blues Scale (1, b3, 4, b5, 5, b7)', 'Major Blues'],
    progressions: ['12-Bar Blues: I7 - IV7 - I7 - V7 - IV7 - I7'],
    rhythmStyle: 'Triplet shuffle, heavy downbeat accents, stinging bent notes',
    practiceTask: 'Practice sliding into the blue note (F# in C Blues: C-Eb-F-F#-G-Bb) and resolving back down to F and Eb.',
    demoNotes: [
      { note: 60, delay: 0, dur: 400 },
      { note: 63, delay: 350, dur: 400 },
      { note: 65, delay: 700, dur: 300 },
      { note: 66, delay: 1000, dur: 250 },
      { note: 67, delay: 1250, dur: 600 },
      { note: 70, delay: 1700, dur: 500 },
      { note: 72, delay: 2100, dur: 900 }
    ]
  },
  {
    id: 'rock',
    name: 'Rock',
    period: '1950s Classic to Alternative',
    bpmRange: '110 - 160 BPM',
    defaultBpm: 128,
    timeSignature: '4/4 Driving',
    description: 'High-energy anthemic genre propelled by driving drum backbeats, powerful guitar riffs, and catchy vocal melodies.',
    commonInstruments: ['Flamenco Guitar', 'Stage Piano', 'Organ', 'Mixed Percussion'],
    primaryInstrumentId: 'flamenco_guitar',
    recommendedInstruments: ['flamenco_guitar', 'stage_piano', 'organ', 'mixed_percussion'],
    scales: ['Minor Pentatonic', 'Dorian', 'Mixolydian'],
    progressions: ['I - IV - V (Power Chords)', 'i - VI - VII (Am - F - G)', 'I - bVII - IV'],
    rhythmStyle: 'Straight 8th notes, heavy snare hits on beats 2 and 4',
    practiceTask: 'Play a driving Am - G - F rock progression with rhythmic eighth-note attacks.',
    demoNotes: [
      { note: 57, delay: 0, dur: 250 },
      { note: 57, delay: 200, dur: 250 },
      { note: 60, delay: 400, dur: 300 },
      { note: 62, delay: 700, dur: 500 },
      { note: 60, delay: 1100, dur: 300 },
      { note: 57, delay: 1400, dur: 600 }
    ]
  },
  {
    id: 'pop',
    name: 'Pop',
    period: 'Contemporary Global Hits',
    bpmRange: '95 - 130 BPM',
    defaultBpm: 118,
    timeSignature: '4/4',
    description: 'Polished, melodic, hook-centric commercial music crafted with immediate vocal hooks, lush synth pads, and energetic rhythm grooves.',
    commonInstruments: ['Classical Piano', 'Stage Piano', 'Acoustic Guitar', 'Glockenspiel'],
    primaryInstrumentId: 'classical_piano',
    recommendedInstruments: ['classical_piano', 'stage_piano', 'classical_guitar', 'glockenspiel'],
    scales: ['Major', 'Natural Minor', 'Major Pentatonic'],
    progressions: ['I - V - vi - IV (C - G - Am - F)', 'vi - IV - I - V (Am - F - C - G)'],
    rhythmStyle: 'Four-on-the-floor kick, syncopated melodic hooks, crisp clap layers',
    practiceTask: 'Play the ubiquitous 4-chord pop progression (C - G - Am - F) in root positions with your right hand.',
    demoNotes: [
      { note: 60, delay: 0, dur: 350 },
      { note: 64, delay: 250, dur: 350 },
      { note: 67, delay: 500, dur: 450 },
      { note: 71, delay: 800, dur: 450 },
      { note: 69, delay: 1150, dur: 500 },
      { note: 65, delay: 1550, dur: 600 }
    ]
  },
  {
    id: 'electronic',
    name: 'Electronic',
    period: 'Synthwave, House & EDM',
    bpmRange: '120 - 140 BPM',
    defaultBpm: 126,
    timeSignature: '4/4',
    description: 'Produced through synthesizers, sequencers, and drum machines; emphasizes hypnotic loops, sweeping filter cuts, and energetic builds.',
    commonInstruments: ['Stage Piano', 'Organ', 'Glockenspiel', 'Mixed Percussion'],
    primaryInstrumentId: 'stage_piano',
    recommendedInstruments: ['stage_piano', 'organ', 'glockenspiel', 'mixed_percussion'],
    scales: ['Minor (Aeolian)', 'Dorian', 'Phrygian'],
    progressions: ['i - VI - III - VII', 'i - VII - v - VI'],
    rhythmStyle: 'Driving 4/4 bass drum, off-beat hi-hats, arpeggiated 16th lead sequences',
    practiceTask: 'Engage the studio arpeggiator on 1/16th notes and hold down a minor triad to create an EDM lead motif.',
    demoNotes: [
      { note: 60, delay: 0, dur: 180 },
      { note: 63, delay: 180, dur: 180 },
      { note: 67, delay: 360, dur: 180 },
      { note: 70, delay: 540, dur: 180 },
      { note: 72, delay: 720, dur: 250 },
      { note: 70, delay: 900, dur: 180 },
      { note: 67, delay: 1080, dur: 180 }
    ]
  },
  {
    id: 'hiphop',
    name: 'Hip-Hop',
    period: 'Boom-Bap to Modern Trap',
    bpmRange: '80 - 100 BPM / 140 BPM (Half-Time)',
    defaultBpm: 88,
    timeSignature: '4/4',
    description: 'Rhythmic, beat-driven urban art characterized by heavy sub-bass 808s, swinging boom-bap kicks, crisp claps, and chopped instrument samples.',
    commonInstruments: ['Stage Piano', 'Classical Piano', 'Mixed Percussion', 'Violin'],
    primaryInstrumentId: 'stage_piano',
    recommendedInstruments: ['stage_piano', 'classical_piano', 'violin', 'mixed_percussion'],
    scales: ['Natural Minor', 'Harmonic Minor', 'Phrygian'],
    progressions: ['i - iv - V7', 'i - VI (Simple repetitive 2-chord loop)'],
    rhythmStyle: 'Heavy swing, delayed snares, rapid 32nd-note trap hi-hat rolls',
    practiceTask: 'Record a dark 2-chord piano loop in A Minor and layer it over the 88 BPM drum machine pattern.',
    demoNotes: [
      { note: 57, delay: 0, dur: 450 },
      { note: 60, delay: 350, dur: 400 },
      { note: 64, delay: 700, dur: 500 },
      { note: 67, delay: 1100, dur: 400 },
      { note: 65, delay: 1500, dur: 550 },
      { note: 64, delay: 1950, dur: 700 }
    ]
  },
  {
    id: 'folk',
    name: 'Folk',
    period: 'Traditional Acoustic Heritage',
    bpmRange: '75 - 115 BPM',
    defaultBpm: 100,
    timeSignature: '4/4, 3/4 or 6/8',
    description: 'Storytelling acoustic music passed down through generations, centered around honest vocal melodies, acoustic guitar fingerpicking, and accordion warmth.',
    commonInstruments: ['Classical Guitar', 'Accordion', 'Violin', 'Upright Piano'],
    primaryInstrumentId: 'classical_guitar',
    recommendedInstruments: ['classical_guitar', 'accordion', 'violin', 'upright_piano'],
    scales: ['Major Pentatonic', 'Mixolydian', 'Dorian'],
    progressions: ['I - IV - V', 'I - V - vi - IV', 'i - bVII - bVI - V'],
    rhythmStyle: 'Fingerpicking patterns (Travis picking), strummed acoustic accents',
    practiceTask: 'Alternate bass notes with upper string finger plucks in 3/4 waltz time on the Classical Guitar.',
    demoNotes: [
      { note: 52, delay: 0, dur: 400 },
      { note: 59, delay: 250, dur: 350 },
      { note: 64, delay: 450, dur: 400 },
      { note: 67, delay: 700, dur: 450 },
      { note: 64, delay: 950, dur: 350 },
      { note: 59, delay: 1200, dur: 500 }
    ]
  },
  {
    id: 'indian_classical',
    name: 'Indian Classical',
    period: 'Ancient Vedic to Classical Tradition',
    bpmRange: 'Vilambit (Slow 40-70) to Drut (Fast 180+)',
    defaultBpm: 90,
    timeSignature: 'Teental (16 beats), Rupak (7 beats), Jhaptal (10 beats)',
    description: 'Immense modal microtonal tradition built on Ragas (melodic frameworks) and Talas (rhythmic cycles), evoking deep spiritual rasas.',
    commonInstruments: ['Sitar', 'Oud', 'Pan Flute', 'Mixed Percussion'],
    primaryInstrumentId: 'sitar',
    recommendedInstruments: ['sitar', 'oud', 'pan_flute', 'mixed_percussion'],
    scales: ['That Bilawal (Major)', 'That Bhairav (Double Harmonic)', 'That Yaman (Lydian)'],
    progressions: ['Modal drone-based; absence of Western chord progressions, focusing on Sa drone resonance.'],
    rhythmStyle: 'Intricate polyrhythmic Tihais, gliding meend (pitch bends), gamak shakes',
    practiceTask: 'Play the ascending Aaroh of Raga Bhairav (Sa-Re_komal-Ga-Ma-Pa-Dha_komal-Ni-Sa) with sitar sympathetic resonance.',
    demoNotes: [
      { note: 60, delay: 0, dur: 600 },
      { note: 61, delay: 450, dur: 550 },
      { note: 64, delay: 900, dur: 600 },
      { note: 65, delay: 1350, dur: 500 },
      { note: 67, delay: 1750, dur: 700 },
      { note: 68, delay: 2250, dur: 600 },
      { note: 71, delay: 2700, dur: 600 },
      { note: 72, delay: 3150, dur: 1000 }
    ]
  },
  {
    id: 'carnatic',
    name: 'Carnatic Music',
    period: 'South Indian Classical Heritage',
    bpmRange: '60 - 150 BPM',
    defaultBpm: 96,
    timeSignature: 'Adi Tala (8 beats), Misra Chapu (7 beats)',
    description: 'Devotional South Indian classical tradition celebrated for intricate mathematical rhythmic permutations (swaras) and fast gamakas.',
    commonInstruments: ['Violin', 'Pan Flute', 'Mixed Percussion', 'Double Bass'],
    primaryInstrumentId: 'violin',
    recommendedInstruments: ['violin', 'pan_flute', 'mixed_percussion'],
    scales: ['Mayamalavagowla (Raga 15)', 'Kalyani (Raga 65)', 'Sankarabharanam (Raga 29)'],
    progressions: ['Drone-centered (Adhara Shadjam) with elaborate microtonal gamaka embellishments.'],
    rhythmStyle: 'Konnakol rhythmic syllables, korvai rhythmic structures',
    practiceTask: 'Practice the Sarali Varisai patterns (S R G M | P D | N S) with fast lyrical violin phrasing.',
    demoNotes: [
      { note: 60, delay: 0, dur: 350 },
      { note: 61, delay: 250, dur: 350 },
      { note: 64, delay: 500, dur: 350 },
      { note: 65, delay: 750, dur: 350 },
      { note: 67, delay: 1000, dur: 400 },
      { note: 68, delay: 1300, dur: 350 },
      { note: 71, delay: 1550, dur: 350 },
      { note: 72, delay: 1800, dur: 800 }
    ]
  },
  {
    id: 'hindustani',
    name: 'Hindustani Classical',
    period: 'North Indian Classical Tradition',
    bpmRange: '50 - 160 BPM',
    defaultBpm: 84,
    timeSignature: 'Teental (16), Ektaal (12), Dadra (6)',
    description: 'North Indian classical style emphasizing gradual improvisational development through Alaap, Jod, and Jhala with rich sitar buzz and vocal nuances.',
    commonInstruments: ['Sitar', 'Pan Flute', 'Mixed Percussion', 'Oud'],
    primaryInstrumentId: 'sitar',
    recommendedInstruments: ['sitar', 'pan_flute', 'mixed_percussion', 'oud'],
    scales: ['Raga Yaman (Lydian: 1, 2, 3, #4, 5, 6, 7)', 'Raga Darbari Kanada', 'Raga Bageshri'],
    progressions: ['Continuous Sa-Pa tanpura drone accompaniment'],
    rhythmStyle: 'Meditative Alaap tempo gradually escalating into whirlwind Jhala fingerpicking',
    practiceTask: 'Play the signature Ni-Re-Ga phrase of Raga Yaman on the Sitar (B3 - D4 - E4).',
    demoNotes: [
      { note: 59, delay: 0, dur: 500 },
      { note: 62, delay: 400, dur: 500 },
      { note: 64, delay: 800, dur: 700 },
      { note: 66, delay: 1300, dur: 500 },
      { note: 67, delay: 1700, dur: 700 },
      { note: 71, delay: 2200, dur: 600 },
      { note: 72, delay: 2700, dur: 1000 }
    ]
  },
  {
    id: 'flamenco',
    name: 'Flamenco',
    period: 'Andalusian Spanish Tradition',
    bpmRange: '100 - 180 BPM',
    defaultBpm: 140,
    timeSignature: 'Compás (12-beat cycles: Soleá, Bulerías, Tangos 4/4)',
    description: 'Passionate Andalusian music born from Gypsy, Moorish, and Spanish cultures, renowned for fiery guitar rasgueados, palmas clapping, and poignant cante.',
    commonInstruments: ['Flamenco Guitar', 'Mixed Percussion', 'Violin', 'Accordion'],
    primaryInstrumentId: 'flamenco_guitar',
    recommendedInstruments: ['flamenco_guitar', 'mixed_percussion', 'accordion'],
    scales: ['Spanish Phrygian / Gypsy Scale (1, b2, 3, 4, 5, b6, b7)'],
    progressions: ['Andalusian Cadence: Am - G - F - E (iv - III - II - I)'],
    rhythmStyle: 'Palmas syncopated claps, golpes (wooden soundboard taps), rasgueado rolls',
    practiceTask: 'Execute the Andalusian progression Am - G - F - E with crisp Flamenco Guitar rasgueado stabs.',
    demoNotes: [
      { note: 57, delay: 0, dur: 350 },
      { note: 60, delay: 200, dur: 300 },
      { note: 64, delay: 400, dur: 450 },
      { note: 62, delay: 750, dur: 400 },
      { note: 65, delay: 1050, dur: 450 },
      { note: 64, delay: 1400, dur: 800 }
    ]
  },
  {
    id: 'latin',
    name: 'Latin',
    period: 'Salsa, Bossa Nova, Mambo & Cumbia',
    bpmRange: '90 - 220 BPM',
    defaultBpm: 125,
    timeSignature: '4/4 Clave (3-2 or 2-3)',
    description: 'Infectious Afro-Cuban and Brazilian rhythms driven by son clave patterns, syncopated piano montunos, bright brass horns, and polyrhythmic congas.',
    commonInstruments: ['Jazz Piano', 'Brass Ensemble', 'Saxophone', 'Steel Pan', 'Mixed Percussion'],
    primaryInstrumentId: 'jazz_piano',
    recommendedInstruments: ['jazz_piano', 'brass_ensemble', 'saxophone', 'steel_pan', 'mixed_percussion'],
    scales: ['Mixolydian', 'Dorian', 'Bossa Nova Major 7th'],
    progressions: ['ii - V - I', 'I - IV - V (Montuno Vamp)', 'Cmaj7 - Dm7 - Em7 - A7'],
    rhythmStyle: 'Syncopated montuno octave riffs, tumbao bass pulse on beat 4, clave guide',
    practiceTask: 'Play a classic salsa piano montuno pattern syncopated across beats 1-and and 2-and.',
    demoNotes: [
      { note: 60, delay: 0, dur: 250 },
      { note: 64, delay: 180, dur: 250 },
      { note: 67, delay: 360, dur: 300 },
      { note: 72, delay: 540, dur: 300 },
      { note: 69, delay: 800, dur: 300 },
      { note: 65, delay: 1050, dur: 300 },
      { note: 67, delay: 1300, dur: 500 }
    ]
  },
  {
    id: 'ambient',
    name: 'Ambient',
    period: '1970s Eno Pioneers to Modern Soundscapes',
    bpmRange: '50 - 80 BPM / Beatless Freeform',
    defaultBpm: 65,
    timeSignature: 'Free Meter / Fluid',
    description: 'Atmospheric sound art focusing on timbre, spatial texture, vast reverberation, and tranquility over conventional rhythmic structures.',
    commonInstruments: ['Auditorium Piano', 'Harp', 'Pan Flute', 'Glockenspiel'],
    primaryInstrumentId: 'auditorium_piano',
    recommendedInstruments: ['auditorium_piano', 'harp', 'pan_flute', 'glockenspiel'],
    scales: ['Lydian Mode', 'Major Pentatonic', 'Whole Tone'],
    progressions: ['Suspended modal pads: Csus2 - Fsus2 - Gsus4 - Am7'],
    rhythmStyle: 'Floating, sustained, generative, unmetered envelope blooms',
    practiceTask: 'Select Auditorium Piano, play a single slow octave note, and listen to the long reverb tail wash.',
    demoNotes: [
      { note: 48, delay: 0, dur: 2500 },
      { note: 55, delay: 400, dur: 2200 },
      { note: 62, delay: 900, dur: 2000 },
      { note: 67, delay: 1600, dur: 1800 },
      { note: 71, delay: 2400, dur: 2000 }
    ]
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    period: 'Hollywood Film Score & Trailer Soundtracks',
    bpmRange: '70 - 145 BPM',
    defaultBpm: 105,
    timeSignature: '4/4 or 6/8',
    description: 'Epic emotional compositions designed for film and games, fusing thunderous brass fanfares, soaring strings, delicate harp, and dramatic piano.',
    commonInstruments: ['Brass Ensemble', 'Violin', 'Auditorium Piano', 'Harp', 'Double Bass'],
    primaryInstrumentId: 'brass_ensemble',
    recommendedInstruments: ['brass_ensemble', 'violin', 'auditorium_piano', 'harp', 'double_bass'],
    scales: ['Natural Minor', 'Dorian', 'Phrygian Dominant'],
    progressions: ['i - VI - III - VII (The Hollywood Anthem)', 'i - iv - v - VI'],
    rhythmStyle: 'Staccato string ostinatos, thundering taiko hits, heroic brass swelling',
    practiceTask: 'Play a driving cinematic staccato ostinato on Dm (D-D-D-D) on the violin while adding brass chords.',
    demoNotes: [
      { note: 50, delay: 0, dur: 500 },
      { note: 57, delay: 350, dur: 450 },
      { note: 62, delay: 700, dur: 600 },
      { note: 65, delay: 1100, dur: 500 },
      { note: 69, delay: 1500, dur: 800 },
      { note: 67, delay: 2100, dur: 600 },
      { note: 62, delay: 2600, dur: 1200 }
    ]
  },
  {
    id: 'world_music',
    name: 'World Music',
    period: 'Global Transcultural Traditions',
    bpmRange: '85 - 135 BPM',
    defaultBpm: 110,
    timeSignature: 'Cross-rhythms (12/8, 7/8, 5/8)',
    description: 'A tapestry of diverse cultural roots uniting African polyrhythms, Celtic whistles, Asian zithers, Middle-Eastern ouds, and Caribbean steel pans.',
    commonInstruments: ['Steel Pan', 'Koto', 'Oud', 'Pan Flute', 'Mixed Percussion'],
    primaryInstrumentId: 'steel_pan',
    recommendedInstruments: ['steel_pan', 'koto', 'oud', 'pan_flute', 'mixed_percussion'],
    scales: ['Pentatonic', 'Hijaz', 'Insen', 'Pelog & Slendro'],
    progressions: ['Modal, cyclical ostinatos and polyphonic call-and-response'],
    rhythmStyle: '3-against-2 polyrhythms, syncopated bell patterns, vibrant hand drumming',
    practiceTask: 'Play a Japanese pentatonic melody on the Koto using notes D - Eb - G - A - Bb.',
    demoNotes: [
      { note: 62, delay: 0, dur: 350 },
      { note: 63, delay: 250, dur: 350 },
      { note: 67, delay: 500, dur: 400 },
      { note: 69, delay: 800, dur: 400 },
      { note: 70, delay: 1100, dur: 450 },
      { note: 74, delay: 1450, dur: 700 }
    ]
  }
];

class GenreManager {
  constructor() {
    this.genres = GENRES_DATA;
    this.selectedGenre = this.genres[0];
    this.containerEl = null;
  }

  init(containerEl) {
    this.containerEl = containerEl;
    this.render();
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'genres-grid';

    this.genres.forEach(genre => {
      const card = document.createElement('div');
      card.className = `genre-card ${this.selectedGenre.id === genre.id ? 'active' : ''}`;

      card.innerHTML = `
        <div class="genre-header">
          <h3 class="genre-name">${genre.name}</h3>
          <span class="genre-bpm-badge">${genre.defaultBpm} BPM</span>
        </div>
        <p class="genre-desc">${genre.description}</p>
        <div class="genre-meta-chips">
          <span class="chip">⏱ ${genre.timeSignature}</span>
          <span class="chip">🎸 ${genre.commonInstruments.slice(0, 2).join(', ')}</span>
        </div>
        <div class="genre-actions">
          <button class="btn btn-sm btn-ghost play-demo-btn">▶ Play Demo</button>
          <button class="btn btn-sm btn-primary load-preset-btn">⚡ Load Studio Preset</button>
        </div>
      `;

      card.querySelector('.play-demo-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.playGenreDemo(genre);
      });

      card.querySelector('.load-preset-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadGenrePresetIntoStudio(genre);
      });

      card.addEventListener('click', () => {
        this.selectedGenre = genre;
        this.render();
        this.showGenreDetails(genre);
      });

      grid.appendChild(card);
    });

    this.containerEl.appendChild(grid);
  }

  playGenreDemo(genre) {
    window.audioEngine.ensureContext().then(() => {
      const inst = window.instrumentManager.getInstrument(genre.primaryInstrumentId) || window.instrumentManager.currentInstrument;
      genre.demoNotes.forEach(item => {
        setTimeout(() => {
          const voice = window.soundFontManager.playNote(inst, item.note, 0.85);
          setTimeout(() => { if (voice) voice.stop(); }, item.dur);
        }, item.delay);
      });
    });
  }

  loadGenrePresetIntoStudio(genre) {
    if (window.trackManager) {
      window.trackManager.setBpm(genre.defaultBpm);
      window.trackManager.tracks = []; // Clear existing tracks
      genre.recommendedInstruments.slice(0, 4).forEach((instId, idx) => {
        window.trackManager.createTrack(instId);
      });
    }

    if (window.instrumentManager) {
      window.instrumentManager.selectInstrument(genre.primaryInstrumentId);
    }

    // Switch view to Studio
    if (window.app) {
      window.app.switchView('studio');
      window.app.showToast(`Loaded ${genre.name} Studio Preset (${genre.defaultBpm} BPM)`);
    }
  }

  showGenreDetails(genre) {
    const detailPanel = document.getElementById('genre-detail-panel');
    if (!detailPanel) return;

    detailPanel.innerHTML = `
      <div class="genre-detail-card">
        <h2>${genre.name} Music Deep-Dive</h2>
        <div class="period-subtitle">${genre.period} • Typical Tempo: ${genre.bpmRange}</div>
        <p class="full-desc">${genre.description}</p>
        <div class="theory-specs-grid">
          <div class="spec-col">
            <h4>Common Scales</h4>
            <ul>${genre.scales.map(s => `<li>${s}</li>`).join('')}</ul>
          </div>
          <div class="spec-col">
            <h4>Harmonic Progressions</h4>
            <ul>${genre.progressions.map(p => `<li>${p}</li>`).join('')}</ul>
          </div>
          <div class="spec-col">
            <h4>Rhythm & Articulation</h4>
            <p>${genre.rhythmStyle}</p>
          </div>
        </div>
        <div class="exercise-box">
          <h4>💡 Beginner Practice Exercise</h4>
          <p>${genre.practiceTask}</p>
        </div>
      </div>
    `;
  }
}

window.genreManager = new GenreManager();
