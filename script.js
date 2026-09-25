/* ==========================================================================
   MedVisor Standalone Test Bench
   - Splash screen
   - 3D Anatomy viewer (heartbeat for heart, idle float for others)
   - Disease model selector
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ------------------------------------------------------------------
   Config
------------------------------------------------------------------ */
const MODEL_BASE = 'models/';

const MODULES = [
  { name: 'Heart Disease',       organ: 'Human heart', model: 'heart.glb',    tag: 'Extended',         tagColor: '#7A9E8B', default: true },
  { name: 'Diabetes',            organ: 'Pancreas',    model: 'diabetes.glb', tag: 'Clinical Data',    tagColor: '#8AAFC0' },
  { name: "Parkinson's Disease", organ: 'Human brain', model: 'brain2.glb',    tag: 'Clinical Data',    tagColor: '#8AAFC0' },
  { name: 'Brain Tumor (MRI)',   organ: 'Human brain', model: 'brain.glb',    tag: 'Medical Imaging',  tagColor: '#FAD6A5' },
  { name: 'Breast Cancer',       organ: 'Breast',      model: 'breast.glb',   tag: 'Medical Imaging',  tagColor: '#FAD6A5' },
  { name: "Alzheimer's (MRI)",   organ: 'Human brain', model: 'brain.glb',    tag: 'Medical Imaging',  tagColor: '#FAD6A5' },
  { name: 'Kidney Disease',      organ: 'Kidney',      model: 'kidney.glb',   tag: 'Extended',         tagColor: '#7A9E8B' },
  { name: 'Liver Disease',       organ: 'Liver',       model: 'Liver.glb',    tag: 'Extended',         tagColor: '#7A9E8B' },
  { name: 'Pneumonia & Malaria', organ: 'Lungs',       model: 'Lungs.glb',    tag: 'Medical Imaging',  tagColor: '#FAD6A5' },
  { name: 'Skin Disease',        organ: 'Skin',        model: 'skin.glb',     tag: 'Medical Imaging',  tagColor: '#FAD6A5' },
];

const PALETTE = {
  charcoal: 0x30434a,
  dusty: 0x8aafc0,
  sage: 0x7a9e8b,
  tuscan: 0xfad6a5,
  offwhite: 0xfaf9f6,
};
const MAX_PIXEL_RATIO = 1.75;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------
   Heartbeat envelope
------------------------------------------------------------------ */
let targetBpm = 72;
function beatEnvelope(elapsed) {
  const period = 60 / Math.max(30, Math.min(180, targetBpm));
  const phase = (elapsed % period) / period;
  const bump = (c, w) => Math.exp(-((phase - c) ** 2) / (2 * w * w));
  return 0.055 * bump(0.12, 0.045) + 0.028 * bump(0.32, 0.055);
}

/* ------------------------------------------------------------------
   Splash screen
------------------------------------------------------------------ */
function initSplash() {
  const splash = document.getElementById('splashScreen');
  const main = document.getElementById('mainContent');
  const bar = document.getElementById('splashProgressBar');
  const percent = document.getElementById('splashPercent');
  const status = document.getElementById('splashStatusText');
  const skip = document.getElementById('skipSplashBtn');
  if (!splash || !main) return;

  const msgs = [
    { at: 15, text: 'Initializing secure workspace...' },
    { at: 45, text: 'Connecting clinical telemetry...' },
    { at: 75, text: 'Calibrating 3D engine...' },
    { at: 95, text: 'Ready.' },
  ];

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 5) + 3;
    if (progress > 100) progress = 100;
    if (bar) bar.style.width = `${progress}%`;
    if (percent) percent.textContent = `${progress}%`;
    const cur = msgs.slice().reverse().find(m => progress >= m.at);
    if (cur && status) status.textContent = cur.text;
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(dismiss, 300);
    }
  }, 50);

  function dismiss() {
    clearInterval(interval);
    splash.classList.add('hide');
    main.classList.add('visible');
  }
  if (skip) skip.addEventListener('click', dismiss);

  document.getElementById('year').textContent = new Date().getFullYear();
}
/* ---------- Hero carousel ---------- */
function initHeroCarousel() {
  const slides = document.querySelectorAll('.hero-carousel .carousel-slide');
  const dots = document.querySelectorAll('.hero-carousel .cdot');
  if (!slides.length || !dots.length) return;

  let current = 0;
  let timer = null;

  function go(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = index;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function next() {
    go((current + 1) % slides.length);
  }

  function startAuto() {
    if (slides.length < 2) return;
    stopAuto();
    timer = setInterval(next, 4500);
  }

  function stopAuto() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  // Click on dots
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      go(i);
      startAuto(); // reset the timer so it doesn't jump immediately after
    });
  });

  // Pause on hover (nice touch on desktop)
  const carousel = document.querySelector('.hero-carousel');
  if (carousel) {
    carousel.addEventListener('mouseenter', stopAuto);
    carousel.addEventListener('mouseleave', startAuto);
  }

  // Pause when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') startAuto();
    else stopAuto();
  });

  // Respect reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion) startAuto();
}
/* ------------------------------------------------------------------
   Build the model selector grid from MODULES
------------------------------------------------------------------ */
function buildModelGrid() {
  const grid = document.getElementById('modelGrid');
  if (!grid) return;

  grid.innerHTML = MODULES.map((m, i) => `
    <button type="button"
            class="mv-model-card"
            data-organ-trigger
            data-model="${MODEL_BASE}${m.model}"
            data-label="${m.organ} — ${m.name}"
            data-callout-title="${m.organ}"
            data-callout-desc="3D anatomical model for ${m.name} (${m.tag})."
            ${m.default ? 'data-default="true"' : ''}
            aria-pressed="false">
      <span class="mv-model-card__tag" style="color: ${m.tagColor}">${m.tag}</span>
      <span class="mv-model-card__name">${m.name}</span>
      <span class="mv-model-card__organ">${m.organ}</span>
    </button>
  `).join('');
}

