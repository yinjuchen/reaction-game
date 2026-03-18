/* ============================================================
   REFLEX — Three.js Scene
   Lit 3D icosahedron + torus rings + particle cloud
   Reacts to game state with color and animation speed
   ============================================================ */

const ThreeScene = (() => {

  // ── Private state ────────────────────────────────────────
  let renderer, scene, camera, raf;
  let meshIcosa, meshWire, meshRing1, meshRing2;
  let particles, pPositions, pVelocities;
  let pointLight1, pointLight2;

  let clock = 0;
  let currentState = 'idle';
  let colorCurrent = new THREE.Color(0x3B82F6);
  let colorTarget = new THREE.Color(0x3B82F6);

  const N = 200; // particle count

  const STATE_COLORS = {
    idle: new THREE.Color(0x3B82F6),
    waiting: new THREE.Color(0xF59E0B),
    ready: new THREE.Color(0x10B981),
    tooSoon: new THREE.Color(0xEF4444),
    result: new THREE.Color(0x3B82F6),
  };

  // ── Init ─────────────────────────────────────────────────
  function init(canvas) {
    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x080D17, 1);
    renderer.shadowMap.enabled = true;

    // Scene & Camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 6;

    // Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(ambLight);

    pointLight1 = new THREE.PointLight(0x3B82F6, 3.5, 14);
    pointLight1.position.set(3, 3, 3);
    scene.add(pointLight1);

    pointLight2 = new THREE.PointLight(0x10B981, 1.2, 10);
    pointLight2.position.set(-3, -2, 2);
    scene.add(pointLight2);

    // Build scene objects
    _buildIcosahedron();
    _buildRings();
    _buildParticles();

    // Size + resize
    _resize(canvas);
    window.addEventListener('resize', () => _resize(canvas));

    // Start loop
    _loop();
  }

  // ── Builders ─────────────────────────────────────────────

  function _buildIcosahedron() {
    const geo = new THREE.IcosahedronGeometry(0.9, 1);

    // Solid mesh with Phong shading
    const mat = new THREE.MeshPhongMaterial({
      color: 0x3B82F6,
      emissive: 0x0d1a3a,
      specular: 0xffffff,
      shininess: 130,
      transparent: true,
      opacity: 0.88,
    });
    meshIcosa = new THREE.Mesh(geo, mat);
    scene.add(meshIcosa);

    // Wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x3B82F6,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
    });
    meshWire = new THREE.Mesh(geo, wireMat);
    meshIcosa.add(meshWire); // child so it rotates with parent
  }

  function _buildRings() {
    // Inner ring
    const mat1 = new THREE.MeshBasicMaterial({ color: 0x3B82F6, transparent: true, opacity: 0.38 });
    meshRing1 = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.018, 8, 100), mat1);
    meshRing1.rotation.x = Math.PI / 2.5;
    scene.add(meshRing1);

    // Outer ring
    const mat2 = new THREE.MeshBasicMaterial({ color: 0x3B82F6, transparent: true, opacity: 0.18 });
    meshRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.012, 8, 100), mat2);
    meshRing2.rotation.x = Math.PI / 4;
    meshRing2.rotation.z = Math.PI / 6;
    scene.add(meshRing2);
  }

  function _buildParticles() {
    const geo = new THREE.BufferGeometry();
    pPositions = new Float32Array(N * 3);
    pVelocities = [];

    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.5 + Math.random() * 2.2;

      pPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPositions[i * 3 + 2] = r * Math.cos(phi);

      pVelocities.push({
        x: (Math.random() - 0.5) * 0.005,
        y: (Math.random() - 0.5) * 0.005,
        z: (Math.random() - 0.5) * 0.003,
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x3B82F6,
      size: 0.038,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
    });

    particles = new THREE.Points(geo, mat);
    scene.add(particles);
  }

  // ── Resize ───────────────────────────────────────────────
  function _resize(canvas) {
    const w = canvas.parentElement.clientWidth || 300;
    const h = canvas.parentElement.clientHeight || 300;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ── Animation loop ────────────────────────────────────────
  function _loop() {
    raf = requestAnimationFrame(_loop);

    // Guard: skip frame if scene not ready
    if (!meshIcosa || !particles) return;

    clock += 0.012;

    // Lerp color toward target
    colorCurrent.lerp(colorTarget, 0.045);
    const c = colorCurrent;

    // Apply color to all objects
    meshIcosa.material.color.copy(c);
    meshIcosa.material.emissive.set(c.r * 0.18, c.g * 0.18, c.b * 0.18);
    meshWire.material.color.copy(c);
    meshRing1.material.color.copy(c);
    meshRing2.material.color.copy(c);
    particles.material.color.copy(c);
    pointLight1.color.copy(c);

    // Speed multiplier per state
    const speed =
      currentState === 'ready' ? 3.2 :
        currentState === 'tooSoon' ? 4.0 :
          currentState === 'waiting' ? 1.6 : 1.0;

    // Rotate icosahedron
    meshIcosa.rotation.x = clock * 0.26 * (speed * 0.55);
    meshIcosa.rotation.y = clock * 0.40 * (speed * 0.55);

    // Scale pulse
    if (currentState === 'ready') {
      meshIcosa.scale.setScalar(1 + 0.11 * Math.sin(clock * 9));
    } else if (currentState === 'tooSoon') {
      meshIcosa.scale.setScalar(1 + 0.05 * Math.sin(clock * 18));
    } else {
      meshIcosa.scale.setScalar(1 + 0.025 * Math.sin(clock * 1.6));
    }

    // Rotate rings
    meshRing1.rotation.z = clock * 0.16 * speed;
    meshRing1.rotation.y = clock * 0.05;
    meshRing2.rotation.z = -clock * 0.10 * speed;
    meshRing2.rotation.x = clock * 0.07 + Math.PI / 4;

    // Orbit point light
    pointLight1.position.x = Math.sin(clock * 0.65) * 4;
    pointLight1.position.y = Math.cos(clock * 0.48) * 3;
    pointLight1.intensity = 2.5 + Math.sin(clock * 1.8) * 0.6;

    // Drift particles
    for (let i = 0; i < N; i++) {
      pPositions[i * 3] += pVelocities[i].x * speed;
      pPositions[i * 3 + 1] += pVelocities[i].y * speed;
      pPositions[i * 3 + 2] += pVelocities[i].z * speed;

      const dx = pPositions[i * 3];
      const dy = pPositions[i * 3 + 1];
      const dz = pPositions[i * 3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > 5.8 || dist < 1.8) {
        pVelocities[i].x *= -1;
        pVelocities[i].y *= -1;
        pVelocities[i].z *= -1;
      }
    }
    particles.geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Call whenever the game state changes.
   * @param {'idle'|'waiting'|'ready'|'tooSoon'|'result'} state
   */
  function setState(state) {
    currentState = state;
    colorTarget = STATE_COLORS[state] || STATE_COLORS.idle;
  }

  /** Clean up WebGL resources */
  function destroy() {
    cancelAnimationFrame(raf);
    renderer.dispose();
  }

  return { init, setState, destroy };

})();