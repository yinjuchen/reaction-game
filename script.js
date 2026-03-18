/* ============================================================
   REFLEX — Game Logic
   State machine · Timing · DOM · Stats
   ============================================================ */

(() => {

  // ── Audio Engine (Web Audio API — no external files) ─────
  const Audio = (() => {
    let ctx = null;
    let muted = localStorage.getItem('reflex_muted') === 'true';

    function _ctx() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx;
    }

    // Core: play a tone with envelope
    function _tone({ freq = 440, type = 'sine', attack = 0.005, decay = 0.08, volume = 0.4 } = {}) {
      if (muted) return;
      try {
        const ac = _ctx();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ac.currentTime);
        gain.gain.setValueAtTime(0, ac.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ac.currentTime + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + attack + decay);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + attack + decay + 0.01);
      } catch (e) { }
    }

    function click() { _tone({ freq: 880, type: 'square', attack: 0.003, decay: 0.06, volume: 0.18 }); }
    function go() {
      _tone({ freq: 440, type: 'sine', attack: 0.005, decay: 0.06, volume: 0.3 });
      setTimeout(() => _tone({ freq: 660, type: 'sine', attack: 0.005, decay: 0.1, volume: 0.35 }), 60);
      setTimeout(() => _tone({ freq: 880, type: 'sine', attack: 0.005, decay: 0.18, volume: 0.4 }), 120);
    }
    function error() {
      _tone({ freq: 180, type: 'sawtooth', attack: 0.003, decay: 0.15, volume: 0.3 });
      setTimeout(() => _tone({ freq: 140, type: 'sawtooth', attack: 0.003, decay: 0.2, volume: 0.25 }), 80);
    }
    function result() {
      _tone({ freq: 523, type: 'sine', attack: 0.005, decay: 0.2, volume: 0.28 });
      setTimeout(() => _tone({ freq: 659, type: 'sine', attack: 0.005, decay: 0.25, volume: 0.22 }), 100);
      setTimeout(() => _tone({ freq: 784, type: 'sine', attack: 0.005, decay: 0.35, volume: 0.18 }), 200);
    }
    function gameOver() {
      [0, 100, 200, 350].forEach((t, i) => {
        const freqs = [523, 659, 784, 1047];
        setTimeout(() => _tone({ freq: freqs[i], type: 'sine', attack: 0.01, decay: 0.4, volume: 0.3 }), t);
      });
    }
    function newBest() {
      [0, 80, 160, 240, 360].forEach((t, i) => {
        const freqs = [659, 784, 880, 1047, 1319];
        setTimeout(() => _tone({ freq: freqs[i], type: 'sine', attack: 0.008, decay: 0.5, volume: 0.35 }), t);
      });
    }

    function toggleMute() {
      muted = !muted;
      try { localStorage.setItem('reflex_muted', muted); } catch (e) { }
      return muted;
    }

    function isMuted() { return muted; }

    return { click, go, error, result, gameOver, newBest, toggleMute, isMuted };
  })();

  // ── Game states ──────────────────────────────────────────
  const STATES = Object.freeze({
    IDLE: 'idle',
    WAITING: 'waiting',
    READY: 'ready',
    TOO_SOON: 'tooSoon',
    RESULT: 'result',
    GAME_OVER: 'gameOver',
  });

  const TOTAL_ROUNDS = 5;
  const STORAGE_KEY = 'reflex_alltime_best';

  // ── Storage helpers ───────────────────────────────────────
  const Store = {
    getBest() {
      try {
        const val = localStorage.getItem(STORAGE_KEY);
        return val ? parseInt(val, 10) : null;
      } catch (e) { return null; }
    },
    setBest(ms) {
      try { localStorage.setItem(STORAGE_KEY, ms); } catch (e) { }
    },
    clearBest() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }
    },
  };

  // ── Session variables ─────────────────────────────────────
  let gameState = STATES.IDLE;
  let signalTime = 0;
  let waitTimer = null;
  let history = [];
  let roundCount = 0;
  let allTimeBest = Store.getBest(); // loaded from localStorage on boot

  // ── DOM refs ──────────────────────────────────────────────
  const stateBlocks = {
    idle: document.getElementById('state-idle'),
    waiting: document.getElementById('state-waiting'),
    ready: document.getElementById('state-ready'),
    tooSoon: document.getElementById('state-tooSoon'),
    result: document.getElementById('state-result'),
    gameOver: document.getElementById('state-gameover'),
  };

  // Buttons
  const btnStart = document.getElementById('btn-start');
  const btnClickWaiting = document.getElementById('btn-click-waiting');
  const btnClickReady = document.getElementById('btn-click-ready');
  const btnRetrySoon = document.getElementById('btn-retry-soon');
  const btnRetryResult = document.getElementById('btn-retry-result');
  const btnPlayAgain = document.getElementById('btn-play-again');

  // Result display
  const elResultMs = document.getElementById('result-ms');
  const elResultRating = document.getElementById('result-rating');
  const elStatBest = document.getElementById('stat-best');
  const elStatAvg = document.getElementById('stat-avg');
  const elStatRounds = document.getElementById('stat-rounds');

  // Game over display
  const elGoBest = document.getElementById('go-best');
  const elGoAvg = document.getElementById('go-avg');
  const elGoRating = document.getElementById('go-rating');
  const elGoHistory = document.getElementById('go-history');

  // Session strip
  const elSBest = document.getElementById('s-best');
  const elSAvg = document.getElementById('s-avg');
  const elSRuns = document.getElementById('s-runs');
  const elSAllTime = document.getElementById('s-alltime');

  // History
  const elHistoryList = document.getElementById('history-list');

  // Game over all-time
  const elGoAllTime = document.getElementById('go-alltime');
  const elGoNewBest = document.getElementById('go-newbest');

  // Canvas
  const canvas = document.getElementById('three-canvas');

  // Indicator dot
  const indicatorDot = document.getElementById('indicator-dot');
  const indicatorLabel = document.getElementById('indicator-label');

  const DOT_CONFIG = {
    idle: { cls: '', label: 'STANDBY' },
    waiting: { cls: 'active-wait', label: 'WAITING…' },
    ready: { cls: 'active-ready', label: 'GO!' },
    tooSoon: { cls: 'active-error', label: 'FALSE START' },
    result: { cls: 'active-result', label: 'RESULT' },
    gameOver: { cls: 'active-result', label: 'GAME OVER' },
  };

  // ── Mute toggle ───────────────────────────────────────────
  const btnMute = document.getElementById('btn-mute');

  function _updateMuteBtn() {
    btnMute.textContent = Audio.isMuted() ? '🔇' : '🔊';
    btnMute.title = Audio.isMuted() ? 'Unmute' : 'Mute';
    btnMute.classList.toggle('muted', Audio.isMuted());
  }

  btnMute.addEventListener('click', () => {
    Audio.toggleMute();
    _updateMuteBtn();
  });

  // Set correct icon on load
  _updateMuteBtn();

  // ── Modal (instructions) ──────────────────────────────────
  const modalBackdrop = document.getElementById('modal-backdrop');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnHelp = document.getElementById('btn-help');

  function openModal() {
    modalBackdrop.classList.remove('hidden');
  }

  function closeModal() {
    Audio.click();
    modalBackdrop.classList.add('hidden');
  }

  btnModalClose.addEventListener('click', closeModal);
  btnHelp.addEventListener('click', openModal);

  // Close on backdrop click (outside modal box)
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Show modal on page load
  openModal();

  // ── Init Three.js ─────────────────────────────────────────
  ThreeScene.init(canvas);

  // ── State machine ─────────────────────────────────────────
  function transitionTo(newState) {
    gameState = newState;

    // Show/hide blocks
    Object.values(stateBlocks).forEach(b => b.classList.add('hidden'));
    stateBlocks[newState].classList.remove('hidden');

    // Update indicator
    const cfg = DOT_CONFIG[newState] || DOT_CONFIG.idle;
    indicatorDot.className = 'dot ' + cfg.cls;
    indicatorLabel.textContent = cfg.label;

    // Notify Three.js scene
    ThreeScene.setState(newState);
  }

  // ── Game actions ──────────────────────────────────────────

  /** Idle → Waiting: start the random countdown */
  function startGame() {
    Audio.click();
    transitionTo(STATES.WAITING);
    const delay = 1000 + Math.random() * 4000;
    waitTimer = setTimeout(() => {
      signalTime = performance.now();
      Audio.go();
      transitionTo(STATES.READY);
    }, delay);
  }

  /** Waiting → Too Soon: clicked before the signal */
  function registerTooSoon() {
    clearTimeout(waitTimer);
    waitTimer = null;
    Audio.error();
    transitionTo(STATES.TOO_SOON);
  }

  /** Ready → Result or Game Over */
  function registerReaction() {
    const reactionMs = Math.round(performance.now() - signalTime);
    Audio.click();
    history.push(reactionMs);
    roundCount++;
    _updateStats(reactionMs);
    setTimeout(() => {
      if (roundCount >= TOTAL_ROUNDS) {
        Audio.gameOver();
        _showGameOver();
      } else {
        Audio.result();
      }
    }, 80);
    transitionTo(STATES.RESULT);
  }

  /** Show game over after delay */
  function _showGameOver() {
    setTimeout(() => {
      const best = Math.min(...history);
      const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);

      // Check if new all-time best
      const isNewBest = allTimeBest === null || best < allTimeBest;
      if (isNewBest) {
        allTimeBest = best;
        Store.setBest(best);
      }

      elGoBest.textContent = best + 'ms';
      elGoAvg.textContent = avg + 'ms';
      elGoRating.textContent = _getRating(avg);
      elGoAllTime.textContent = allTimeBest + 'ms';

      // Show/hide new best banner
      if (isNewBest) {
        elGoNewBest.classList.remove('hidden');
        Audio.newBest();
      } else {
        elGoNewBest.classList.add('hidden');
      }

      // Render all chips in game over history
      let bestMarked = false;
      elGoHistory.innerHTML = history.map((ms) => {
        const isBest = ms === best && !bestMarked && (bestMarked = true);
        return `<span class="chip${isBest ? ' best' : ''}">${ms}ms</span>`;
      }).join('');

      transitionTo(STATES.GAME_OVER);
    }, 1800);
  }

  /** Full reset — clears session history and round count */
  function resetGame() {
    clearTimeout(waitTimer);
    waitTimer = null;
    history = [];
    roundCount = 0;
    elSBest.textContent = '—';
    elSAvg.textContent = '—';
    elSRuns.textContent = '0';
    elSAllTime.textContent = allTimeBest !== null ? allTimeBest + 'ms' : '—';
    elHistoryList.innerHTML = '<span class="history-empty">No runs yet</span>';
    transitionTo(STATES.IDLE);
  }

  // ── Stats & history ───────────────────────────────────────
  function _updateStats(latestMs) {
    const best = Math.min(...history);
    const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);

    // Result block
    elResultMs.textContent = latestMs;
    elResultRating.textContent = _getRating(latestMs);
    elStatBest.textContent = best + 'ms';
    elStatAvg.textContent = avg + 'ms';
    elStatRounds.textContent = roundCount + ' / ' + TOTAL_ROUNDS;

    // Session strip
    elSBest.textContent = best + 'ms';
    elSAvg.textContent = avg + 'ms';
    elSRuns.textContent = roundCount + ' / ' + TOTAL_ROUNDS;
    elSAllTime.textContent = allTimeBest !== null ? allTimeBest + 'ms' : '—';

    // History chips
    _renderHistory(latestMs, best);
  }

  function _getRating(ms) {
    if (ms < 130) return '⚡ SUPERHUMAN';
    if (ms < 170) return '🔥 LEGENDARY';
    if (ms < 220) return '✦ ELITE';
    if (ms < 270) return '◆ EXCELLENT';
    if (ms < 330) return '◇ ABOVE AVERAGE';
    if (ms < 420) return '▷ AVERAGE';
    return '▽ KEEP TRAINING';
  }

  function _renderHistory(latestMs, best) {
    if (!history.length) {
      elHistoryList.innerHTML = '<span class="history-empty">No runs yet</span>';
      return;
    }

    let bestMarked = false;

    elHistoryList.innerHTML = history.map((ms, i) => {
      const isLatest = i === history.length - 1;
      const isBest = ms === best && !bestMarked && !(bestMarked = true) === false;
      // mark first occurrence of best value
      let cls = 'chip';
      if (isBest) cls += ' best';
      if (isLatest && !isBest) cls += ' latest';
      return `<span class="${cls}">${ms}ms</span>`;
    }).join('');
  }

  // ── Event listeners ───────────────────────────────────────
  btnStart.addEventListener('click', () => {
    if (gameState === STATES.IDLE) startGame();
  });

  btnClickWaiting.addEventListener('click', () => {
    if (gameState === STATES.WAITING) registerTooSoon();
  });

  btnClickReady.addEventListener('click', () => {
    if (gameState === STATES.READY) registerReaction();
  });

  btnRetrySoon.addEventListener('click', () => {
    if (gameState === STATES.TOO_SOON) { Audio.click(); startGame(); }
  });

  btnRetryResult.addEventListener('click', () => {
    if (gameState === STATES.RESULT && roundCount < TOTAL_ROUNDS) startGame();
  });

  btnPlayAgain.addEventListener('click', () => {
    if (gameState === STATES.GAME_OVER) { Audio.click(); resetGame(); }
  });

  // Canvas click also acts as a reaction surface
  canvas.addEventListener('click', () => {
    if (gameState === STATES.WAITING) registerTooSoon();
    else if (gameState === STATES.READY) registerReaction();
  });

  // Spacebar shortcut
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (gameState === STATES.IDLE) startGame();
    else if (gameState === STATES.WAITING) registerTooSoon();
    else if (gameState === STATES.READY) registerReaction();
    else if (gameState === STATES.TOO_SOON) { Audio.click(); startGame(); }
    else if (gameState === STATES.RESULT && roundCount < TOTAL_ROUNDS) startGame();
    else if (gameState === STATES.GAME_OVER) { Audio.click(); resetGame(); }
  });

  // ── Boot ──────────────────────────────────────────────────
  transitionTo(STATES.IDLE);

})();
