import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

// The 3D character (model, rig and animations) comes from
// github.com/akashrmalhotra/3d-portfolio (MIT, see models/LICENSE-character.txt).
// It ships AES-encrypted; this is the same runtime decryption that repo uses.

const TYPING_BONES = [
  "thighL", "thighR", "shinL", "shinR", "forearmL", "forearmR", "handL", "handR",
  "f_pinky03R", "f_pinky02L", "f_pinky02R", "f_pinky01L", "f_pinky01R", "palm04L", "palm04R",
  "f_ring01L", "thumb01L", "thumb01R", "thumb03L", "thumb03R", "palm02L", "palm02R",
  "palm01L", "palm01R", "f_index01L", "f_index01R", "palm03L", "palm03R", "f_ring02L",
  "f_ring02R", "f_ring01R", "f_ring03L", "f_ring03R", "f_middle01L", "f_middle02L",
  "f_middle03L", "f_middle01R", "f_middle02R", "f_middle03R", "f_index02L", "f_index03L",
  "f_index02R", "f_index03R", "thumb02L", "f_pinky03L", "upper_armL", "upper_armR",
  "thumb02R", "toeL", "heel02L", "toeR", "heel02R",
];
const BROW_BONES = ["eyebrow_L", "eyebrow_R"];

async function decryptFile(url, password) {
  const buf = await (await fetch(url)).arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const key = await crypto.subtle.importKey("raw", hash.slice(0, 32), { name: "AES-CBC" }, false, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-CBC", iv: new Uint8Array(buf.slice(0, 16)) }, key, buf.slice(16));
}

// keep only the tracks for the given bones (lets typing run on hands/legs only)
function boneClip(clips, name, bones) {
  const clip = THREE.AnimationClip.findByName(clips, name);
  if (!clip) return null;
  const tracks = clip.tracks.filter((t) => bones.some((b) => t.name.includes(b)));
  return new THREE.AnimationClip(name + "_filtered", clip.duration, tracks);
}

export function initScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(14.5, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 13.1, 24.7);
  camera.zoom = 1.1;
  camera.updateProjectionMatrix();

  // ----- lights (off until the loader finishes) -----
  const keyLight = new THREE.DirectionalLight(0x5eead4, 0);
  keyLight.position.set(-0.47, -0.32, -1);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const screenGlow = new THREE.PointLight(0x22d3ee, 0, 100, 3);
  screenGlow.position.set(3, 12, 4);
  scene.add(screenGlow);

  new RGBELoader().load("models/char_enviorment.hdr", (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = tex;
    scene.environmentIntensity = 0;
    scene.environmentRotation.set(5.76, 85.85, 1);
  });

  // ----- character -----
  let character = null;
  let mixer = null;
  let headBone = null;
  let neckBone = null;
  let screenLight = null;
  let monitor = null;
  let introAction = null;
  let browAction = null;
  let clips = [];

  const draco = new DRACOLoader();
  draco.setDecoderPath("draco/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const ready = decryptFile("models/character.enc", "MyCharacter12")
    .then((buf) => loader.loadAsync(URL.createObjectURL(new Blob([buf]))))
    .then(async (gltf) => {
      character = gltf.scene;
      clips = gltf.animations;
      await renderer.compileAsync(character, camera, scene);
      character.traverse((o) => {
        if (!o.isMesh) return;
        // clothing colours, as on the reference site
        if (o.name === "BODY.SHIRT") {
          o.material = o.material.clone();
          o.material.color = new THREE.Color("#8B4513");
        } else if (o.name === "Pant") {
          o.material = o.material.clone();
          o.material.color = new THREE.Color("#000000");
        }
        o.castShadow = o.receiveShadow = true;
      });
      character.getObjectByName("footR").position.y = 3.36;
      character.getObjectByName("footL").position.y = 3.36;
      headBone = character.getObjectByName("spine006");
      neckBone = character.getObjectByName("spine005");

      // the monitor and its glow start hidden and appear on scroll
      character.children.forEach((obj) => {
        if (obj.name === "Plane004") {
          obj.children.forEach((child) => {
            child.material.transparent = true;
            child.material.opacity = 0;
            if (child.material.name === "Material.018") {
              monitor = child;
              child.material.color.set("#FFFFFF");
            }
          });
        }
        if (obj.name === "screenlight") {
          obj.material.transparent = true;
          obj.material.opacity = 0;
          obj.material.emissive.set("#B0F5EA");
          screenLight = obj;
        }
      });

      // animations: intro, idle key presses, typing (hands only), blink, brow raise
      mixer = new THREE.AnimationMixer(character);
      introAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, "introAnimation"));
      introAction.setLoop(THREE.LoopOnce, 1);
      introAction.clampWhenFinished = true;
      introAction.play();
      ["key1", "key2", "key5", "key6"].forEach((n) => {
        const c = THREE.AnimationClip.findByName(clips, n);
        if (c) {
          const a = mixer.clipAction(c);
          a.timeScale = 1.2;
          a.play();
        }
      });
      const typing = mixer.clipAction(boneClip(clips, "typing", TYPING_BONES));
      typing.timeScale = 1.2;
      typing.play();
      browAction = mixer.clipAction(boneClip(clips, "browup", BROW_BONES));
      browAction.setLoop(THREE.LoopOnce, 1);
      browAction.clampWhenFinished = true;

      scene.add(character);
      draco.dispose();
      return character;
    });

  // ----- sizing -----
  const layout = { mobile: false };
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    layout.mobile = w <= 1024;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // ----- pointer: head follows the cursor, brows raise when hovering the face -----
  const mouse = { x: 0, y: 0, px: -1e4, py: -1e4 };
  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    mouse.px = e.clientX;
    mouse.py = e.clientY;
  });

  const headWorld = new THREE.Vector3();
  let hovering = false;
  function updateBrows() {
    if (!headBone || !browAction) return;
    headBone.getWorldPosition(headWorld);
    headWorld.project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    const sx = rect.left + ((headWorld.x + 1) / 2) * rect.width;
    const sy = rect.top + ((1 - headWorld.y) / 2) * rect.height;
    const over = window.scrollY < 200 && Math.hypot(mouse.px - sx, mouse.py - (sy - rect.height * 0.05)) < 140;
    if (over && !hovering) {
      browAction.reset();
      browAction.enabled = true;
      browAction.setEffectiveWeight(4);
      browAction.fadeIn(0.5).play();
    } else if (!over && hovering) {
      browAction.fadeOut(0.6);
    }
    hovering = over;
  }

  const lerp = THREE.MathUtils.lerp;
  function updateHead() {
    if (!headBone) return;
    if (window.scrollY < 200) {
      const max = Math.PI / 6;
      headBone.rotation.y = lerp(headBone.rotation.y, mouse.x * max, 0.2);
      const minX = -0.3;
      const maxX = 0.4;
      const targetX =
        mouse.y > minX ? (mouse.y < maxX ? -mouse.y - 0.5 * max : -max - 0.5 * max) : -minX - 0.5 * max;
      headBone.rotation.x = lerp(headBone.rotation.x, targetX, 0.1);
    } else if (!layout.mobile) {
      // looking at the monitor once it's on screen
      headBone.rotation.x = lerp(headBone.rotation.x, -0.4, 0.03);
      headBone.rotation.y = lerp(headBone.rotation.y, -0.3, 0.03);
    }
  }

  // flickering monitor glow
  let flicker = 0;
  setInterval(() => (flicker = Math.random()), 200);

  // ----- loop -----
  const clock = new THREE.Clock();
  let visible = true;
  function frame() {
    requestAnimationFrame(frame);
    const dt = clock.getDelta();
    if (!visible) return;
    updateHead();
    updateBrows();
    if (screenLight) {
      screenLight.material.emissiveIntensity = lerp(screenLight.material.emissiveIntensity, flicker * 8, 0.15);
      screenGlow.intensity = screenLight.material.opacity > 0.9 ? screenLight.material.emissiveIntensity * 20 : 0;
    }
    if (mixer) mixer.update(dt);
    renderer.render(scene, camera);
  }
  frame();

  // ----- public controls -----
  function turnOnLights(gsap) {
    gsap.to(scene, { environmentIntensity: 0.64, duration: 2, ease: "power2.inOut" });
    gsap.to(keyLight, { intensity: 1, duration: 2, ease: "power2.inOut" });
    gsap.to(".character-rim", { y: "55%", opacity: 1, delay: 0.2, duration: 2 });
    setTimeout(() => {
      if (!introAction) return;
      introAction.reset().play();
      setTimeout(() => {
        const blink = THREE.AnimationClip.findByName(clips, "Blink");
        if (blink) mixer.clipAction(blink).play().fadeIn(0.5);
      }, 2500);
    }, 400);
  }

  // scroll choreography, ported from the reference site
  function setupScroll(gsap) {
    if (!character) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1025px)", () => {
      gsap.timeline({ scrollTrigger: { trigger: "#landing", start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true } })
        .fromTo(character.rotation, { y: 0 }, { y: 0.7, duration: 1 }, 0)
        .to(camera.position, { z: 22 }, 0)
        .fromTo(container, { xPercent: 0 }, { xPercent: -25, duration: 1 }, 0)
        .to(".landing-left, .landing-right, .scroll-hint", { opacity: 0, duration: 0.4 }, 0)
        .to(".landing-left, .landing-right", { y: "40%", duration: 0.8 }, 0);

      gsap.timeline({ scrollTrigger: { trigger: "#about", start: "center 55%", end: "bottom top", scrub: true, invalidateOnRefresh: true } })
        .to(camera.position, { z: 75, y: 8.4, duration: 6, delay: 2, ease: "power3.inOut" }, 0)
        .to(".about-inner", { y: "30%", duration: 6 }, 0)
        .to(".about-inner", { opacity: 0, delay: 3, duration: 2 }, 0)
        .to(container, { xPercent: -12, delay: 2, duration: 5 }, 0)
        .to(character.rotation, { y: 0.92, x: 0.12, delay: 3, duration: 3 }, 0)
        .to(neckBone.rotation, { x: 0.6, delay: 2, duration: 3 }, 0)
        .to(monitor.material, { opacity: 1, duration: 0.8, delay: 3.2 }, 0)
        .to(screenLight.material, { opacity: 1, duration: 0.8, delay: 4.5 }, 0)
        .fromTo(monitor.position, { y: -10, z: 2 }, { y: 0, z: 0, delay: 1.5, duration: 3 }, 0)
        .fromTo(".character-rim", { opacity: 1, scaleX: 1.4 }, { opacity: 0, scale: 0, y: "-70%", duration: 5, delay: 2 }, 0.3);

      gsap.timeline({
        scrollTrigger: {
          trigger: "#whatido",
          start: "top top",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
          onLeave: () => (visible = false),
          onEnterBack: () => (visible = true),
        },
      })
        .fromTo(container, { yPercent: 0 }, { yPercent: -100, duration: 4, ease: "none", delay: 1 }, 0)
        .to(character.rotation, { x: -0.04, duration: 2, delay: 1 }, 0);
    });

    mm.add("(max-width: 1024px)", () => {
      gsap.timeline({
        scrollTrigger: {
          trigger: "#landing",
          start: "top top",
          end: "bottom top",
          scrub: 1,
          onLeave: () => (visible = false),
          onEnterBack: () => (visible = true),
        },
      }).to(container, { opacity: 0, yPercent: -20, ease: "none" }, 0);
    });
  }

  return { ready, turnOnLights, setupScroll, layout };
}
