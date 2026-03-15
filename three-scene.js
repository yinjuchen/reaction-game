/* ============================================================
   REFLEX — Three.js Scene
   Manages the animated 3D shape that reflects game state.
   ============================================================ */

const ThreeScene = (() => {
  // ── Internal State ──────────────────────────────────────────
  let scene, camera, renderer, animId;
  let shapeMesh, particleSystem;
  let clock;

  // Visual config per game state
  const STATE_CONFIG = {
    idle: { color: 0x3B82F6, emissive: 0x0a1a3a, scale: 1.0, rotSpeed: 0.003, pulseAmp: 0.05 },
    waiting: { color: 0x6366F1, emissive: 0x0d0b2a, scale: 1.0, rotSpeed: 0.006, pulseAmp: 0.12 },
    ready: { color: 0x22C55E, emissive: 0x0a2a10, scale: 1.15, rotSpeed: 0.025, pulseAmp: 0.08 },
    tooSoon: { color: 0xEF4444, emissive: 0x2a0a0a, scale: 1.0, rotSpeed: 0.0, pulseAmp: 0.0 },
    result: { color: 0x38BDF8, emissive: 0x0a1520, scale: 1.0, rotSpeed: 0.008, pulseAmp: 0.06 },
  };

  let currentState = 'idle';
  let flashTimer = 0;
  let isFlashing = false;
  let targetScale = 1.0;

  // ── Init ────────────────────────────────────────────────────
  function init(canvasEl) {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    // Camera
    camera = new THREE.PerspectiveCamera(50, canvasEl.clientWidth / canvasEl.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight, false);
    renderer.setClearColor(0x000000, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x3B82F6, 4, 20);
    pointLight1.position.set(4, 4, 4);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x22C55E, 2, 20);
    pointLight2.position.set(-4, -3, 2);
    scene.add(pointLight2);

    // Main shape — IcosahedronGeometry for a satisfying futuristic feel
    const geo = new THREE.IcosahedronGeometry(1.3, 1);
    const mat = new THREE.MeshPhongMaterial({
      color: STATE_CONFIG.idle.color,
      emissive: STATE_CONFIG.idle.emissive,
      shininess: 120,
      wireframe: false,
      flatShading: true,
    });
    shapeMesh = new THREE.Mesh(geo, mat);
    scene.add(shapeMesh);

    // Wireframe overlay for depth
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x3B82F6,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const wireMesh = new THREE.Mesh(geo, wireMat);
    shapeMesh.add(wireMesh);

    // Particle ring
    _buildParticles();

    // Resize observer
    const ro = new ResizeObserver(() => _onResize(canvasEl));
    ro.observe(canvasEl.parentElement);

    // Start loop
    _animate();
  }

  function _buildParticles() {
    const count = 180;
    const positions = new Float32Array(count * 3);
    const radius = 2.6;

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x3B82F6,
      size: 0.035,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });

    particleSystem = new THREE.Points(geo, mat);
    scene.add(particleSystem);
  }

  // ── Animation Loop ──────────────────────────────────────────
  function _animate() {
    animId = requestAnimationFrame(_animate);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    const cfg = STATE_CONFIG[currentState];

    if (isFlashing) {
      flashTimer += delta;
      const flashPhase = Math.sin(flashTimer * 30);
      const flashColor = flashPhase > 0 ? 0xEF4444 : 0x2a0808;
      shapeMesh.material.color.setHex(flashColor);
      shapeMesh.material.emissive.setHex(flashPhase > 0 ? 0x3a0000 : 0x000000);
      if (flashTimer > 0.6) {
        isFlashing = false;
        flashTimer = 0;
      }
    } else {
      // Smooth color transition
      const targetColor = new THREE.Color(cfg.color);
      shapeMesh.material.color.lerp(targetColor, 0.08);
      const targetEmissive = new THREE.Color(cfg.emissive);
      shapeMesh.material.emissive.lerp(targetEmissive, 0.06);
    }

    // Scale: pulse + smooth
    const pulse = 1.0 + Math.sin(elapsed * 2.5) * cfg.pulseAmp;
    targetScale += (cfg.scale - targetScale) * 0.06;
    const finalScale = targetScale * pulse;
    shapeMesh.scale.setScalar(finalScale);

    // Rotation
    shapeMesh.rotation.x += cfg.rotSpeed;
    shapeMesh.rotation.y += cfg.rotSpeed * 1.4;
    shapeMesh.rotation.z += cfg.rotSpeed * 0.3;

    // Particles: orbit slowly
    particleSystem.rotation.y += 0.0015;
    particleSystem.rotation.x += 0.0005;

    // Particle color follows main color
    particleSystem.material.color.lerp(new THREE.Color(cfg.color), 0.05);

    renderer.render(scene, camera);
  }

  // ── Public API ──────────────────────────────────────────────
  function setState(state) {
    currentState = state;
    if (state === 'tooSoon') {
      isFlashing = true;
      flashTimer = 0;
    }
  }

  function _onResize(canvasEl) {
    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function destroy() {
    cancelAnimationFrame(animId);
    renderer.dispose();
  }

  return { init, setState, destroy };
})();
