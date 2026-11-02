import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { unzipSync } from "three/addons/libs/fflate.module.js";

/**
 * Interactive 3D & 2D Hologram Controller for Dark 3rd Dimension
 *
 * Cycles through:
 *  1. Front-facing 3D Emblem Logo (from `holoModelData.logo_emblem` with non-spinning 3D tilt + hologram shader,
 *     or falls back to the 2D PNG hologram logo if `logo_emblem.counts` are all 0)
 *  2. 3D Spinning Logo Cube (from `holoModelData.logo_cube`, or procedural stylized D3D logo cube)
 *  3. 3D Wireframe / Shaded-Cyan Hologram Models (from `holoModelData.wireframe_models` directory counts)
 */

const stage = document.querySelector("[data-holo]");
const wrapper = document.querySelector(".holo-wrapper");
const holoContent = document.querySelector("[data-holo-content]");
const holo2D = document.querySelector("[data-holo-2d]");
const holo3DContainer = document.querySelector("[data-holo-3d]");
const hudLabel = document.querySelector("[data-holo-label]");
const ringA = document.querySelector(".ring-a");
const ringB = document.querySelector(".ring-b");
const ringC = document.querySelector(".ring-c");
const hudContainer = document.querySelector(".holo-hud");
const projectorCone = document.querySelector(".projector-cone");
const projectorSource = document.querySelector(".projector-source");

if (stage && holo2D && holo3DContainer) {
  initHologramSystem();
}

