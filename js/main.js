import { initScene } from "./scene.js";

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

document.getElementById("year").textContent = new Date().getFullYear();

// ---------- split hero letters ----------
document.querySelectorAll(".split").forEach((el, wi) => {
  const text = el.textContent;
  el.textContent = "";
  [...text].forEach((ch, i) => {
    const s = document.createElement("span");
    s.className = "ch";
    s.textContent = ch;
    s.style.transitionDelay = `${0.15 + wi * 0.12 + i * 0.05}s`;
    el.appendChild(s);
  });
});

// ---------- seamless marquees (duplicate each track once) ----------
document.querySelectorAll(".marquee-track").forEach((track) => {
  track.innerHTML += track.innerHTML.replace(/<span>/g, '<span aria-hidden="true">');
});

// ---------- 3D scene ----------
const wrap = document.getElementById("canvasWrap");
const scene = initScene(wrap);

// ---------- loader ----------
const bar = document.getElementById("loaderBar");
const pct = document.getElementById("loaderPct");
const loader = document.getElementById("loader");
const progress = { v: 0 };
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

gsap.to(progress, {
  v: 90,
  duration: 1.2,
  ease: "power1.out",
  onUpdate: renderProgress,
});
Promise.all([fontsReady, scene.ready.catch((e) => console.error("Character failed to load", e))]).then(() => {
  gsap.to(progress, {
    v: 100,
    duration: 0.5,
    onUpdate: renderProgress,
    onComplete: start,
  });
});
function renderProgress() {
  const v = Math.round(progress.v);
  bar.style.width = v + "%";
  pct.textContent = v;
}

function start() {
  loader.classList.add("done");
  document.body.classList.remove("is-loading");
  document.body.classList.add("ready");
  scene.turnOnLights(gsap);
  startRoles();
  setupScroll();
}

// ---------- rotating role ----------
function startRoles() {
  const roles = [...document.querySelectorAll(".role")];
  let i = 0;
  setInterval(() => {
    const cur = roles[i];
    i = (i + 1) % roles.length;
    const next = roles[i];
    cur.classList.remove("is-active");
    cur.classList.add("is-leaving");
    next.classList.remove("is-leaving");
    next.classList.add("is-active");
    setTimeout(() => cur.classList.remove("is-leaving"), 850);
  }, 2600);
}

// ---------- cursor ----------
const cursor = document.getElementById("cursor");
const cur = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
window.addEventListener("pointermove", (e) => {
  cur.tx = e.clientX;
  cur.ty = e.clientY;
  cursor.style.opacity = 1;
});
document.addEventListener("pointerleave", () => (cursor.style.opacity = 0));
gsap.ticker.add(() => {
  cur.x += (cur.tx - cur.x) * 0.18;
  cur.y += (cur.ty - cur.y) * 0.18;
  cursor.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
});
document.querySelectorAll("[data-cursor]").forEach((el) => {
  el.addEventListener("pointerenter", () => cursor.classList.add("big"));
  el.addEventListener("pointerleave", () => cursor.classList.remove("big"));
});

// ---------- nav background ----------
const nav = document.querySelector(".nav");
window.addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 40), { passive: true });

// ---------- scroll choreography ----------
function setupScroll() {
  scene.setupScroll(gsap);

  // fade-up reveals
  const reveal = gsap.utils.toArray(
    ".about-inner > *, .whatido-title, .wid-card, .section-title, .tl-item, .project, .lead, .contact-title, .contact-grid"
  );
  reveal.forEach((el) => el.classList.add("fade-up"));
  ScrollTrigger.batch(reveal, {
    start: "top 88%",
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: "power3.out" }),
  });

  // timeline progress line
  gsap.to("#timelineFill", {
    height: "100%",
    ease: "none",
    scrollTrigger: { trigger: ".timeline", start: "top 70%", end: "bottom 60%", scrub: true },
  });
}