/* ------------------------------------------------------------------
   Loaders
------------------------------------------------------------------ */
function buildGLTFLoader() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}
function buildTissueMaterial() {
  return new THREE.MeshStandardMaterial({
    color: PALETTE.dusty,
    roughness: 0.55,
    metalness: 0.06,
    emissive: PALETTE.charcoal,
    emissiveIntensity: 0.12,
  });
}

/* ------------------------------------------------------------------
   Organ viewer
------------------------------------------------------------------ */
class OrganViewer {
  constructor(root) {
    this.root = root;
    this.stage = root.querySelector('[data-organ-stage]');
    this.bar = root.querySelector('[data-organ-bar]');
    this.loader = buildGLTFLoader();
    this.stlLoader = new STLLoader();
    this.current = null;
    this.currentUrl = null;
    this.running = true;
    this.visible = true;
    this.frameId = null;
    this.initialised = false;
    this.clock = new THREE.Clock();
    this.heartPivot = null;
    this.isHeart = false;
    this.initialCamPos = null;
    this.initialTarget = null;
  }

  init() {
    if (this.initialised) return;
    this.initialised = true;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(this.stage.clientWidth, this.stage.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.stage.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, this.stage.clientWidth / this.stage.clientHeight, 0.01, 1000);
    this.camera.position.set(0, 0, 3);

    this.heartPivot = new THREE.Group();
    this.scene.add(this.heartPivot);

    this.scene.add(new THREE.HemisphereLight(PALETTE.offwhite, PALETTE.charcoal, 0.9));

    const key = new THREE.DirectionalLight(PALETTE.offwhite, 1.45);
    key.position.set(2.5, 3.2, 2.6);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(PALETTE.dusty, 0.85);
    rim.position.set(-3, 1.2, -2.4);
    this.scene.add(rim);

    const warm = new THREE.DirectionalLight(PALETTE.tuscan, 0.4);
    warm.position.set(1.8, -2.4, 1.2);
    this.scene.add(warm);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.autoRotate = !prefersReducedMotion;
    this.controls.autoRotateSpeed = 0.7;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.stage);

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => { this.visible = entry.isIntersecting; },
      { threshold: 0.01 }
    );
    this.intersectionObserver.observe(this.stage);

    document.addEventListener('visibilitychange', () => {
      this.running = document.visibilityState === 'visible';
    });

    window.addEventListener('pagehide', () => this.dispose(), { once: true });

    this.render();
  }

  resize() {
    if (!this.renderer) return;
    const { clientWidth: w, clientHeight: h } = this.stage;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setProgress(p) {
    if (this.bar) {
      this.bar.style.width = p === null ? '0%' : `${Math.round(p * 100)}%`;
      this.bar.dataset.active = p !== null && p < 1 ? 'true' : 'false';
    }
  }

  clearCurrent() {
    if (!this.current) return;
    this.heartPivot.remove(this.current);
    this.current.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (!m) return;
        Object.values(m).forEach((v) => { if (v && v.isTexture) v.dispose(); });
        m.dispose();
      });
    });
    this.current = null;
  }

  frame(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    object.position.sub(center);

    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (radius / Math.sin(fov / 2)) * 1.15;

    this.camera.position.set(0, radius * 0.12, distance);
    this.camera.near = distance * 0.02;
    this.camera.far = distance * 12;
    this.camera.updateProjectionMatrix();

    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = distance * 0.45;
    this.controls.maxDistance = distance * 2.2;
    this.controls.update();

    this.initialCamPos = this.camera.position.clone();
    this.initialTarget = this.controls.target.clone();
  }

  load(url, labelText) {
    this.init();
    if (this.currentUrl === url) return;
    this.currentUrl = url;
    this.isHeart = /heart\.(glb|gltf|stl)(\?|$)/i.test(url);

    this.root.dataset.organState = 'loading';
    this.setProgress(0);

    const onProgress = (e) => { if (e.total) this.setProgress(e.loaded / e.total); };
    const onError = () => {
      this.currentUrl = null;
      this.root.dataset.organState = 'error';
      this.setProgress(null);
      console.error(`[OrganViewer] Failed to load ${url}`);
    };

    const settle = (object) => {
      this.clearCurrent();
      this.current = object;
      this.heartPivot.add(this.current);
      this.heartPivot.scale.setScalar(1);
      this.heartPivot.position.set(0, 0, 0);
      this.frame(this.current);
      this.root.dataset.organState = 'ready';
      this.setProgress(null);

      const bpmWidget = document.querySelector('[data-bpm-widget]');
      const status = document.getElementById('sceneBpmStatus');
      if (bpmWidget) bpmWidget.hidden = !this.isHeart;
      if (status) status.style.visibility = this.isHeart ? 'visible' : 'hidden';
    };

    const ext = url.split('.').pop().toLowerCase().split('?')[0];
    if (ext === 'stl') {
      this.stlLoader.load(url, (geometry) => {
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, buildTissueMaterial());
        const wrapper = new THREE.Group();
        wrapper.add(mesh);
        settle(wrapper);
      }, onProgress, onError);
    } else {
      this.loader.load(url, (gltf) => settle(gltf.scene), onProgress, onError);
    }
  }

  render() {
    this.frameId = requestAnimationFrame(() => this.render());
    if (!this.visible || !this.running) return;

    const elapsed = this.clock.getElapsedTime();
    this.controls.update();

    if (this.heartPivot && this.current && !prefersReducedMotion) {
      if (this.isHeart) {
        const beat = beatEnvelope(elapsed);
        const sx = 1 + beat;
        const sy = 1 + beat * 1.15;
        this.heartPivot.scale.set(sx, sy, sx);
        this.heartPivot.position.y = Math.sin(elapsed * 0.7) * 0.015;
      } else {
        this.heartPivot.scale.setScalar(1);
        this.heartPivot.position.y = Math.sin(elapsed * 0.6) * 0.02;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  reset() {
    if (!this.camera || !this.controls) return;
    if (this.initialCamPos) this.camera.position.copy(this.initialCamPos);
    if (this.initialTarget) this.controls.target.copy(this.initialTarget);
    this.controls.update();
    if (this.heartPivot) {
      this.heartPivot.scale.setScalar(1);
      this.heartPivot.position.set(0, 0, 0);
    }
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.clearCurrent();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.initialised = false;
  }
}

/* ------------------------------------------------------------------
   Boot the viewer + model grid
------------------------------------------------------------------ */
function initViewer() {
  const root = document.querySelector('[data-organ-viewer]');
  if (!root) return;

  let viewer;
  try {
    viewer = new OrganViewer(root);
  } catch (err) {
    console.warn('[OrganViewer] WebGL unavailable.', err);
    root.dataset.organState = 'unavailable';
    return;
  }

  const triggers = Array.from(document.querySelectorAll('[data-organ-trigger]'));

  const activate = (trigger) => {
    triggers.forEach((t) => t.setAttribute('aria-pressed', String(t === trigger)));
    viewer.load(trigger.dataset.model, trigger.dataset.label);

    const titleEl = document.getElementById('calloutTitle');
    const descEl = document.getElementById('calloutDesc');
    if (titleEl && trigger.dataset.calloutTitle) titleEl.textContent = trigger.dataset.calloutTitle;
    if (descEl && trigger.dataset.calloutDesc) descEl.textContent = trigger.dataset.calloutDesc;
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      activate(trigger);
      if (!root.dataset.organSeen) root.dataset.organSeen = 'true';
      root.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    });
  });

  // Autoload default (heart)
  const preferred = triggers.find((t) => t.dataset.default === 'true') || triggers[0];
  const once = new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    root.dataset.organSeen = 'true';
    if (preferred) activate(preferred);
  }, { threshold: 0.25 });
  once.observe(root);

  // Reset button
  const resetBtn = root.querySelector('[data-organ-reset]');
  if (resetBtn) resetBtn.addEventListener('click', (e) => { e.preventDefault(); viewer.reset(); });

  // BPM slider
  const bpmSlider = document.getElementById('bpmRangeSlider');
  const bpmCounter = document.getElementById('bpmCounter');
  const bpmStatus = document.getElementById('sceneBpmStatus');

  function updateBpm(v) {
    const val = parseInt(v, 10) || 72;
    targetBpm = val;
    if (bpmCounter) bpmCounter.textContent = `${val} BPM`;
    if (bpmStatus) {
      if (val < 60) bpmStatus.textContent = `${val} BPM • Bradycardia Pace`;
      else if (val > 100) bpmStatus.textContent = `${val} BPM • Tachycardia Rhythm`;
      else bpmStatus.textContent = `${val} BPM • Sinus Rhythm`;
    }
  }
  if (bpmSlider) {
    bpmSlider.addEventListener('input', (e) => updateBpm(e.target.value));
    updateBpm(bpmSlider.value);
  }
}

/* ------------------------------------------------------------------
   Boot everything
------------------------------------------------------------------ */
initSplash();
buildModelGrid();
initViewer();