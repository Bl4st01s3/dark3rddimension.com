// Shared hologram projector sound effects.
// Usage: window.D3DSound.play("change" | "turnOn" | "move", { volume, cooldown })
//
// NOTE: Browsers block audio until the visitor has interacted with the page
// (a click, tap, or key press). Hover-only sounds will start working after
// the first interaction.
(function () {
  const BASE = "assets/Sounds/Final Sounds/";

  const FILES = {
    change: "Hologram Change.mp3",          // Hologram projector changes what it is displaying
    turnOn: "Projector_Turn_on_Sound.mp3",  // A projector powers on (e.g. menu projector on hover)
    move: "Hologram_Projector_Move.mp3"     // A projector head tilts / swivels
  };

  const DEFAULT_VOLUME = {
    change: 0.6,
    turnOn: 0.55,
    move: 0.35
  };

  // A small pool per sound so rapid triggers can overlap instead of cutting each other off
  const POOL_SIZE = 3;
  const pools = {};
  const lastPlayed = {};

  Object.keys(FILES).forEach((key) => {
    const src = encodeURI(BASE + FILES[key]);
    const items = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const audio = new Audio(src);
      audio.preload = "auto";
      items.push(audio);
    }
    pools[key] = { items, next: 0 };
  });

  function play(key, options = {}) {
    const pool = pools[key];
    if (!pool) return null;

    const now = performance.now();
    const cooldown = options.cooldown || 0;
    if (lastPlayed[key] && now - lastPlayed[key] < cooldown) return null;
    lastPlayed[key] = now;

    const audio = pool.items[pool.next];
    pool.next = (pool.next + 1) % pool.items.length;

    const volume = options.volume ?? DEFAULT_VOLUME[key] ?? 0.5;
    audio.volume = Math.max(0, Math.min(1, volume));

    try {
      audio.currentTime = 0;
    } catch (_) {
      // Ignore if metadata hasn't loaded yet
    }

    const promise = audio.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        // Autoplay blocked until the user interacts with the page — fail silently
      });
    }
    return audio;
  }

  function stop(key) {
    const pool = pools[key];
    if (!pool) return;
    pool.items.forEach((audio) => {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch (_) {
        // Ignore
      }
    });
  }

  window.D3DSound = { play, stop };
})();

