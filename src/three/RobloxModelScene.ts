import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraPreset,
  RobloxMaterial,
  RobloxModelData,
  RobloxPartData,
  StudioTheme,
} from '../types/robloxModel';

export interface RobloxSceneController {
  isSoftwareGl: boolean;
  setModel: (model: RobloxModelData, selectedPartId: string | null) => void;
  setSelectedPart: (partId: string | null) => void;
  setTheme: (theme: StudioTheme) => void;
  setShowGrid: (show: boolean) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  focusSelectedOrCenter: () => void;
  dispose: () => void;
}

// Reusable math helpers outside render loops (zero GC)
const _center = new THREE.Vector3();
const _size = new THREE.Vector3();
const _box = new THREE.Box3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _pointer = new THREE.Vector2();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

/**
 * Exact 1x1x1 unit Wedge geometry matching Roblox WedgePart:
 * Back vertical wall at +Z (+0.5), flat bottom at -Y (-0.5),
 * slope descending from (+0.5 Y, +0.5 Z) to (-0.5 Y, -0.5 Z).
 */
function createRobloxWedgeGeometry(): THREE.BufferGeometry {
  const h = 0.5;
  // 6 vertices of the prism
  const bfl: [number, number, number] = [-h, -h, -h]; // bottom-front-left
  const bfr: [number, number, number] = [h, -h, -h];  // bottom-front-right
  const bbl: [number, number, number] = [-h, -h, h];  // bottom-back-left
  const bbr: [number, number, number] = [h, -h, h];   // bottom-back-right
  const tbl: [number, number, number] = [-h, h, h];   // top-back-left
  const tbr: [number, number, number] = [h, h, h];    // top-back-right

  const positions: number[] = [];
  const pushTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };

  // Bottom face (-Y)
  pushTri(bfl, bbl, bbr);
  pushTri(bfl, bbr, bfr);

  // Back face (+Z)
  pushTri(bbl, tbl, tbr);
  pushTri(bbl, tbr, bbr);

  // Sloped top-front face
  pushTri(bfl, bfr, tbr);
  pushTri(bfl, tbr, tbl);

  // Left triangle (-X)
  pushTri(bfl, tbl, bbl);

  // Right triangle (+X)
  pushTri(bfr, bbr, tbr);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function createStudCanvasTexture(isDark: boolean): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = isDark ? '#151e33' : '#e6ecf5';
    ctx.fillRect(0, 0, size, size);

    // Subtle Roblox stud pattern (4x4 studs per tile)
    const step = size / 4;
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 4; gy++) {
        const cx = gx * step + step * 0.5;
        const cy = gy * step + step * 0.5;

        ctx.beginPath();
        ctx.arc(cx, cy, step * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.045)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx - 1, cy - 1, step * 0.23, 0, Math.PI * 2);
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Crisp stud grid lines
    ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.09)' : 'rgba(15,23,42,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

function createPartMaterial(
  part: RobloxPartData,
  isSoftwareGl: boolean
): THREE.Material {
  const baseColor = new THREE.Color(part.color);
  const opacity = Math.max(0.05, 1 - part.transparency);
  const isTransparent = part.transparency > 0.01;
  const matType: RobloxMaterial = part.material;

  if (matType === 'Neon') {
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: baseColor,
      emissiveIntensity: 1.35,
      roughness: 0.22,
      metalness: 0.05,
      transparent: isTransparent,
      opacity,
    });
  }

  if (matType === 'Glass') {
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: 0.08,
      metalness: 0.05,
      ior: 1.5,
      transmission: isSoftwareGl ? 0 : Math.max(0.45, part.transparency),
      thickness: 0.6,
      transparent: true,
      opacity: isSoftwareGl ? Math.min(0.55, opacity) : Math.min(0.75, opacity),
    });
  }

  let roughness = 0.28;
  let metalness = 0.04;
  let clearcoat = 0;

  switch (matType) {
    case 'SmoothPlastic':
      roughness = 0.26;
      metalness = 0.04;
      clearcoat = 0.2;
      break;
    case 'Plastic':
      roughness = 0.45;
      metalness = 0.02;
      break;
    case 'Metal':
      roughness = 0.22;
      metalness = 0.88;
      break;
    case 'Wood':
      roughness = 0.82;
      metalness = 0.0;
      break;
    case 'Fabric':
      roughness = 0.94;
      metalness = 0.0;
      break;
    case 'Grass':
    case 'Sand':
      roughness = 0.9;
      metalness = 0.0;
      break;
    case 'Concrete':
    case 'Brick':
    case 'Granite':
      roughness = 0.85;
      metalness = 0.03;
      break;
    case 'Marble':
      roughness = 0.2;
      metalness = 0.05;
      clearcoat = 0.35;
      break;
    case 'Ice':
      roughness = 0.14;
      metalness = 0.05;
      clearcoat = 0.5;
      break;
  }

  if (clearcoat > 0) {
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness,
      metalness,
      clearcoat,
      clearcoatRoughness: 0.2,
      transparent: isTransparent,
      opacity,
    });
  }

  return new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness,
    metalness,
    transparent: isTransparent,
    opacity,
  });
}

