/**
 * Virtual Music Studio - 24 Instrument Catalog & Detailed Profiles
 * Defines metadata, GM MIDI mappings, WebAudioFont references, physical timbre models, and visual assets.
 */

const INSTRUMENT_FAMILIES = {
  PIANO: 'Piano Family',
  KEYBOARDS: 'Other Keyboards',
  STRINGS: 'String Instruments',
  MALLETS: 'Percussion & Mallets',
  WINDS: 'Wind & Brass'
};

const INSTRUMENTS_CATALOG = [
  // ==================== PIANO FAMILY ====================
  {
    id: 'classical_piano',
    name: 'Classical Piano',
    family: INSTRUMENT_FAMILIES.PIANO,
    familyId: 'piano',
    gmProgram: 0,
    soundfontVar: '_tone_0000_JCLive_sf2_file',
    soundfontFile: '0000_JCLive_sf2_file.js',
    description: 'Rich, dynamic concert piano with natural acoustic resonance and nuanced harmonic decay.',
    range: [21, 108], // A0 to C8
    defaultOctave: 4,
    timbre: {
      attack: 0.005,
      decay: 2.8,
      sustain: 0.05,
      release: 0.6,
      harmonics: [1.0, 0.6, 0.35, 0.2, 0.1, 0.05],
      filterType: 'lowpass',
      cutoff: 7500,
      brightness: 1.0,
      damping: 0.8
    },
    attribution: 'GeneralUser GS / FluidR3 soundbank (Public Domain / MIT License)',
    badgeColor: '#8B5CF6'
  },
  {
    id: 'grand_classical_piano',
    name: 'Grand Classical Piano',
    family: INSTRUMENT_FAMILIES.PIANO,
    familyId: 'piano',
    gmProgram: 1,
    soundfontVar: '_tone_0010_JCLive_sf2_file',
    soundfontFile: '0010_JCLive_sf2_file.js',
    description: 'Expansive 9-foot concert grand piano delivering brilliant highs, thunderous bass, and long sustain.',
    range: [21, 108],
    defaultOctave: 4,
    timbre: {
      attack: 0.004,
      decay: 3.5,
      sustain: 0.12,
      release: 0.85,
      harmonics: [1.0, 0.75, 0.45, 0.28, 0.18, 0.08, 0.04],
      filterType: 'lowpass',
      cutoff: 10000,
      brightness: 1.25,
      damping: 0.7
    },
    attribution: 'Yamaha C7 Soundfont recordings, FluidR3 Open Source',
    badgeColor: '#A78BFA'
  },
  {
    id: 'upright_piano',
    name: 'Upright Piano',
    family: INSTRUMENT_FAMILIES.PIANO,
    familyId: 'piano',
    gmProgram: 3,
    soundfontVar: '_tone_0030_JCLive_sf2_file',
    soundfontFile: '0030_JCLive_sf2_file.js',
    description: 'Warm, intimate acoustic upright piano with organic hammer thuds and cozy room resonance.',
    range: [21, 108],
    defaultOctave: 4,
    timbre: {
      attack: 0.007,
      decay: 2.2,
      sustain: 0.04,
      release: 0.45,
      harmonics: [1.0, 0.5, 0.25, 0.12, 0.06],
      filterType: 'lowpass',
      cutoff: 5500,
      brightness: 0.85,
      damping: 0.9
    },
    attribution: 'Vintage Felt Upright, Chaos Soundfont (Creative Commons 0)',
    badgeColor: '#C4B5FD'
  },
  {
    id: 'auditorium_piano',
    name: 'Auditorium Piano',
    family: INSTRUMENT_FAMILIES.PIANO,
    familyId: 'piano',
    gmProgram: 0,
    soundfontVar: '_tone_0000_JCLive_sf2_file',
    soundfontFile: '0000_JCLive_sf2_file.js',
    description: 'Immersive concert hall piano with built-in cathedral reverberation and warm cinematic tail.',
    range: [21, 108],
    defaultOctave: 4,
    timbre: {
      attack: 0.008,
      decay: 4.2,
      sustain: 0.2,
      release: 1.4,
      harmonics: [1.0, 0.65, 0.4, 0.25, 0.15, 0.09],
      filterType: 'lowpass',
      cutoff: 8200,
      brightness: 1.1,
      damping: 0.6,
      auditoriumReverb: 0.48
    },
    attribution: 'Symphonic Auditorium Grand Soundbank (FluidR3)',
    badgeColor: '#7C3AED'
  },
  {
    id: 'stage_piano',
    name: 'Stage Piano',
    family: INSTRUMENT_FAMILIES.PIANO,
    familyId: 'piano',
    gmProgram: 4,
    soundfontVar: '_tone_0040_JCLive_sf2_file',
    soundfontFile: '0040_JCLive_sf2_file.js',
    description: 'Electrified vintage stage piano with smooth bell-like tines, chorused warmth, and soulful tone.',
    range: [28, 103],
    defaultOctave: 4,
    timbre: {
      attack: 0.003,
      decay: 2.4,
      sustain: 0.15,
      release: 0.5,
      harmonics: [1.0, 0.2, 0.8, 0.05, 0.3, 0.02, 0.1],
      filterType: 'lowpass',
      cutoff: 6200,
      brightness: 1.15,
      damping: 0.75,
      isElectric: true
    },
    attribution: 'Fender Rhodes Mark I Soundbank (CC-BY 3.0)',
    badgeColor: '#6366F1'
  },
  {
    id: 'jazz_piano',
    name: 'Jazz Piano',
    family: INSTRUMENT_FAMILIES.PIANO,
    familyId: 'piano',
    gmProgram: 2,
    soundfontVar: '_tone_0020_JCLive_sf2_file',
    soundfontFile: '0020_JCLive_sf2_file.js',
    description: 'Crisp, articulate acoustic piano voiced for fast bebop runs, complex chords, and syncopated comps.',
    range: [21, 108],
    defaultOctave: 4,
    timbre: {
      attack: 0.004,
      decay: 2.0,
      sustain: 0.06,
      release: 0.4,
      harmonics: [1.0, 0.8, 0.5, 0.35, 0.2, 0.1],
      filterType: 'bandpass',
      cutoff: 4200,
      brightness: 1.3,
      damping: 0.85
    },
    attribution: 'Blue Note Jazz Studio Soundfont (FluidR3)',
    badgeColor: '#4F46E5'
  },

  // ==================== OTHER KEYBOARD INSTRUMENTS ====================
  {
    id: 'organ',
    name: 'Organ',
    family: INSTRUMENT_FAMILIES.KEYBOARDS,
    familyId: 'keyboards',
    gmProgram: 19,
    soundfontVar: '_tone_0190_JCLive_sf2_file',
    soundfontFile: '0190_JCLive_sf2_file.js',
    description: 'Majestic church pipe organ and drawbar tonewheels with continuous sustain and harmonic richness.',
    range: [24, 96],
    defaultOctave: 3,
    timbre: {
      attack: 0.04,
      decay: 0.1,
      sustain: 0.95,
      release: 0.35,
      harmonics: [1.0, 0.8, 0.7, 0.65, 0.5, 0.4, 0.3, 0.2],
      filterType: 'lowpass',
      cutoff: 6500,
      continuous: true
    },
    attribution: 'St. Michael Pipe Organ Soundfont (Public Domain)',
    badgeColor: '#D97706'
  },
  {
    id: 'accordion',
    name: 'Accordion',
    family: INSTRUMENT_FAMILIES.KEYBOARDS,
    familyId: 'keyboards',
    gmProgram: 21,
    soundfontVar: '_tone_0210_JCLive_sf2_file',
    soundfontFile: '0210_JCLive_sf2_file.js',
    description: 'Expressive bellow-driven reed instrument with distinctive dual-reed tremolo and Parisian folk charm.',
    range: [36, 96],
    defaultOctave: 4,
    timbre: {
      attack: 0.05,
      decay: 0.1,
      sustain: 0.9,
      release: 0.25,
      harmonics: [1.0, 0.4, 0.8, 0.3, 0.6, 0.2, 0.4],
      filterType: 'bandpass',
      cutoff: 3800,
      continuous: true,
      reedDetune: 4
    },
    attribution: 'Castagnari Bellows Soundfont (CC-BY)',
    badgeColor: '#EA580C'
  },

  // ==================== STRING INSTRUMENTS ====================
  {
    id: 'classical_guitar',
    name: 'Classical Guitar',
    family: INSTRUMENT_FAMILIES.STRINGS,
    familyId: 'strings',
    gmProgram: 24,
    soundfontVar: '_tone_0240_JCLive_sf2_file',
    soundfontFile: '0240_JCLive_sf2_file.js',
    description: 'Mellow nylon-string guitar with round fingertip attacks, warm midrange body, and melodic delicacy.',
    range: [40, 88], // E2 to E6
    defaultOctave: 3,
    timbre: {
      attack: 0.008,
      decay: 2.1,
      sustain: 0.02,
      release: 0.45,
      harmonics: [1.0, 0.6, 0.3, 0.15, 0.08, 0.03],
      filterType: 'lowpass',
      cutoff: 4200,
      damping: 0.9
    },
    attribution: 'Ramirez Classical Guitar (FluidR3 Open Source)',
    badgeColor: '#10B981'
  },
  {
    id: 'flamenco_guitar',
    name: 'Flamenco Guitar',
    family: INSTRUMENT_FAMILIES.STRINGS,
    familyId: 'strings',
    gmProgram: 25,
    soundfontVar: '_tone_0250_JCLive_sf2_file',
    soundfontFile: '0250_JCLive_sf2_file.js',
    description: 'Crisp Spanish cypress guitar with snappier percussive rasgueado attack and fiery Andalusian presence.',
    range: [40, 88],
    defaultOctave: 3,
    timbre: {
      attack: 0.004,
      decay: 1.6,
      sustain: 0.01,
      release: 0.35,
      harmonics: [1.0, 0.85, 0.55, 0.38, 0.22, 0.12, 0.05],
      filterType: 'highpass',
      cutoff: 180,
      damping: 0.92,
      brightness: 1.3
    },
    attribution: 'Hermanos Conde Flamenco Blanca (Open Soundbank)',
    badgeColor: '#059669'
  },
  {
    id: 'harp',
    name: 'Harp',
    family: INSTRUMENT_FAMILIES.STRINGS,
    familyId: 'strings',
    gmProgram: 46,
    soundfontVar: '_tone_0460_JCLive_sf2_file',
    soundfontFile: '0460_JCLive_sf2_file.js',
    description: 'Ethereal concert pedal harp with crystalline plucked attacks and shimmering celestial ring.',
    range: [23, 103],
    defaultOctave: 4,
    timbre: {
      attack: 0.006,
      decay: 3.8,
      sustain: 0.08,
      release: 1.1,
      harmonics: [1.0, 0.7, 0.35, 0.18, 0.09, 0.04],
      filterType: 'lowpass',
      cutoff: 6800,
      damping: 0.7
    },
    attribution: 'Salvi Concert Grand Harp (FluidR3)',
    badgeColor: '#14B8A6'
  },
  {
    id: 'violin',
    name: 'Violin',
    family: INSTRUMENT_FAMILIES.STRINGS,
    familyId: 'strings',
    gmProgram: 40,
    soundfontVar: '_tone_0400_JCLive_sf2_file',
    soundfontFile: '0400_JCLive_sf2_file.js',
    description: 'Lyrical bowed solo violin with rich string friction, continuous sustain, and sweet expressive vibrato.',
    range: [55, 103], // G3 to G7
    defaultOctave: 4,
    timbre: {
      attack: 0.08,
      decay: 0.2,
      sustain: 0.92,
      release: 0.35,
      harmonics: [1.0, 0.9, 0.75, 0.6, 0.5, 0.35, 0.25, 0.15],
      filterType: 'bandpass',
      cutoff: 3200,
      continuous: true,
      vibratoRate: 5.5,
      vibratoDepth: 6
    },
    attribution: 'Stradivarius Solo Violin Soundfont (Open Sample Project)',
    badgeColor: '#06B6D4'
  },
  {
    id: 'double_bass',
    name: 'Double Bass',
    family: INSTRUMENT_FAMILIES.STRINGS,
    familyId: 'strings',
    gmProgram: 32,
    soundfontVar: '_tone_0320_JCLive_sf2_file',
    soundfontFile: '0320_JCLive_sf2_file.js',
    description: 'Deep, resonant orchestral upright bass with immense low-end punch, pizzicato pluck, and woody body.',
    range: [28, 67], // E1 to G4
    defaultOctave: 2,
    timbre: {
      attack: 0.015,
      decay: 2.2,
      sustain: 0.03,
      release: 0.45,
      harmonics: [1.0, 0.8, 0.4, 0.2, 0.08, 0.03],
      filterType: 'lowpass',
      cutoff: 1800,
      damping: 0.85
    },
    attribution: 'German Double Bass (GeneralUser GS)',
    badgeColor: '#0284C7'
  },
  {
    id: 'sitar',
    name: 'Sitar',
    family: INSTRUMENT_FAMILIES.STRINGS,
    familyId: 'strings',
    gmProgram: 104,
    soundfontVar: '_tone_1040_JCLive_sf2_file',
    soundfontFile: '1040_JCLive_sf2_file.js',
    description: 'Legendary Indian classical lute featuring the buzzing jawari bridge and sympathetic tarafdar resonance.',
    range: [36, 88],
    defaultOctave: 3,
    timbre: {
      attack: 0.005,
      decay: 2.5,
      sustain: 0.1,
      release: 0.75,
      harmonics: [1.0, 0.95, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2],
      filterType: 'highpass',
      cutoff: 280,
      jawariBuzz: true,
      damping: 0.78
    },
    attribution: 'Ravi Shankar Style Ravi-Kolkata Sitar (CC0)',
    badgeColor: '#3B82F6'
  },
  {
    id: 'oud',
    name: 'Oud',
    family: INSTRUMENT_FAMILIES.STRINGS,
    familyId: 'strings',
    gmProgram: 105,
    soundfontVar: '_tone_1050_JCLive_sf2_file',
    soundfontFile: '1050_JCLive_sf2_file.js',
    description: 'Fretless pear-shaped Middle Eastern lute with deep bowl resonance, microtonal flexibility, and warm risha strike.',
    range: [36, 79],
    defaultOctave: 3,
    timbre: {
      attack: 0.007,
      decay: 1.8,
      sustain: 0.02,
      release: 0.4,
      harmonics: [1.0, 0.75, 0.4, 0.22, 0.1, 0.04],
      filterType: 'lowpass',
      cutoff: 3400,
      damping: 0.9
    },
    attribution: 'Arabic Nahat Oud (Creative Commons Soundfont Archive)',
    badgeColor: '#2563EB'
  },
  {
    id: 'koto',
    name: 'Koto',
    family: INSTRUMENT_FAMILIES.STRINGS,
    familyId: 'strings',
    gmProgram: 107,
    soundfontVar: '_tone_1070_JCLive_sf2_file',
    soundfontFile: '1070_JCLive_sf2_file.js',
    description: 'Traditional 13-string Japanese paulownia zither with crisp ivory plectrum snap and tranquil Eastern harmonics.',
    range: [48, 88],
    defaultOctave: 4,
    timbre: {
      attack: 0.003,
      decay: 2.2,
      sustain: 0.04,
      release: 0.6,
      harmonics: [1.0, 0.8, 0.5, 0.3, 0.15, 0.06],
      filterType: 'bandpass',
      cutoff: 4000,
      damping: 0.88
    },
    attribution: 'Kyoto Imperial Koto (Japanese Traditional Archive)',
    badgeColor: '#1D4ED8'
  },

  // ==================== PERCUSSION AND MALLET INSTRUMENTS ====================
  {
    id: 'glockenspiel',
    name: 'Glockenspiel',
    family: INSTRUMENT_FAMILIES.MALLETS,
    familyId: 'mallets',
    gmProgram: 9,
    soundfontVar: '_tone_0090_JCLive_sf2_file',
    soundfontFile: '0090_JCLive_sf2_file.js',
    description: 'Tuned metal bar percussion producing bright, pure crystalline bell tones that cut effortlessly through any mix.',
    range: [60, 108],
    defaultOctave: 5,
    timbre: {
      attack: 0.002,
      decay: 3.0,
      sustain: 0.08,
      release: 0.8,
      harmonics: [1.0, 0.05, 0.9, 0.02, 0.4],
      filterType: 'highpass',
      cutoff: 1200,
      damping: 0.6
    },
    attribution: 'Orchestral Tuned Glockenspiel (FluidR3)',
    badgeColor: '#EC4899'
  },
  {
    id: 'mixed_percussion',
    name: 'Mixed Percussion',
    family: INSTRUMENT_FAMILIES.MALLETS,
    familyId: 'mallets',
    gmProgram: 115,
    soundfontVar: '_tone_1150_JCLive_sf2_file',
    soundfontFile: '1150_JCLive_sf2_file.js',
    description: 'Dynamic ensemble percussion kit spanning orchestral woodblocks, triangles, timbales, congas, and taikos.',
    range: [35, 81],
    defaultOctave: 3,
    timbre: {
      attack: 0.001,
      decay: 0.6,
      sustain: 0.0,
      release: 0.3,
      harmonics: [1.0, 0.7, 0.5, 0.3, 0.2],
      filterType: 'bandpass',
      cutoff: 2200,
      isPercussive: true
    },
    attribution: 'World & Orchestral Percussion (FluidR3 GS)',
    badgeColor: '#F43F5E'
  },
  {
    id: 'steel_pan',
    name: 'Steel Pan',
    family: INSTRUMENT_FAMILIES.MALLETS,
    familyId: 'mallets',
    gmProgram: 114,
    soundfontVar: '_tone_1140_JCLive_sf2_file',
    soundfontFile: '1140_JCLive_sf2_file.js',
    description: 'Sun-drenched Trinidadian steel drum with bouncy metallic resonance and vibrant tropical carnival character.',
    range: [48, 84],
    defaultOctave: 4,
    timbre: {
      attack: 0.003,
      decay: 1.8,
      sustain: 0.03,
      release: 0.5,
      harmonics: [1.0, 0.4, 0.85, 0.1, 0.45, 0.05],
      filterType: 'peaking',
      cutoff: 3600,
      damping: 0.8
    },
    attribution: 'Trinidad Tenor Steel Pan (CC0)',
    badgeColor: '#E11D48'
  },

  // ==================== WIND AND BRASS INSTRUMENTS ====================
  {
    id: 'pan_flute',
    name: 'Pan Flute',
    family: INSTRUMENT_FAMILIES.WINDS,
    familyId: 'winds',
    gmProgram: 75,
    soundfontVar: '_tone_0750_JCLive_sf2_file',
    soundfontFile: '0750_JCLive_sf2_file.js',
    description: 'Ancient bamboo cane pipes producing breathy chiff, haunting Andean overtones, and peaceful acoustic purity.',
    range: [60, 96],
    defaultOctave: 4,
    timbre: {
      attack: 0.06,
      decay: 0.1,
      sustain: 0.88,
      release: 0.25,
      harmonics: [1.0, 0.15, 0.5, 0.05, 0.2],
      filterType: 'lowpass',
      cutoff: 4500,
      continuous: true,
      breathNoise: 0.12
    },
    attribution: 'Andean Zampoña Pan Flute (Creative Commons)',
    badgeColor: '#F59E0B'
  },
  {
    id: 'saxophone',
    name: 'Saxophone',
    family: INSTRUMENT_FAMILIES.WINDS,
    familyId: 'winds',
    gmProgram: 65,
    soundfontVar: '_tone_0650_JCLive_sf2_file',
    soundfontFile: '0650_JCLive_sf2_file.js',
    description: 'Sultry alto saxophone with husky reed bite, warm brass body, dynamic growl, and expressive bending capacity.',
    range: [46, 89],
    defaultOctave: 4,
    timbre: {
      attack: 0.04,
      decay: 0.1,
      sustain: 0.9,
      release: 0.22,
      harmonics: [1.0, 0.7, 0.8, 0.4, 0.5, 0.3, 0.15],
      filterType: 'bandpass',
      cutoff: 2800,
      continuous: true,
      vibratoRate: 5.2,
      vibratoDepth: 8
    },
    attribution: 'Selmer Mark VI Alto Saxophone (GeneralUser GS)',
    badgeColor: '#D97706'
  },
  {
    id: 'clarinet',
    name: 'Clarinet',
    family: INSTRUMENT_FAMILIES.WINDS,
    familyId: 'winds',
    gmProgram: 71,
    soundfontVar: '_tone_0710_JCLive_sf2_file',
    soundfontFile: '0710_JCLive_sf2_file.js',
    description: 'Smooth, woody cylindrical single-reed instrument renowned for hollow chalumeau low notes and sparkling clarion highs.',
    range: [50, 96],
    defaultOctave: 4,
    timbre: {
      attack: 0.035,
      decay: 0.12,
      sustain: 0.92,
      release: 0.2,
      // Cylindrical pipe: strong odd harmonics
      harmonics: [1.0, 0.08, 0.75, 0.06, 0.45, 0.03, 0.2],
      filterType: 'lowpass',
      cutoff: 4200,
      continuous: true
    },
    attribution: 'Buffet Crampon Bb Clarinet (FluidR3 Open Source)',
    badgeColor: '#B45309'
  },
  {
    id: 'oboe',
    name: 'Oboe',
    family: INSTRUMENT_FAMILIES.WINDS,
    familyId: 'winds',
    gmProgram: 68,
    soundfontVar: '_tone_0680_JCLive_sf2_file',
    soundfontFile: '0680_JCLive_sf2_file.js',
    description: 'Piercing, plaintive double-reed woodwind with nasal harmonic brilliance and profound emotional resonance.',
    range: [58, 91],
    defaultOctave: 4,
    timbre: {
      attack: 0.03,
      decay: 0.1,
      sustain: 0.9,
      release: 0.22,
      harmonics: [1.0, 0.9, 0.8, 0.7, 0.6, 0.45, 0.3],
      filterType: 'peaking',
      cutoff: 2200,
      continuous: true,
      vibratoRate: 6.0,
      vibratoDepth: 7
    },
    attribution: 'Orchestral French Oboe Soundfont (FluidR3)',
    badgeColor: '#92400E'
  },
  {
    id: 'brass_ensemble',
    name: 'Brass Ensemble',
    family: INSTRUMENT_FAMILIES.WINDS,
    familyId: 'winds',
    gmProgram: 61,
    soundfontVar: '_tone_0610_JCLive_sf2_file',
    soundfontFile: '0610_JCLive_sf2_file.js',
    description: 'Monumental symphonic brass section combining French horns, trumpets, trombones, and tubas in cinematic fanfare.',
    range: [36, 88],
    defaultOctave: 3,
    timbre: {
      attack: 0.06,
      decay: 0.15,
      sustain: 0.95,
      release: 0.4,
      harmonics: [1.0, 0.85, 0.75, 0.65, 0.5, 0.35, 0.2],
      filterType: 'lowpass',
      cutoff: 3500,
      continuous: true,
      brassFilterSweep: true
    },
    attribution: 'Epic Hollywood Brass Section (Chaos GM Soundfont)',
    badgeColor: '#78350F'
  }
];

if (typeof window !== 'undefined') {
  window.INSTRUMENT_FAMILIES = INSTRUMENT_FAMILIES;
  window.INSTRUMENTS_CATALOG = INSTRUMENTS_CATALOG;
}