function initHologramSystem() {
  const states = buildHologramStates();
  let currentStateIndex = 0;
  let isTransitioning = false;

  // Smooth mouse parallax tracking
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let isHovered = false;
  let hoverIntensity = 0;

  // Three.js scene state
  let renderer = null;
  let scene = null;
  let camera = null;
  let cursorGroup = null; // Outer group: tilts and shifts directly with the mouse in camera space
  let spinGroup = null;   // Inner group: handles continuous 3D spin independently of mouse tilt
  let activeGroup = null; // Currently mounted model inside spinGroup
  let clock = new THREE.Clock();
  let currentSpinSpeed = 1.0;
  let currentWorldHalfY = 0.55;
  let currentApertureOpen = 0.35;
  let spinPausedByTuner = false;
  const topProjVec = new THREE.Vector3();
  const botProjVec = new THREE.Vector3();
  const modelCache = new Map();
  let occtInstancePromise = null;
  const shaderMaterials = new Set();

  // Create perspective scanline canvas inside `.projector-cone`
  let beamCanvas = null;
  let beamCtx = null;
  if (projectorCone) {
    beamCanvas = document.createElement("canvas");
    beamCanvas.className = "projector-beam-canvas";
    projectorCone.appendChild(beamCanvas);
    beamCtx = beamCanvas.getContext("2d");
  }

  // Live Orientation Tuner UI (toggled with 'O' key)
  const tunerUI = createOrientationTunerUI();

  // If the initial state (State 0) is a 3D Emblem model, load and mount it immediately
  if (states[0]?.type !== "2d") {
    mountInitial3DState(states[0]);
  }

  async function mountInitial3DState(initialState) {
    ensureThreeScene();
    try {
      const loadedGroup = await getOrLoadModelGroup(initialState);
      if (currentStateIndex !== 0) return;
      activeGroup = loadedGroup;
      currentSpinSpeed = initialState.spinSpeed || 0;
      if (activeGroup && spinGroup) {
        spinGroup.rotation.set(0, 0, 0);
        spinGroup.add(activeGroup);
      }
      resizeRenderer();
      holo2D.classList.add("is-hidden");
      holo3DContainer.classList.add("is-active");
      holo3DContainer.setAttribute("aria-hidden", "false");
      if (hudLabel) {
        hudLabel.textContent = initialState.label;
      }
      updateTunerReadout();
    } catch (err) {
      console.warn("[Hologram] Could not load initial 3D emblem model, keeping 2D fallback:", err);
      states[0] = { type: "2d", label: "HOLO // 01 : D3D EMBLEM" };
    }
  }

  // Pointer & Mouse parallax tracking (attached to wrapper/stage unconditionally so all devices respond)
  const interactiveZone = wrapper || stage;

  function handlePointerMove(event) {
    const bounds = interactiveZone.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    targetX = Math.max(-0.5, Math.min(0.5, (event.clientX - bounds.left) / bounds.width - 0.5));
    targetY = Math.max(-0.5, Math.min(0.5, (event.clientY - bounds.top) / bounds.height - 0.5));
    isHovered = true;
    wrapper?.classList.add("is-hovered");
  }

  function handlePointerLeave() {
    isHovered = false;
    targetX = 0;
    targetY = 0;
    wrapper?.classList.remove("is-hovered");
  }

  interactiveZone.addEventListener("pointerenter", handlePointerMove);
  interactiveZone.addEventListener("pointermove", handlePointerMove);
  interactiveZone.addEventListener("mousemove", handlePointerMove);
  interactiveZone.addEventListener("pointerleave", handlePointerLeave);
  interactiveZone.addEventListener("mouseleave", handlePointerLeave);

  // Click / Keyboard activation to cycle hologram modes
  stage.addEventListener("click", (event) => {
    if (event.target.closest(".holo-orient-tuner")) return;
    cycleNextState();
  });

  stage.addEventListener("keydown", (event) => {
    if (event.target.closest(".holo-orient-tuner")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      cycleNextState();
    }
  });

  // Press 'O' anywhere (when not typing in an input) to toggle the Per-Model Orientation Tuner
  window.addEventListener("keydown", (event) => {
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;
    if (event.key === "o" || event.key === "O") {
      tunerUI.toggle();
    }
  });

  // Main animation loop for smooth 3D parallax + Three.js rendering
  function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.getElapsedTime();

    // Smooth lerp for cursor coordinates and hover intensity
    const lerpFactor = 1 - Math.exp(-10 * dt);
    currentX += (targetX - currentX) * lerpFactor;
    currentY += (targetY - currentY) * lerpFactor;
    hoverIntensity += ((isHovered ? 1 : 0) - hoverIntensity) * lerpFactor;

    // 1. Apply 3D Stage Tilt & Multi-Layer Parallax directly to DOM elements
    const mxStr = currentX.toFixed(4);
    const myStr = currentY.toFixed(4);
    const hvStr = hoverIntensity.toFixed(4);

    stage.style.setProperty("--mx", mxStr);
    stage.style.setProperty("--my", myStr);
    stage.style.setProperty("--hover", hvStr);
    if (wrapper) {
      wrapper.style.setProperty("--mx", mxStr);
      wrapper.style.setProperty("--my", myStr);
      wrapper.style.setProperty("--hover", hvStr);
    }

    // Direct 3D transforms for immediate, unmistakable parallax response
    stage.style.transform = `perspective(850px) rotateX(${(currentY * -22).toFixed(2)}deg) rotateY(${(currentX * 26).toFixed(2)}deg)`;

    if (ringA) {
      ringA.style.transform = `translate3d(${(currentX * -44).toFixed(1)}px, ${(currentY * -44).toFixed(1)}px, -55px)`;
    }
    if (ringB) {
      ringB.style.transform = `translate3d(${(currentX * 28).toFixed(1)}px, ${(currentY * 28).toFixed(1)}px, 28px)`;
    }
    if (ringC) {
      ringC.style.transform = `translate3d(${(currentX * -18).toFixed(1)}px, ${(currentY * -18).toFixed(1)}px, -22px)`;
    }
    if (holoContent && !stage.classList.contains("is-glitching")) {
      holoContent.style.transform = `translate3d(${(currentX * 46).toFixed(1)}px, ${(currentY * 46).toFixed(1)}px, 65px)`;
    }
    if (hudContainer) {
      hudContainer.style.transform = `translate3d(${(currentX * 18).toFixed(1)}px, ${(currentY * 14).toFixed(1)}px, 35px)`;
    }

    const activeState = states[currentStateIndex];

    // 2. Update Three.js 3D Hologram Scene
    let targetWorldHalfY = 0.52;
    let targetApertureOpen = 0.28;
    let modelCenterWorldX = 0;
    let modelCenterWorldY = 0;
    if (renderer && scene && camera && activeState && activeState.type !== "2d") {
      if (cursorGroup && spinGroup && activeGroup) {
        // Outer `cursorGroup` tilts and shifts in camera space directly with mouse movement
        const targetCursorRotY = currentX * 0.95;
        const targetCursorRotX = currentY * 0.85;
        const targetCursorRotZ = -currentX * 0.25;

        cursorGroup.rotation.y += (targetCursorRotY - cursorGroup.rotation.y) * lerpFactor;
        cursorGroup.rotation.x += (targetCursorRotX - cursorGroup.rotation.x) * lerpFactor;
        cursorGroup.rotation.z += (targetCursorRotZ - cursorGroup.rotation.z) * lerpFactor;

        cursorGroup.position.x = currentX * 0.24;
        cursorGroup.position.y = -currentY * 0.24 + (spinPausedByTuner ? 0 : Math.sin(elapsed * 1.6) * 0.04);
        modelCenterWorldX = cursorGroup.position.x;
        modelCenterWorldY = cursorGroup.position.y;

        // Inner `spinGroup` handles either subtle idle sway (for 2D/3D Emblem) or continuous 360° spin
        if (activeState.type === "emblem-3d" || spinPausedByTuner) {
          const idleY = spinPausedByTuner ? 0 : Math.sin(elapsed * 1.1) * 0.12;
          const idleX = spinPausedByTuner ? 0 : Math.cos(elapsed * 0.85) * 0.06;
          spinGroup.rotation.y += (idleY - spinGroup.rotation.y) * lerpFactor;
          spinGroup.rotation.x += (idleX - spinGroup.rotation.x) * lerpFactor;
          spinGroup.rotation.z += (0 - spinGroup.rotation.z) * lerpFactor;
        } else {
          const speed = currentSpinSpeed * (1 + hoverIntensity * 0.4);
          spinGroup.rotation.y -= dt * 0.75 * speed;

          const baseTiltX = Math.sin(elapsed * 0.9) * 0.12 + 0.18;
          const baseTiltZ = Math.cos(elapsed * 0.7) * 0.06;
          spinGroup.rotation.x += (baseTiltX - spinGroup.rotation.x) * lerpFactor;
          spinGroup.rotation.z += (baseTiltZ - spinGroup.rotation.z) * lerpFactor;
        }

        // Compute the live vertical height & horizontal rotational span of the 3D model
        activeGroup.updateMatrixWorld(true);
        const halfExt = activeGroup.userData.halfExtents;
        if (halfExt) {
          const m = activeGroup.matrixWorld.elements;
          // Exact world-X (horizontal width) & world-Y (vertical height) half-extents of the oriented bounding box
          const rawWorldHalfX =
            Math.abs(m[0]) * halfExt.x +
            Math.abs(m[4]) * halfExt.y +
            Math.abs(m[8]) * halfExt.z;
          const rawWorldHalfY =
            Math.abs(m[1]) * halfExt.x +
            Math.abs(m[5]) * halfExt.y +
            Math.abs(m[9]) * halfExt.z;

          // Blend vertical height with a subtle portion of horizontal rotational width so the beam
          // and flaps respond both to model height and to wide faces/corners rotating through view
          const effectiveHalfY = rawWorldHalfY * 0.8 + rawWorldHalfX * 0.2;
          targetWorldHalfY = Math.max(0.28, Math.min(0.88, effectiveHalfY * 0.86));

          // Mechanical aperture/cooling expansion (0..1) driven by model volume, height, and live rotation width
          const modelVolumeFactor = Math.max(0, Math.min(1, (halfExt.x + halfExt.y + halfExt.z - 1.1) / 1.1));
          const liveProjectionLoad = Math.max(0, Math.min(1, (rawWorldHalfY * 0.52 + rawWorldHalfX * 0.48 - 0.36) / 0.52));
          targetApertureOpen = Math.max(0.06, Math.min(1.0, liveProjectionLoad * 0.74 + modelVolumeFactor * 0.26));
        }
      }

      shaderMaterials.forEach((mat) => {
        if (mat.uniforms) {
          mat.uniforms.uTime.value = elapsed;
          mat.uniforms.uHover.value = hoverIntensity;
          mat.uniforms.uCenterY.value = modelCenterWorldY;
        }
      });

      renderer.render(scene, camera);
    }

    if (isTransitioning) {
      targetApertureOpen = 1.18;
    }

    // 3. Project the 3D model's exact top, bottom, and center through both the Three.js camera
    //    AND the live CSS 3D stage/parallax bounding rect so the beam tracks mouse movement 1:1.
    if (projectorCone && wrapper) {
      currentWorldHalfY += (targetWorldHalfY - currentWorldHalfY) * lerpFactor;
      currentApertureOpen += (targetApertureOpen - currentApertureOpen) * lerpFactor;

      const wrapRect = wrapper.getBoundingClientRect();
      const targetEl = renderer?.domElement || holoContent || stage;
      const canvasRect = targetEl.getBoundingClientRect();

      let beamEndX = 45 + currentX * 16;
      let beamTopY = 34 + currentY * 22;
      let beamBotY = 66 + currentY * 22;

      if (wrapRect.width > 0 && wrapRect.height > 0 && canvasRect.width > 0 && camera) {
        camera.updateMatrixWorld();
        topProjVec.set(modelCenterWorldX, modelCenterWorldY + currentWorldHalfY, 0).project(camera);
        botProjVec.set(modelCenterWorldX, modelCenterWorldY - currentWorldHalfY, 0).project(camera);

        // Convert NDC (-1..1) inside the CSS-transformed canvasRect into wrapper % (0..100%)
        const screenCenterX = canvasRect.left + (topProjVec.x * 0.5 + 0.5) * canvasRect.width;
        const screenTopY = canvasRect.top + (-topProjVec.y * 0.5 + 0.5) * canvasRect.height;
        const screenBotY = canvasRect.top + (-botProjVec.y * 0.5 + 0.5) * canvasRect.height;

        beamEndX = Math.max(20, Math.min(72, ((screenCenterX - wrapRect.left) / wrapRect.width) * 100 - 4));
        beamTopY = Math.max(2, Math.min(94, ((screenTopY - wrapRect.top) / wrapRect.height) * 100));
        beamBotY = Math.max(beamTopY + 6, Math.min(98, ((screenBotY - wrapRect.top) / wrapRect.height) * 100));
      }

      projectorCone.style.setProperty("--beam-end-x", `${beamEndX.toFixed(2)}%`);
      projectorCone.style.setProperty("--beam-top-y", `${beamTopY.toFixed(2)}%`);
      projectorCone.style.setProperty("--beam-bot-y", `${beamBotY.toFixed(2)}%`);

      // Swivel the mechanical optical turret inside `.projector-source` so it aims at the hologram center
      // and articulate the emitter flaps, mid-body cooling shrouds, and focus collar with model expansion
      if (projectorSource && wrapRect.width > 0 && wrapRect.height > 0) {
        const beamMidY = (beamTopY + beamBotY) * 0.5;
        const dxPx = ((100 - beamEndX) / 100) * wrapRect.width;
        const dyPx = ((beamMidY - 50) / 100) * wrapRect.height;
        const aimAngleDeg = -Math.atan2(dyPx, Math.max(40, dxPx)) * (180 / Math.PI);

        const emitterFlapDeg = 1.5 + currentApertureOpen * 21.5;
        const midFlapDeg = 1.0 + currentApertureOpen * 17.5;
        const focusShiftPx = -currentApertureOpen * 5.2;
        const ventGlow = Math.min(1, 0.22 + currentApertureOpen * 0.78);

        projectorSource.style.setProperty("--turret-angle", `${aimAngleDeg.toFixed(2)}deg`);
        projectorSource.style.setProperty("--emitter-flap-angle", `${emitterFlapDeg.toFixed(2)}deg`);
        projectorSource.style.setProperty("--mid-flap-angle", `${midFlapDeg.toFixed(2)}deg`);
        projectorSource.style.setProperty("--focus-shift", `${focusShiftPx.toFixed(2)}px`);
        projectorSource.style.setProperty("--vent-glow", ventGlow.toFixed(3));
      }

      renderProjectorBeamScanlines(elapsed, currentWorldHalfY, beamEndX, beamTopY, beamBotY);
    }
  }

  requestAnimationFrame(animate);

  // Cycle to the next state with holographic glitch & beam-pulse transition
  async function cycleNextState() {
    if (isTransitioning || states.length <= 1) return;
    isTransitioning = true;

    const nextIndex = (currentStateIndex + 1) % states.length;
    const nextState = states[nextIndex];

    wrapper?.classList.add("is-transitioning");
    stage.classList.add("is-glitching");

    let loadedGroup = null;
    if (nextState.type !== "2d") {
      ensureThreeScene();
      try {
        loadedGroup = await getOrLoadModelGroup(nextState);
      } catch (err) {
        console.warn(`[Hologram] Could not load "${nextState.src || nextState.label}", using fallback cube:`, err);
        loadedGroup = await createStylizedLogoCube(nextState.type === "wireframe");
      }
    }

    await wait(190);

    currentStateIndex = nextIndex;
    currentSpinSpeed = nextState.spinSpeed || 1.0;

    if (nextState.type === "2d") {
      holo2D.classList.remove("is-hidden");
      holo3DContainer.classList.remove("is-active");
      holo3DContainer.setAttribute("aria-hidden", "true");
    } else {
      if (activeGroup && spinGroup) {
        spinGroup.remove(activeGroup);
      }
      activeGroup = loadedGroup;
      if (activeGroup && spinGroup) {
        if (nextState.type === "emblem-3d" || spinPausedByTuner) {
          spinGroup.rotation.set(0, 0, 0);
        } else {
          spinGroup.rotation.set(0.2, 0.5, 0.05);
        }
        spinGroup.add(activeGroup);
      }
      resizeRenderer();
      holo2D.classList.add("is-hidden");
      holo3DContainer.classList.add("is-active");
      holo3DContainer.setAttribute("aria-hidden", "false");
    }

    if (hudLabel) {
      hudLabel.textContent = nextState.label;
    }
    updateTunerReadout();

    await wait(260);
    stage.classList.remove("is-glitching");
    wrapper?.classList.remove("is-transitioning");
    isTransitioning = false;
  }

  // Build the ordered list of hologram states from `holoModelData`
  function buildHologramStates() {
    const list = [];
    const config = typeof holoModelData !== "undefined" ? holoModelData : {};

    // 1. Default Emblem state
    const emblemConfig = config.logo_emblem || {};
    const emblemFiles = resolveFilesFromCounts(emblemConfig.model_folder || "assets/models/emblem", emblemConfig.counts);
    const emblemOrientations = emblemConfig.orientations || {};

    if (emblemFiles.length > 0) {
      emblemFiles.forEach((fileObj, idx) => {
        const indexNum = String(list.length + 1).padStart(2, "0");
        const baseTitle = emblemConfig.title || "D3D EMBLEM";
        const suffix = emblemFiles.length > 1 ? ` #${idx + 1}` : "";
        const rot = emblemOrientations[fileObj.fileName] || emblemConfig.rotation_offset || [0, 0, 0];
        list.push({
          type: "emblem-3d",
          fileName: fileObj.fileName,
          src: fileObj.path,
          ext: fileObj.ext,
          rotationOffset: [...rot],
          spinSpeed: 0,
          label: `HOLO // ${indexNum} : ${baseTitle}${suffix}`
        });
      });
    } else {
      list.push({
        type: "2d",
        label: "HOLO // 01 : D3D EMBLEM"
      });
    }

    // 2. 3D Spinning Logo Cube state
    const logoCubeConfig = config.logo_cube || {};
    const logoFiles = resolveFilesFromCounts(logoCubeConfig.model_folder || "assets/models/logo", logoCubeConfig.counts);
    const logoOrientations = logoCubeConfig.orientations || {};

    if (logoFiles.length > 0) {
      logoFiles.forEach((fileObj, idx) => {
        const indexNum = String(list.length + 1).padStart(2, "0");
        const baseTitle = logoCubeConfig.title || "D3D CORE // 3D LOGO";
        const suffix = logoFiles.length > 1 ? ` #${idx + 1}` : "";
        const rot = logoOrientations[fileObj.fileName] || logoCubeConfig.rotation_offset || [0, 0, 0];
        list.push({
          type: "logo-3d",
          fileName: fileObj.fileName,
          src: fileObj.path,
          ext: fileObj.ext,
          rotationOffset: [...rot],
          spinSpeed: logoCubeConfig.spin_speed || 1.0,
          label: `HOLO // ${indexNum} : ${baseTitle}${suffix}`
        });
      });
    } else {
      const indexNum = String(list.length + 1).padStart(2, "0");
      list.push({
        type: "logo-3d",
        fileName: "procedural-cube",
        src: null,
        ext: "procedural",
        rotationOffset: [0, 0, 0],
        spinSpeed: logoCubeConfig.spin_speed || 1.0,
        label: `HOLO // ${indexNum} : ${logoCubeConfig.title || "D3D CORE // 3D LOGO"}`
      });
    }

    // 3. Wireframe / Shaded Hologram Models directory
    const wireConfig = config.wireframe_models || {};
    const wireFiles = resolveFilesFromCounts(wireConfig.model_folder || "assets/models", wireConfig.counts);
    const customLabels = wireConfig.labels || {};
    const wireOrientations = wireConfig.orientations || {};

    wireFiles.forEach((fileObj) => {
      const indexNum = String(list.length + 1).padStart(2, "0");
      const customName = customLabels[fileObj.fileName] || fileObj.fileName.toUpperCase();
      const rot = wireOrientations[fileObj.fileName] || wireConfig.rotation_offset || [0, 0, 0];
      list.push({
        type: "wireframe",
        fileName: fileObj.fileName,
        src: fileObj.path,
        ext: fileObj.ext,
        rotationOffset: [...rot],
        spinSpeed: wireConfig.spin_speed || 0.85,
        label: `HOLO // ${indexNum} : ${customName}`
      });
    });

    return list;
  }

  function resolveFilesFromCounts(folderPath, countsObj) {
    if (!countsObj || typeof countsObj !== "object") return [];
    const folder = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
    const results = [];

    Object.keys(countsObj).forEach((ext) => {
      const count = Number(countsObj[ext]) || 0;
      const cleanExt = ext.replace(/^\./, "").toLowerCase();
      for (let i = 1; i <= count; i++) {
        const fileName = `${i}.${cleanExt}`;
        results.push({
          fileName,
          ext: cleanExt,
          path: `${folder}${fileName}`
        });
      }
    });

    return results;
  }

  function ensureThreeScene() {
    if (renderer) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.1, 3.35);
    camera.lookAt(0, 0, 0);

    // Hierarchy: scene -> cursorGroup (mouse tilt/parallax) -> spinGroup (continuous rotation) -> activeGroup (model)
    cursorGroup = new THREE.Group();
    spinGroup = new THREE.Group();
    cursorGroup.add(spinGroup);
    scene.add(cursorGroup);

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const ambientLight = new THREE.AmbientLight(0x3cf6ff, 1.4);
    const dirLight1 = new THREE.DirectionalLight(0x3cf6ff, 2.2);
    dirLight1.position.set(3, 4, 5);
    const dirLight2 = new THREE.DirectionalLight(0xb56bff, 1.8);
    dirLight2.position.set(-4, -2, 3);
    scene.add(ambientLight, dirLight1, dirLight2);

    holo3DContainer.prepend(renderer.domElement);
    resizeRenderer();

    window.addEventListener("resize", resizeRenderer);
  }

  function resizeRenderer() {
    if (!renderer || !camera) return;
    const rect = holo3DContainer.getBoundingClientRect();
    const width = Math.max(rect.width || stage.clientWidth || 340, 200);
    const height = Math.max(rect.height || stage.clientHeight || 340, 200);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  async function getOrLoadModelGroup(state) {
    const rotKey = (state.rotationOffset || [0, 0, 0]).join(",");
    const cacheKey = `${state.type}:${state.src || "procedural-logo-cube"}:${rotKey}`;
    if (modelCache.has(cacheKey)) {
      return modelCache.get(cacheKey);
    }

    let group;
    if (!state.src || state.ext === "procedural") {
      group = await createStylizedLogoCube(state.type === "wireframe");
    } else {
      const rawObject = await loadModelByExtension(state.src, state.ext);
      group = convertObjectToHologram(rawObject, state);
    }

    modelCache.set(cacheKey, group);
    return group;
  }

  async function loadModelByExtension(url, ext) {
    const cleanExt = ext.toLowerCase();

    if (cleanExt === "glb" || cleanExt === "gltf") {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      return gltf.scene || gltf.scenes[0];
    }

    if (cleanExt === "stl") {
      const loader = new STLLoader();
      const geometry = await loader.loadAsync(url);
      geometry.computeVertexNormals();
      return new THREE.Mesh(geometry);
    }

    if (cleanExt === "obj") {
      const loader = new OBJLoader();
      return await loader.loadAsync(url);
    }

    if (cleanExt === "3mf") {
      return await load3MFWithMultiColorSupport(url);
    }

    if (cleanExt === "fbx") {
      const loader = new FBXLoader();
      return await loader.loadAsync(url);
    }

    if (cleanExt === "step" || cleanExt === "stp" || cleanExt === "iges" || cleanExt === "igs") {
      return await loadStepOrIgesModel(url, cleanExt);
    }

    throw new Error(`Unsupported 3D model extension: .${cleanExt}`);
  }

  /**
   * Loads a `.3mf` file and extracts `<m:colorgroup>`, `<basematerials>`, and slicer paint colors
   * so multi-color 3MF models preserve their distinct part shades even when ThreeMFLoader defaults to white.
   */
  async function load3MFWithMultiColorSupport(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    const loader = new ThreeMFLoader();
    const group = loader.parse(arrayBuffer);

    try {
      const zip = unzipSync(new Uint8Array(arrayBuffer));
      const orderedColors = [];

      Object.keys(zip).forEach((filePath) => {
        if (!filePath.endsWith(".model")) return;
        const xmlText = new TextDecoder("utf-8").decode(zip[filePath]);
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, "application/xml");

        const resourcePalette = new Map();
        const allElements = doc.getElementsByTagName("*");

        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i];
          const local = el.localName || el.tagName.split(":").pop();

          if (local === "colorgroup") {
            const pid = el.getAttribute("id");
            const colors = [];
            for (let j = 0; j < el.children.length; j++) {
              const child = el.children[j];
              const cHex = child.getAttribute("color");
              if (cHex) colors.push(cHex);
            }
            if (pid) resourcePalette.set(pid, colors);
          } else if (local === "basematerials") {
            const pid = el.getAttribute("id");
            const colors = [];
            for (let j = 0; j < el.children.length; j++) {
              const child = el.children[j];
              const cHex = child.getAttribute("displaycolor");
              if (cHex) colors.push(cHex);
            }
            if (pid) resourcePalette.set(pid, colors);
          }
        }

        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i];
          const local = el.localName || el.tagName.split(":").pop();
          if (local === "object") {
            const pid = el.getAttribute("pid");
            const pindex = parseInt(el.getAttribute("pindex") || "0", 10);
            if (pid && resourcePalette.has(pid)) {
              const palette = resourcePalette.get(pid);
              const hexStr = palette[pindex] || palette[0];
              if (hexStr) {
                orderedColors.push(parse3MFHexColor(hexStr));
              }
            }
          }
        }
      });

      // If no <m:colorgroup> / <basematerials> colors were in the .model XML, check for
      // Bambu Studio / OrcaSlicer / PrusaSlicer `project_settings.config` + `model_settings.config`
      if (
        orderedColors.length === 0 &&
        zip["Metadata/project_settings.config"] &&
        zip["Metadata/model_settings.config"]
      ) {
        const projJson = JSON.parse(
          new TextDecoder("utf-8").decode(zip["Metadata/project_settings.config"])
        );
        const filamentColours = projJson.filament_colour || [];
        if (filamentColours.length > 0) {
          const modelSettingsXml = new TextDecoder("utf-8").decode(
            zip["Metadata/model_settings.config"]
          );
          const doc = new DOMParser().parseFromString(modelSettingsXml, "application/xml");
          const parts = doc.getElementsByTagName("part");
          for (let i = 0; i < parts.length; i++) {
            let extruderIdx = 1;
            const metas = parts[i].getElementsByTagName("metadata");
            for (let j = 0; j < metas.length; j++) {
              if (metas[j].getAttribute("key") === "extruder") {
                extruderIdx = parseInt(metas[j].getAttribute("value") || "1", 10);
              }
            }
            const hexStr = filamentColours[Math.max(0, extruderIdx - 1)] || filamentColours[0];
            if (hexStr) {
              orderedColors.push(parse3MFHexColor(hexStr));
            }
          }
        }
      }

      let meshIdx = 0;
      group.traverse((child) => {
        if (child.isMesh) {
          const origMat = Array.isArray(child.material) ? child.material[0] : child.material;
          const isDefaultWhite =
            !origMat ||
            !origMat.color ||
            (origMat.color.r > 0.98 && origMat.color.g > 0.98 && origMat.color.b > 0.98);

          if (isDefaultWhite && orderedColors[meshIdx]) {
            child.userData.paintedColor = orderedColors[meshIdx];
          } else if (origMat && origMat.color) {
            child.userData.paintedColor = origMat.color.clone();
          }
          meshIdx++;
        }
      });
    } catch (xmlErr) {
      console.warn("[Hologram] Could not parse 3MF extended color table:", xmlErr);
    }

    return group;
  }

  function parse3MFHexColor(hexStr) {
    const clean = hexStr.trim().replace(/^#/, "");
    const rgbHex = clean.substring(0, 6);
    return new THREE.Color(`#${rgbHex}`);
  }

  // Lazy-loads OpenCascade WASM importer (`occt-import-js`) when a STEP/IGES CAD file is used
  async function loadStepOrIgesModel(url, ext) {
    if (!occtInstancePromise) {
      occtInstancePromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/occt-import-js.js";
        script.onload = async () => {
          try {
            const occt = await window.occtimportjs({
              locateFile: (name) => `https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/${name}`
            });
            resolve(occt);
          } catch (e) {
            reject(e);
          }
        };
        script.onerror = () => reject(new Error("Failed to load STEP/IGES WASM importer"));
        document.head.appendChild(script);
      });
    }

    const [occt, response] = await Promise.all([occtInstancePromise, fetch(url)]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading ${url}`);
    }

    const buffer = await response.arrayBuffer();
    const fileBuffer = new Uint8Array(buffer);
    const isIges = ext === "iges" || ext === "igs";
    const result = isIges
      ? occt.ReadIgesFile(fileBuffer, null)
      : occt.ReadStepFile(fileBuffer, null);

    if (!result || !result.success || !result.meshes || result.meshes.length === 0) {
      throw new Error(`Failed to parse CAD geometry from ${url}`);
    }

    const cadGroup = new THREE.Group();
    for (const meshData of result.meshes) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(meshData.attributes.position.array, 3)
      );
      if (meshData.attributes.normal) {
        geometry.setAttribute(
          "normal",
          new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3)
        );
      } else {
        geometry.computeVertexNormals();
      }
      if (meshData.index && meshData.index.array) {
        geometry.setIndex(Array.from(meshData.index.array));
      }
      const mesh = new THREE.Mesh(geometry);
      if (meshData.color && meshData.color.length >= 3) {
        mesh.userData.paintedColor = new THREE.Color(
          meshData.color[0],
          meshData.color[1],
          meshData.color[2]
        );
      }
      cadGroup.add(mesh);
    }

    return cadGroup;
  }

  /**
   * Normalizes any loaded 3D object's orientation, scale & pivot, and converts painted colors
   * into grayscale luminance -> cyan hologram shades.
   */
  function convertObjectToHologram(rootObject, state) {
    const isWireframeMode = state.type === "wireframe";
    const isEmblemMode = state.type === "emblem-3d";
    const rotOffset = state.rotationOffset || [0, 0, 0];

    rootObject.updateMatrixWorld(true);

    const initialBox = new THREE.Box3().setFromObject(rootObject);
    const initialSize = new THREE.Vector3();
    initialBox.getSize(initialSize);

    const autoOrientMatrix = new THREE.Matrix4();
    const hasCustomRot = rotOffset[0] !== 0 || rotOffset[1] !== 0 || rotOffset[2] !== 0;

    if (hasCustomRot) {
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(rotOffset[0]),
        THREE.MathUtils.degToRad(rotOffset[1]),
        THREE.MathUtils.degToRad(rotOffset[2]),
        "XYZ"
      );
      autoOrientMatrix.makeRotationFromEuler(euler);
    } else if (isEmblemMode && initialSize.y < initialSize.z * 0.45 && initialSize.y < initialSize.x * 0.45) {
      autoOrientMatrix.makeRotationX(Math.PI / 2);
    }

    const normalizedHolder = new THREE.Group();

    const meshes = [];
    rootObject.traverse((child) => {
      if (child.isMesh && child.geometry) {
        meshes.push(child);
      }
    });

    const meshLuminances = meshes.map((mesh) => {
      const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const col = mesh.userData.paintedColor || (origMat && origMat.color ? origMat.color : null);
      if (!col) return 0.5;
      return 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
    });

    const minLuma = Math.min(...meshLuminances);
    const maxLuma = Math.max(...meshLuminances);
    const hasMultipleMeshShades = maxLuma - minLuma > 0.01;

    meshes.forEach((mesh, idx) => {
      const geom = mesh.geometry.clone();
      geom.applyMatrix4(mesh.matrixWorld);
      geom.applyMatrix4(autoOrientMatrix);
      geom.computeVertexNormals();

      const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const existingMap = origMat && origMat.map ? origMat.map : null;

      const meshShade = hasMultipleMeshShades
        ? (meshLuminances[idx] - minLuma) / (maxLuma - minLuma)
        : 0.65;

      let hasVertexShade = false;
      if (geom.attributes.color) {
        const colorAttr = geom.attributes.color;
        const count = colorAttr.count;
        const vLumas = new Float32Array(count);
        let vMin = Infinity;
        let vMax = -Infinity;
        for (let i = 0; i < count; i++) {
          const r = colorAttr.getX(i);
          const g = colorAttr.getY(i);
          const b = colorAttr.getZ(i);
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          vLumas[i] = l;
          if (l < vMin) vMin = l;
          if (l > vMax) vMax = l;
        }
        if (vMax - vMin > 0.01) {
          hasVertexShade = true;
          const vShades = new Float32Array(count);
          for (let i = 0; i < count; i++) {
            vShades[i] = (vLumas[i] - vMin) / (vMax - vMin);
          }
          geom.setAttribute("aShade", new THREE.BufferAttribute(vShades, 1));
        }
      }

      if (isWireframeMode) {
        const surfaceOpacity = hasMultipleMeshShades || hasVertexShade
          ? 0.18 + meshShade * 0.48
          : 0.16;

        const ghostMat = createHologramShaderMaterial({
          map: existingMap,
          useTexture: Boolean(existingMap),
          useVertexShade: hasVertexShade,
          shade: meshShade,
          hasMultiShade: hasMultipleMeshShades || hasVertexShade,
          opacity: surfaceOpacity,
          fresnelPower: 2.3,
          scanlineStrength: 0.55
        });
        const ghostMesh = new THREE.Mesh(geom, ghostMat);

        const darkCyanEdge = new THREE.Color(0x0d5c78);
        const brightCyanEdge = new THREE.Color(0xb8feff);
        const edgeColor = hasMultipleMeshShades
          ? darkCyanEdge.clone().lerp(brightCyanEdge, meshShade)
          : new THREE.Color(0x3cf6ff);

        const edgesGeom = new THREE.EdgesGeometry(geom, 18);
        const edgeMat = new THREE.LineBasicMaterial({
          color: edgeColor,
          transparent: true,
          opacity: hasMultipleMeshShades ? 0.52 + meshShade * 0.48 : 0.92,
          blending: THREE.AdditiveBlending
        });
        const edgeLines = new THREE.LineSegments(edgesGeom, edgeMat);

        const wireColor = hasMultipleMeshShades
          ? new THREE.Color(0x073b4c).lerp(new THREE.Color(0x3cf6ff), meshShade)
          : new THREE.Color(0xb56bff);

        const wireGeom = new THREE.WireframeGeometry(geom);
        const wireMat = new THREE.LineBasicMaterial({
          color: wireColor,
          transparent: true,
          opacity: hasMultipleMeshShades ? 0.12 + meshShade * 0.24 : 0.22,
          blending: THREE.AdditiveBlending
        });
        const wireLines = new THREE.LineSegments(wireGeom, wireMat);

        normalizedHolder.add(ghostMesh, wireLines, edgeLines);
      } else {
        const holoMat = createHologramShaderMaterial({
          map: existingMap,
          useTexture: Boolean(existingMap),
          useVertexShade: hasVertexShade,
          shade: meshShade,
          hasMultiShade: hasMultipleMeshShades || hasVertexShade,
          opacity: isEmblemMode ? 0.85 : 0.78,
          fresnelPower: isEmblemMode ? 1.85 : 2.0,
          scanlineStrength: 0.68
        });
        const holoMesh = new THREE.Mesh(geom, holoMat);

        const edgesGeom = new THREE.EdgesGeometry(geom, 16);
        const edgeMat = new THREE.LineBasicMaterial({
          color: 0x3cf6ff,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending
        });
        const edgeLines = new THREE.LineSegments(edgesGeom, edgeMat);

        normalizedHolder.add(holoMesh, edgeLines);
      }
    });

    const box = new THREE.Box3().setFromObject(normalizedHolder);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetScale = (isEmblemMode ? 1.72 : 1.55) / maxDim;

    normalizedHolder.position.set(
      -center.x * targetScale,
      -center.y * targetScale,
      -center.z * targetScale
    );
    normalizedHolder.scale.setScalar(targetScale);

    const wrapperGroup = new THREE.Group();
    wrapperGroup.add(normalizedHolder);
    wrapperGroup.userData.halfExtents = new THREE.Vector3(
      size.x * targetScale * 0.5,
      size.y * targetScale * 0.5,
      size.z * targetScale * 0.5
    );
    return wrapperGroup;
  }

  // Stylized 3D bevelled hologram cube wrapped with the D3D Cyan Logo
  async function createStylizedLogoCube(isWireframeMode = false) {
    const group = new THREE.Group();
    group.userData.halfExtents = new THREE.Vector3(0.64, 0.64, 0.64);

    const textureLoader = new THREE.TextureLoader();
    let logoTexture = null;
    try {
      logoTexture = await textureLoader.loadAsync("assets/Dark%203rd%20Dimension%20Logo%20Cyan.png");
      logoTexture.colorSpace = THREE.SRGBColorSpace;
    } catch (e) {
      console.warn("[Hologram] Could not load logo texture for 3D cube:", e);
    }

    const boxSize = 1.28;
    const roundedBoxGeom = new RoundedBoxGeometry(boxSize, boxSize, boxSize, 4, 0.12);

    const cubeHoloMat = createHologramShaderMaterial({
      map: logoTexture,
      useTexture: Boolean(logoTexture) && !isWireframeMode,
      opacity: isWireframeMode ? 0.16 : 0.85,
      fresnelPower: 2.1,
      scanlineStrength: 0.7
    });

    const mainCube = new THREE.Mesh(roundedBoxGeom, cubeHoloMat);
    group.add(mainCube);

    const outerFrameGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(boxSize * 1.01, boxSize * 1.01, boxSize * 1.01));
    const cyanEdgeMat = new THREE.LineBasicMaterial({
      color: 0x3cf6ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    group.add(new THREE.LineSegments(outerFrameGeom, cyanEdgeMat));

    const innerCoreGeom = new THREE.OctahedronGeometry(0.46, 0);
    const purpleWireMat = new THREE.LineBasicMaterial({
      color: 0xb56bff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending
    });
    const innerCoreEdges = new THREE.LineSegments(new THREE.EdgesGeometry(innerCoreGeom), purpleWireMat);
    group.add(innerCoreEdges);

    if (isWireframeMode) {
      const fullWire = new THREE.LineSegments(
        new THREE.WireframeGeometry(roundedBoxGeom),
        new THREE.LineBasicMaterial({
          color: 0x3cf6ff,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending
        })
      );
      group.add(fullWire);
    }

    return group;
  }

  // Custom GLSL Hologram Shader (Supports Grayscale-to-Cyan Multi-Color Shading + Scanlines + Fresnel)
  function createHologramShaderMaterial({
    map = null,
    useTexture = false,
    useVertexShade = false,
    shade = 0.65,
    hasMultiShade = false,
    opacity = 0.78,
    fresnelPower = 2.1,
    scanlineStrength = 0.6
  }) {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uHover: { value: 0 },
        uCenterY: { value: 0 },
        uMap: { value: map },
        uUseTexture: { value: useTexture ? 1.0 : 0.0 },
        uUseVertexShade: { value: useVertexShade ? 1.0 : 0.0 },
        uShade: { value: shade },
        uHasMultiShade: { value: hasMultiShade ? 1.0 : 0.0 },
        uOpacity: { value: opacity },
        uFresnelPower: { value: fresnelPower },
        uScanlineStrength: { value: scanlineStrength },
        uColorDarkCyan: { value: new THREE.Color(0x073b4c) },
        uColorCyan: { value: new THREE.Color(0x3cf6ff) },
        uColorBrightCyan: { value: new THREE.Color(0xd4feff) },
        uColorPurple: { value: new THREE.Color(0xb56bff) }
      },
      vertexShader: `
        attribute float aShade;
        varying float vVertexShade;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vVertexShade = aShade;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          vec4 mvPosition = viewMatrix * worldPosition;
          vViewPosition = -mvPosition.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uHover;
        uniform float uCenterY;
        uniform sampler2D uMap;
        uniform float uUseTexture;
        uniform float uUseVertexShade;
        uniform float uShade;
        uniform float uHasMultiShade;
        uniform float uOpacity;
        uniform float uFresnelPower;
        uniform float uScanlineStrength;
        uniform vec3 uColorDarkCyan;
        uniform vec3 uColorCyan;
        uniform vec3 uColorBrightCyan;
        uniform vec3 uColorPurple;

        varying float vVertexShade;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPos;

        void main() {
          vec3 viewDir = normalize(vViewPosition);
          vec3 normal = normalize(vNormal);
          if (!gl_FrontFacing) {
            normal = -normal;
          }

          float fresnel = pow(1.0 - abs(dot(viewDir, normal)), uFresnelPower);

          vec3 lightDir = normalize(vec3(0.6, 0.8, 1.0));
          float diff = max(dot(normal, lightDir), 0.0) * 0.55 + 0.45;

          float localY = vWorldPos.y - uCenterY;
          float fineScan = sin((localY * 48.0) - (uTime * 6.5)) * 0.5 + 0.5;
          float laserBand = smoothstep(0.86, 1.0, sin((localY * 3.2) - (uTime * 2.2)));
          float scanFactor = mix(1.0, 0.55 + 0.45 * fineScan + laserBand * 0.55, uScanlineStrength);

          float activeShade = uUseVertexShade > 0.5 ? vVertexShade : uShade;

          vec3 shadedCyan = activeShade < 0.5
            ? mix(uColorDarkCyan, uColorCyan, activeShade * 2.0)
            : mix(uColorCyan, uColorBrightCyan, (activeShade - 0.5) * 2.0);

          vec3 baseColor;
          if (uHasMultiShade > 0.5) {
            baseColor = shadedCyan * (0.45 + 0.85 * activeShade) * diff;
          } else {
            baseColor = mix(uColorCyan, uColorPurple, clamp(fresnel * 0.7 + (vWorldPos.y + 0.8) * 0.25, 0.0, 1.0)) * diff;
          }

          float alpha = (0.22 + fresnel * 0.72 + laserBand * 0.22) * uOpacity;

          if (uUseTexture > 0.5) {
            vec2 centeredUv = (vUv - 0.5) * 1.12 + 0.5;
            vec4 texColor = vec4(0.0);
            if (centeredUv.x >= 0.0 && centeredUv.x <= 1.0 && centeredUv.y >= 0.0 && centeredUv.y <= 1.0) {
              texColor = texture2D(uMap, centeredUv);
            }
            float texLuma = (0.299 * texColor.r + 0.587 * texColor.g + 0.114 * texColor.b) * texColor.a;
            vec3 logoGlow = mix(uColorDarkCyan, uColorBrightCyan, clamp(texLuma * 1.2, 0.0, 1.0)) * (1.2 + uHover * 0.35);

            baseColor = mix(baseColor * 0.45, logoGlow, clamp(texLuma * 1.35, 0.0, 1.0));
            alpha = max(alpha * 0.55, texLuma * 0.92 * uOpacity) + fresnel * 0.35;
          }

          vec3 finalColor = baseColor * scanFactor * (1.0 + uHover * 0.25) + (uColorCyan * laserBand * 0.3);
          float finalAlpha = clamp(alpha * scanFactor, 0.05, 0.95);

          gl_FragColor = vec4(finalColor, finalAlpha);
        }
      `
    });

    shaderMaterials.add(material);
    return material;
  }

  /**
   * Builds a toggleable on-screen Orientation Tuner (press `O` key) so the user can rotate
   * any model on X, Y, Z in real time and copy the `[X, Y, Z]` array for `js/holo-models.js`.
   */
  function createOrientationTunerUI() {
    const panel = document.createElement("div");
    panel.className = "holo-orient-tuner";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="tuner-head">
        <span>ORIENTATION TUNER (KEY: O)</span>
        <button type="button" class="tuner-btn" data-tuner-pause>PAUSE SPIN</button>
      </div>
      <div class="tuner-controls">
        <button type="button" class="tuner-btn" data-axis="0" data-step="-90">X -90°</button>
        <button type="button" class="tuner-btn" data-axis="0" data-step="90">X +90°</button>
        <button type="button" class="tuner-btn" data-axis="1" data-step="-90">Y -90°</button>
        <button type="button" class="tuner-btn" data-axis="1" data-step="90">Y +90°</button>
        <button type="button" class="tuner-btn" data-axis="2" data-step="-90">Z -90°</button>
        <button type="button" class="tuner-btn" data-axis="2" data-step="90">Z +90°</button>
      </div>
      <div class="tuner-output">
        <code data-tuner-code>"1.3mf": [0, 0, 0]</code>
        <button type="button" class="tuner-btn copy" data-tuner-copy>COPY</button>
      </div>
    `;

    stage.appendChild(panel);

    const pauseBtn = panel.querySelector("[data-tuner-pause]");
    const copyBtn = panel.querySelector("[data-tuner-copy]");
    const codeEl = panel.querySelector("[data-tuner-code]");

    pauseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      spinPausedByTuner = !spinPausedByTuner;
      pauseBtn.textContent = spinPausedByTuner ? "RESUME SPIN" : "PAUSE SPIN";
      if (spinPausedByTuner && spinGroup) {
        spinGroup.rotation.set(0, 0, 0);
      }
    });

    panel.querySelectorAll("[data-axis]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const activeState = states[currentStateIndex];
        if (!activeState || activeState.type === "2d") return;

        const axis = Number(btn.getAttribute("data-axis"));
        const step = Number(btn.getAttribute("data-step"));
        if (!activeState.rotationOffset) {
          activeState.rotationOffset = [0, 0, 0];
        }
        let nextVal = (activeState.rotationOffset[axis] + step) % 360;
        if (nextVal > 180) nextVal -= 360;
        if (nextVal <= -180) nextVal += 360;
        activeState.rotationOffset[axis] = nextVal;

        updateTunerReadout();

        if (activeGroup && spinGroup) {
          spinGroup.remove(activeGroup);
        }
        activeGroup = await getOrLoadModelGroup(activeState);
        if (activeGroup && spinGroup) {
          spinGroup.add(activeGroup);
        }
      });
    });

    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(codeEl.textContent);
        copyBtn.textContent = "COPIED!";
        setTimeout(() => {
          copyBtn.textContent = "COPY";
        }, 1200);
      } catch (_) {
        // Fallback if clipboard blocked
      }
    });

    return {
      panel,
      codeEl,
      toggle() {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) {
          spinPausedByTuner = true;
          pauseBtn.textContent = "RESUME SPIN";
          if (spinGroup) spinGroup.rotation.set(0, 0, 0);
          updateTunerReadout();
        } else {
          spinPausedByTuner = false;
          pauseBtn.textContent = "PAUSE SPIN";
        }
      }
    };
  }

  function updateTunerReadout() {
    if (!tunerUI || !tunerUI.codeEl) return;
    const activeState = states[currentStateIndex];
    if (!activeState || activeState.type === "2d") {
      tunerUI.codeEl.textContent = `2D MODE`;
      return;
    }
    const rot = activeState.rotationOffset || [0, 0, 0];
    const name = activeState.fileName || "model";
    tunerUI.codeEl.textContent = `"${name}": [${rot[0]}, ${rot[1]}, ${rot[2]}]`;
  }

  /**
   * Draws perspective-fanning scanlines and the sweeping laser band inside `.projector-cone`
   * so they are thin at the projector source on the right, expand at the exact same ratio as the
   * main beam, and arrive at the model in 100% phase/position sync with the 3D shader scanlines.
   */
  function renderProjectorBeamScanlines(elapsed, yMaxWorld, beamEndXPct, beamTopYPct, beamBotYPct) {
    if (!beamCanvas || !beamCtx || !projectorCone) return;

    const w = projectorCone.clientWidth || 500;
    const h = projectorCone.clientHeight || 500;
    if (beamCanvas.width !== w || beamCanvas.height !== h) {
      beamCanvas.width = w;
      beamCanvas.height = h;
    }

    beamCtx.clearRect(0, 0, w, h);

    // Projector source aperture (right edge X = w, Y = 47.5%..52.5%)
    const xp = w;
    const ypTop = 0.475 * h;
    const ypBot = 0.525 * h;
    const ypSpan = ypBot - ypTop;

    // Hologram model plane (left end of beam X = beamEndXPct%, Y = beamTopYPct%..beamBotYPct%)
    const xm = (beamEndXPct / 100) * w;
    const ymTop = (beamTopYPct / 100) * h;
    const ymBot = (beamBotYPct / 100) * h;
    const ymSpan = ymBot - ymTop;

    // World half-height corresponding directly to beamTopYPct..beamBotYPct
    const yMax = Math.max(0.2, yMaxWorld);
    const twoPi = Math.PI * 2;

    // Horizontal gradient for the fine scanlines (fades out cleanly in line with the model)
    const scanGrad = beamCtx.createLinearGradient(xp, 0, xm, 0);
    const alphaBoost = 1 + hoverIntensity * 0.35;
    scanGrad.addColorStop(0, `rgba(212, 254, 255, ${(0.36 * alphaBoost).toFixed(3)})`);
    scanGrad.addColorStop(0.45, `rgba(60, 246, 255, ${(0.22 * alphaBoost).toFixed(3)})`);
    scanGrad.addColorStop(0.82, `rgba(181, 107, 255, ${(0.1 * alphaBoost).toFixed(3)})`);
    scanGrad.addColorStop(1, "rgba(60, 246, 255, 0)");

    beamCtx.fillStyle = scanGrad;
    beamCtx.beginPath();

    // 1. Fine scanlines: sin(localY * 48.0 - elapsed * 6.5) > 0.15
    // Each bright ridge is where phase in [2*pi*k + 0.25, 2*pi*k + pi - 0.25]
    const freq = 48.0;
    const phaseShift = elapsed * 6.5;
    const minPhase = -yMax * freq - phaseShift;
    const maxPhase = yMax * freq - phaseShift;
    const kStart = Math.floor(minPhase / twoPi) - 1;
    const kEnd = Math.ceil(maxPhase / twoPi) + 1;

    for (let k = kStart; k <= kEnd; k++) {
      const pLow = k * twoPi + 0.35;
      const pHigh = k * twoPi + Math.PI - 0.35;
      const yLow = Math.max(-yMax, (pLow + phaseShift) / freq);
      const yHigh = Math.min(yMax, (pHigh + phaseShift) / freq);

      if (yHigh <= yLow) continue;

      // Map world localY in [-yMax, +yMax] to normalized top-to-bottom fraction u in [0, 1]
      const uTop = (yMax - yHigh) / (2 * yMax);
      const uBot = (yMax - yLow) / (2 * yMax);

      // 4 corners of the perspective scanline wedge (thin at projector, wider at model)
      beamCtx.moveTo(xp, ypTop + uTop * ypSpan);
      beamCtx.lineTo(xp, ypTop + uBot * ypSpan);
      beamCtx.lineTo(xm, ymTop + uBot * ymSpan);
      beamCtx.lineTo(xm, ymTop + uTop * ymSpan);
      beamCtx.closePath();
    }
    beamCtx.fill();

    // 2. Sweeping laser band: smoothstep(0.86, 1.0, sin(localY * 3.2 - elapsed * 2.2))
    const laserFreq = 3.2;
    const laserShift = elapsed * 2.2;
    const lMinPhase = -yMax * laserFreq - laserShift;
    const lMaxPhase = yMax * laserFreq - laserShift;
    const lkStart = Math.floor(lMinPhase / twoPi) - 1;
    const lkEnd = Math.ceil(lMaxPhase / twoPi) + 1;

    const laserGrad = beamCtx.createLinearGradient(xp, 0, xm, 0);
    laserGrad.addColorStop(0, `rgba(247, 251, 255, ${(0.55 * alphaBoost).toFixed(3)})`);
    laserGrad.addColorStop(0.5, `rgba(60, 246, 255, ${(0.34 * alphaBoost).toFixed(3)})`);
    laserGrad.addColorStop(0.85, `rgba(181, 107, 255, ${(0.16 * alphaBoost).toFixed(3)})`);
    laserGrad.addColorStop(1, "rgba(60, 246, 255, 0)");

    beamCtx.fillStyle = laserGrad;
    beamCtx.beginPath();

    // asin(0.86) ≈ 1.035 rad
    for (let k = lkStart; k <= lkEnd; k++) {
      const pLow = k * twoPi + 1.035;
      const pHigh = k * twoPi + Math.PI - 1.035;
      const yLow = Math.max(-yMax, (pLow + laserShift) / laserFreq);
      const yHigh = Math.min(yMax, (pHigh + laserShift) / laserFreq);

      if (yHigh <= yLow) continue;

      const uTop = (yMax - yHigh) / (2 * yMax);
      const uBot = (yMax - yLow) / (2 * yMax);

      beamCtx.moveTo(xp, ypTop + uTop * ypSpan);
      beamCtx.lineTo(xp, ypTop + uBot * ypSpan);
      beamCtx.lineTo(xm, ymTop + uBot * ymSpan);
      beamCtx.lineTo(xm, ymTop + uTop * ymSpan);
      beamCtx.closePath();
    }
    beamCtx.fill();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
