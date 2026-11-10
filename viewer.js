const hosts = document.querySelectorAll('.model3d');

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { io.unobserve(e.target); init(e.target); }
  });
}, { rootMargin: '300px' });
hosts.forEach((h) => {
  if (h.getBoundingClientRect().top < window.innerHeight + 300) init(h);
  else io.observe(h);
});

async function init(host) {
  const stage = host.querySelector('.model3d-stage');
  const status = host.querySelector('.model3d-status');
  const tabs = host.querySelectorAll('[data-src]');
  const resetBtn = host.querySelector('.model3d-reset');

  let THREE, STLLoader, OrbitControls;
  try {
    THREE = await import('three');
    ({ STLLoader } = await import('three/addons/loaders/STLLoader.js'));
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  } catch (err) {
    status.textContent = "Couldn't load the 3D viewer.";
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (err) {
    status.textContent = "3D isn't supported in this browser.";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd6e0, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(1, 1.2, 1.5);
  camera.add(key);
  const rim = new THREE.DirectionalLight(0xc7d7ff, 0.9);
  rim.position.set(-1.5, 0.6, -1);
  camera.add(rim);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.4;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    host.classList.add('touched');
  });

  const material = new THREE.MeshStandardMaterial({ color: 0x51627a, metalness: 0.25, roughness: 0.42 });
  const loader = new STLLoader();
  const cache = new Map();
  let mesh = null;
  let home = null;

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  function frameView() {
    camera.position.copy(home.pos);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  async function show(src) {
    host.classList.add('loading');
    status.textContent = 'Loading model…';
    try {
      if (!cache.has(src)) {
        const geo = await loader.loadAsync(src);
        geo.center();
        geo.computeBoundingSphere();
        cache.set(src, geo);
      }
      const geo = cache.get(src);
      if (mesh) scene.remove(mesh);
      mesh = new THREE.Mesh(geo, material);
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);

      const r = geo.boundingSphere.radius;
      const dist = (r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.0;
      home = { pos: new THREE.Vector3(1, 0.65, 1.1).normalize().multiplyScalar(dist) };
      camera.near = dist / 100;
      camera.far = dist * 10;
      camera.updateProjectionMatrix();
      controls.minDistance = r * 1.2;
      controls.maxDistance = dist * 2.5;
      frameView();
      status.textContent = '';
    } catch (err) {
      status.textContent = "Couldn't load this model.";
    }
    host.classList.remove('loading');
  }

  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => b.classList.toggle('active', b === btn));
      show(btn.dataset.src);
    });
  });

  resetBtn?.addEventListener('click', () => {
    if (!home) return;
    frameView();
    controls.autoRotate = true;
  });

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  const first = host.querySelector('[data-src].active') || tabs[0];
  show(first.dataset.src);
}