export function mountRobloxModelScene(
  container: HTMLElement,
  initialModel: RobloxModelData,
  initialTheme: StudioTheme,
  onSelectPart: (partId: string | null) => void,
  onContextLost?: (lost: boolean) => void
): RobloxSceneController {
  const isSoftwareGl = detectSoftwareGl();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    44,
    Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
    0.1,
    250
  );
  camera.position.set(6.8, 4.8, 8.2);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  // Studio environment reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  pmremGenerator.dispose();

  // Three-point studio lighting
  const hemiLight = new THREE.HemisphereLight(0xf1f5f9, 0x94a3b8, 0.72);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.55);
  keyLight.position.set(10, 16, 12);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 45;
  keyLight.shadow.camera.left = -12;
  keyLight.shadow.camera.right = 12;
  keyLight.shadow.camera.top = 12;
  keyLight.shadow.camera.bottom = -12;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xc7d2fe, 0.65);
  rimLight.position.set(-10, 8, -12);
  scene.add(rimLight);

  // Ground baseplate with Roblox stud grid
  let studTexLight = createStudCanvasTexture(false);
  let studTexDark = createStudCanvasTexture(true);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  studTexLight.anisotropy = maxAniso;
  studTexDark.anisotropy = maxAniso;

  const baseplateGeo = new THREE.PlaneGeometry(64, 64);
  baseplateGeo.rotateX(-Math.PI / 2);
  const baseplateMat = new THREE.MeshStandardMaterial({
    map: initialTheme === 'dark' ? studTexDark : studTexLight,
    roughness: 0.88,
    metalness: 0.02,
  });
  const baseplateMesh = new THREE.Mesh(baseplateGeo, baseplateMat);
  baseplateMesh.position.y = 0;
  baseplateMesh.receiveShadow = true;
  scene.add(baseplateMesh);

  const gridHelper = new THREE.GridHelper(32, 32, 0x38bdf8, 0x94a3b8);
  gridHelper.position.y = 0.005;
  (gridHelper.material as THREE.Material).transparent = true;
  (gridHelper.material as THREE.Material).opacity = 0.25;
  scene.add(gridHelper);

  // Shared geometries for Roblox primitive parts
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const ballGeo = new THREE.SphereGeometry(0.5, 28, 20);
  const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
  cylinderGeo.rotateZ(Math.PI / 2); // Align axis along local X (matching Roblox Cylinder)
  const wedgeGeo = createRobloxWedgeGeometry();
  const selectionBoxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03, 1.03, 1.03));
  const selectionMat = new THREE.LineBasicMaterial({
    color: 0x0ea5e9,
    linewidth: 1,
    depthTest: true,
  });
  const selectionWireframe = new THREE.LineSegments(selectionBoxGeo, selectionMat);
  selectionWireframe.visible = false;
  selectionWireframe.renderOrder = 5;
  scene.add(selectionWireframe);

  // Model container group
  const modelGroup = new THREE.Group();
  scene.add(modelGroup);

  const partMeshes = new Map<string, THREE.Mesh>();
  let currentSelectedId: string | null = null;
  let currentTheme: StudioTheme = initialTheme;

  // Orbit controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.07;
  controls.minDistance = 2.2;
  controls.maxDistance = 42;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.target.set(0, 1.8, 0);

  // Camera transition state
  let camTransitionActive = false;
  let lastFrameTime = performance.now();

  // Coalesced on-demand rendering + software GL guard
  let frameId = 0;
  let renderBusy = false;
  let renderDirty = false;
  let disposed = false;

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function requestRender() {
    if (disposed) return;
    if (renderBusy) {
      renderDirty = true;
      return;
    }
    renderBusy = true;
    frameId = requestAnimationFrame(() => {
      if (disposed) return;
      renderDirty = false;
      const now = performance.now();
      const delta = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
      lastFrameTime = now;

      let keepAnimating = false;
      if (camTransitionActive) {
        if (isSoftwareGl) {
          camera.position.copy(_targetCamPos);
          controls.target.copy(_targetLookAt);
          camTransitionActive = false;
        } else {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 8, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 8, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 8, delta);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLookAt.x, 8, delta);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLookAt.y, 8, delta);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLookAt.z, 8, delta);

          if (
            camera.position.distanceTo(_targetCamPos) < 0.02 &&
            controls.target.distanceTo(_targetLookAt) < 0.02
          ) {
            camera.position.copy(_targetCamPos);
            controls.target.copy(_targetLookAt);
            camTransitionActive = false;
          } else {
            keepAnimating = true;
          }
        }
      }

      const dampingChanged = controls.update();
      renderer.render(scene, camera);

      const done = () => {
        renderBusy = false;
        if (renderDirty || keepAnimating || (controls.enableDamping && dampingChanged)) {
          requestRender();
        }
      };

      if (isSoftwareGl) afterDraw(done);
      else done();
    });
  }

  controls.addEventListener('change', requestRender);
  controls.addEventListener('start', () => {
    camTransitionActive = false;
  });

  function applyTheme(theme: StudioTheme) {
    currentTheme = theme;
    const isDark = theme === 'dark';
    const bgColor = isDark ? 0x0b1120 : 0xe9eff8;
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.Fog(bgColor, 26, 68);

    hemiLight.color.setHex(isDark ? 0x93c5fd : 0xf8fafc);
    hemiLight.groundColor.setHex(isDark ? 0x1e293b : 0x94a3b8);
    hemiLight.intensity = isDark ? 0.65 : 0.78;

    keyLight.intensity = isDark ? 1.45 : 1.55;
    baseplateMat.map = isDark ? studTexDark : studTexLight;
    baseplateMat.needsUpdate = true;

    (gridHelper.material as THREE.Material).opacity = isDark ? 0.2 : 0.24;
    requestRender();
  }

  function updateSelectionWireframe() {
    if (!currentSelectedId) {
      selectionWireframe.visible = false;
      return;
    }
    const mesh = partMeshes.get(currentSelectedId);
    if (!mesh) {
      selectionWireframe.visible = false;
      return;
    }
    selectionWireframe.visible = true;
    selectionWireframe.position.copy(mesh.position);
    selectionWireframe.rotation.copy(mesh.rotation);
    selectionWireframe.scale.copy(mesh.scale);
  }

  function rebuildModelMeshes(model: RobloxModelData, selectedPartId: string | null) {
    // Clear previous meshes & dispose their materials
    for (const mesh of partMeshes.values()) {
      modelGroup.remove(mesh);
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    partMeshes.clear();

    for (const p of model.parts) {
      let geo: THREE.BufferGeometry = blockGeo;
      let sx = p.size.x;
      let sy = p.size.y;
      let sz = p.size.z;

      if (p.shape === 'Ball') {
        geo = ballGeo;
        const d = Math.min(sx, sy, sz);
        sx = d;
        sy = d;
        sz = d;
      } else if (p.shape === 'Cylinder') {
        geo = cylinderGeo;
        const d = Math.min(sy, sz);
        sy = d;
        sz = d;
      } else if (p.shape === 'Wedge') {
        geo = wedgeGeo;
      }

      const mat = createPartMaterial(p, isSoftwareGl);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = p.name;
      mesh.userData.partId = p.id;
      mesh.position.set(p.position.x, p.position.y, p.position.z);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(p.rotation.x),
        THREE.MathUtils.degToRad(p.rotation.y),
        THREE.MathUtils.degToRad(p.rotation.z),
        'XYZ'
      );
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = !isSoftwareGl && p.transparency < 0.85;
      mesh.receiveShadow = !isSoftwareGl;

      modelGroup.add(mesh);
      partMeshes.set(p.id, mesh);
    }

    currentSelectedId = selectedPartId;
    updateSelectionWireframe();
    requestRender();
  }

  function computeModelBounds() {
    _box.makeEmpty();
    if (partMeshes.size === 0) {
      _center.set(0, 1.5, 0);
      _size.set(4, 3, 4);
      return;
    }
    for (const mesh of partMeshes.values()) {
      _box.expandByObject(mesh);
    }
    _box.getCenter(_center);
    _box.getSize(_size);
  }

  function moveCameraToPreset(preset: CameraPreset) {
    computeModelBounds();
    const maxDim = Math.max(_size.x, _size.y, _size.z, 3);
    const dist = maxDim * 1.65 + 1.8;
    _targetLookAt.copy(_center);

    switch (preset) {
      case 'front':
        _targetCamPos.set(_center.x, _center.y + maxDim * 0.15, _center.z + dist);
        break;
      case 'side':
        _targetCamPos.set(_center.x + dist, _center.y + maxDim * 0.2, _center.z);
        break;
      case 'top':
        _targetCamPos.set(_center.x, _center.y + dist * 1.15, _center.z + 0.01);
        break;
      case 'iso':
      default:
        _targetCamPos.set(
          _center.x + dist * 0.72,
          _center.y + dist * 0.48,
          _center.z + dist * 0.82
        );
        break;
    }
    camTransitionActive = true;
    requestRender();
  }

  // Tap / click raycasting (distinguishes tap vs orbit drag on mobile & desktop)
  const raycaster = new THREE.Raycaster();
  let downX = 0;
  let downY = 0;
  let downTime = 0;

  const onPointerDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
  };

  const onPointerUp = (e: PointerEvent) => {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    const dt = performance.now() - downTime;
    if (Math.hypot(dx, dy) > 8 || dt > 350) {
      return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(_pointer, camera);
    const meshes = Array.from(partMeshes.values());
    const hits = raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      const partId = hits[0].object.userData.partId as string | undefined;
      onSelectPart(partId ?? null);
    } else {
      onSelectPart(null);
    }
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  const handleContextLost = (e: Event) => {
    e.preventDefault();
    onContextLost?.(true);
  };
  const handleContextRestored = () => {
    onContextLost?.(false);
    requestRender();
  };
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

  const resizeObserver = new ResizeObserver(() => {
    if (disposed) return;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    requestRender();
  });
  resizeObserver.observe(container);

  // Initialize theme, model, and pre-warm shaders
  applyTheme(initialTheme);
  rebuildModelMeshes(initialModel, null);
  moveCameraToPreset('iso');
  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }
  requestRender();

  return {
    isSoftwareGl,
    setModel(model: RobloxModelData, selectedPartId: string | null) {
      rebuildModelMeshes(model, selectedPartId);
    },
    setSelectedPart(partId: string | null) {
      currentSelectedId = partId;
      updateSelectionWireframe();
      requestRender();
    },
    setTheme(theme: StudioTheme) {
      if (theme !== currentTheme) {
        applyTheme(theme);
      }
    },
    setShowGrid(show: boolean) {
      gridHelper.visible = show;
      requestRender();
    },
    setCameraPreset(preset: CameraPreset) {
      moveCameraToPreset(preset);
    },
    focusSelectedOrCenter() {
      moveCameraToPreset('iso');
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      for (const mesh of partMeshes.values()) {
        if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
        else mesh.material.dispose();
      }
      partMeshes.clear();

      blockGeo.dispose();
      ballGeo.dispose();
      cylinderGeo.dispose();
      wedgeGeo.dispose();
      selectionBoxGeo.dispose();
      selectionMat.dispose();
      baseplateGeo.dispose();
      baseplateMat.dispose();
      studTexLight.dispose();
      studTexDark.dispose();
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
