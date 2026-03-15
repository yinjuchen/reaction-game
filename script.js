/* ============================================================
   REFLEX — Game Logic
   State machine · Timing · DOM · Stats
   ============================================================ */

(() => {
  // ── State ──────────────────────────────────────────────────
  const STATES = Object.freeze({
    IDLE: 'idle',
    WAITING: 'waiting',
    READY: 'ready',
    TOO_SOON: 'tooSoon',
    RESULT: 'result',
  });

  let gameState = STATES.IDLE;
  let signalTime = 0;          // performance.now() when GO appeared
  let waitTimer = null;       // setTimeout handle
  let history = [];         // ms results for this session

  // ── DOM refs ────────────────────────────────────────────────
  const blocks = {
    idle: document.getElementById('state-idle'),
    waiting: document.getElementById('state-waiting'),
    ready: document.getElementById('state-ready'),
    tooSoon: document.getElementById('state-tooSoon'),
    result: document.getElementById('state-result'),
  };

  const btnStart = document.getElementById('btn-start');
  const btnClickWaiting = document.getElementById('btn-click-waiting');
  const btnClickReady = document.getElementById('btn-click-ready');
  const btnRetrySoon = document.getElementById('btn-retry-soon');
  const btnRetryResult = document.getElementById('btn-retry-result');

  const elResultMs = document.getElementById('result-ms');
  const elResultRating = document.getElementById('result-rating');
  const elStatBest = document.getElementById('stat-best');
  const elStatAvg = document.getElementById('stat-avg');
  const elStatRounds = document.getElementById('stat-rounds');
  const elHistoryList = document.getElementById('history-list');

  // ── Init Three.js ───────────────────────────────────────────
  const canvas = document.getElementById('three-canvas');
  ThreeScene.init(canvas);

  // ── State Machine ───────────────────────────────────────────
  function transitionTo(newState) {
    gameState = newState;

    // Hide all blocks, show the target one
    Object.values(blocks).forEach(b => b.classList.add('hidden'));
    blocks[newState].classList.remove('hidden');

    // Tell Three.js scene about the new state
    ThreeScene.setState(newState);
  }

  // ── Game Actions ────────────────────────────────────────────

  /** Idle → Waiting */
  function startGame() {
    transitionTo(STATES.WAITING);

    // Pick a random delay between 2s and 5s
    const delay = 2000 + Math.random() * 3000;
    waitTimer = setTimeout(showReadySignal, delay);
  }

  /** Waiting → Ready: show GO signal and record timestamp */
  function showReadySignal() {
    signalTime = performance.now();
    transitionTo(STATES.READY);
  }

  /** Waiting → Too Soon: user clicked before signal */
  function registerTooSoon() {
    clearTimeout(waitTimer);
    waitTimer = null;
    transitionTo(STATES.TOO_SOON);
  }

  /** Ready → Result: user clicked after signal */
  function registerReaction() {
    const clickTime = performance.now();
    const reactionTime = Math.round(clickTime - signalTime);

    history.push(reactionTime);
    _updateStats(reactionTime);
    transitionTo(STATES.RESULT);
  }

  /** Any terminal state → Idle */
  function resetGame() {
    clearTimeout(waitTimer);
    waitTimer = null;
    transitionTo(STATES.IDLE);
  }

  // ── Stats & Display ─────────────────────────────────────────
  function _updateStats(latestMs) {
    // Update result display
    elResultMs.textContent = latestMs;
    elResultRating.textContent = _getRating(latestMs);

    // Best
    const best = Math.min(...history);
    elStatBest.textContent = best + ' ms';

    // Avg
    const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
    elStatAvg.textContent = avg + ' ms';

    // Rounds
    elStatRounds.textContent = history.length;

    // History chips
    _renderHistory(best);
  }

  function _getRating(ms) {
    if (ms < 150) return '⚡ LEGENDARY';
    if (ms < 200) return '🔥 ELITE';
    if (ms < 250) return '✦ EXCELLENT';
    if (ms < 300) return '◆ ABOVE AVERAGE';
    if (ms < 400) return '◇ AVERAGE';
    return '▽ KEEP TRAINING';
  }

  function _renderHistory(best) {
    if (history.length === 0) {
      elHistoryList.innerHTML = '<span class="history-empty">No runs yet</span>';
      return;
    }
    elHistoryList.innerHTML = history
      .map((ms, i) => {
        const isBest = ms === best && history.filter(v => v === best).length >= 1 &&
          history.indexOf(best) === i;
        return `<span class="history-chip${isBest ? ' best' : ''}">${ms}ms</span>`;
      })
      .join('');
  }

  // ── Event Listeners ─────────────────────────────────────────
  btnStart.addEventListener('click', () => {
    if (gameState === STATES.IDLE) startGame();
  });

  // During WAITING — clicking is too soon
  btnClickWaiting.addEventListener('click', () => {
    if (gameState === STATES.WAITING) registerTooSoon();
  });

  // During READY — this is the reaction click
  btnClickReady.addEventListener('click', () => {
    if (gameState === STATES.READY) registerReaction();
  });

  btnRetrySoon.addEventListener('click', () => {
    if (gameState === STATES.TOO_SOON) resetGame();
  });

  btnRetryResult.addEventListener('click', () => {
    if (gameState === STATES.RESULT) resetGame();
  });

  // Also allow clicking the canvas as a reaction surface
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
    else if (gameState === STATES.TOO_SOON || gameState === STATES.RESULT) resetGame();
  });

  // ── Initial state ────────────────────────────────────────────
  transitionTo(STATES.IDLE);

})();
