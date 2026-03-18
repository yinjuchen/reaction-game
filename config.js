/* ============================================================
   REFLEX — Game Configuration
   Central difficulty constants and game settings
   ============================================================ */

const CONFIG = Object.freeze({

  difficulties: {
    easy: {
      label: 'EASY',
      delayMin: 2000,   // ms minimum wait before GO signal
      delayMax: 6000,   // ms maximum wait before GO signal
      color: '#10B981',
      description: 'Longer delay · Great for beginners',
    },
    normal: {
      label: 'NORMAL',
      delayMin: 1000,
      delayMax: 5000,
      color: '#3B82F6',
      description: 'Standard delay · The classic test',
    },
    hard: {
      label: 'HARD',
      delayMin: 500,
      delayMax: 3000,
      color: '#EF4444',
      description: 'Shorter delay · Expect false starts',
    },
  },

  totalRounds: 5,

  storageKeys: {
    allTimeBest: 'reflex_alltime_best',
    muted: 'reflex_muted',
    colorblind: 'reflex_cb',
    difficulty: 'reflex_difficulty',
  },

});