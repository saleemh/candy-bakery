/*
  Candy Bakery - a small desktop browser game.
  No frameworks, just DOM.

  Gameplay:
  - Customers arrive with a requested combination: up to 5 candies with counts and sometimes rules (exact, at least).
  - Player builds a combo by clicking bins (adds to tray) and serves.
  - Scoring: perfect match = big tip; close match = small tip; wrong/timeout = no coins.
  - Day lasts fixed time; summary screen at end.
*/

(function() {
  "use strict";

  // ------------- Data -------------
  const CANDIES = [
    { id: "berry",   name: "Berry Pop",     colorClass: "c-berry",     emoji: "🍓" },
    { id: "lemon",   name: "Lemon Drop",    colorClass: "c-lemon",     emoji: "🍋" },
    { id: "lime",    name: "Lime Slice",    colorClass: "c-lime",      emoji: "🟢" },
    { id: "grape",   name: "Grape Gem",     colorClass: "c-grape",     emoji: "🍇" },
    { id: "blue",    name: "Blueberry",     colorClass: "c-blue",      emoji: "🔵" },
    { id: "choco",   name: "Choco Bite",    colorClass: "c-choco",     emoji: "🍫" },
    { id: "vanilla", name: "Vanilla Fudge", colorClass: "c-vanilla",   emoji: "🧈" },
    { id: "cola",    name: "Cola Chew",     colorClass: "c-cola",      emoji: "🥤" },
    { id: "gum",     name: "Bubble Gum",    colorClass: "c-bubblegum", emoji: "🍬" },
    { id: "mint",    name: "Mint Leaf",     colorClass: "c-mint",      emoji: "🌿" },
  ];

  const GAME_CONFIG = {
    dayLengthSeconds: 120, // 2 minutes
    patienceSeconds: 25,
    trayMax: 12,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ------------- State -------------
  const state = {
    day: 1,
    timeLeft: GAME_CONFIG.dayLengthSeconds,
    coins: 0,
    served: 0,
    perfect: 0,
    ok: 0,
    failed: 0,
    tray: [], // array of candy ids
    currentOrder: null,
    currentPatience: GAME_CONFIG.patienceSeconds,
    timers: {
      day: null,
      patience: null,
      spawn: null,
    },
  };

  // ------------- Utility -------------
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function sample(array, n) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }
  function countBy(array) {
    const map = new Map();
    for (const id of array) map.set(id, (map.get(id) || 0) + 1);
    return map;
  }

  // ------------- Rendering Helpers -------------
  function createCandyChip(candy, small = false) {
    const div = document.createElement("div");
    div.className = `candy-chip ${candy.colorClass}${small ? " small" : ""}`;
    div.title = candy.name;
    div.textContent = candy.emoji;
    return div;
  }

  function setScreen(id) {
    $$(".screen").forEach(s => s.classList.remove("visible"));
    $(id).classList.add("visible");
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ------------- Orders -------------
  // Order shape: { items: Map<candyId, count>, mode: 'exact'|'atleast' } 
  function generateOrder(day) {
    const distinct = randInt(2, Math.min(4, 2 + Math.floor(day / 2)));
    const chosen = sample(CANDIES, distinct);
    const items = new Map();
    chosen.forEach((c) => items.set(c.id, randInt(1, 3)));
    const mode = Math.random() < 0.75 ? "exact" : "atleast";
    return { items, mode };
  }

  function renderOrder(order) {
    const textEl = $("#order-text");
    const visual = $("#order-visual");

    const parts = [];
    for (const [id, count] of order.items.entries()) {
      const candy = CANDIES.find(c => c.id === id);
      parts.push(`${count} ${candy.name}${count > 1 ? "s" : ""}`);
    }
    const join = parts.length === 2 ? parts.join(" and ") : parts.join(", ");
    textEl.textContent = order.mode === "exact"
      ? `I want exactly ${join}.`
      : `At least ${join}, please!`;

    visual.innerHTML = "";
    for (const [id, count] of order.items.entries()) {
      const candy = CANDIES.find(c => c.id === id);
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.append(`${count}× `);
      for (let i = 0; i < Math.min(3, count); i++) {
        pill.appendChild(createCandyChip(candy, true));
      }
      if (count > 3) pill.append("…");
      visual.appendChild(pill);
    }
  }

  function evaluateTray(order, tray) {
    const required = order.items;
    const actual = countBy(tray);

    // Determine correctness based on mode
    let perfect = true;
    let ok = true;

    for (const [id, need] of required.entries()) {
      const have = actual.get(id) || 0;
      if (order.mode === "exact") {
        if (have !== need) { perfect = false; }
        if (have === 0) ok = false;
      } else if (order.mode === "atleast") {
        if (have < need) { perfect = false; ok = false; }
      }
    }

    if (order.mode === "exact") {
      // Ensure no extra candy in exact mode
      const extraIds = Array.from(actual.keys()).filter(id => !required.has(id));
      if (extraIds.length > 0) { perfect = false; ok = false; }
      // Also ensure counts match for all
      for (const [id, cnt] of actual.entries()) {
        if ((required.get(id) || 0) !== cnt) perfect = false;
      }
    }

    return { perfect, ok: ok || perfect };
  }

  // ------------- Game Flow -------------
  function setupBins() {
    const bins = $("#bins-grid");
    bins.innerHTML = "";
    CANDIES.forEach(candy => {
      const bin = document.createElement("button");
      bin.className = "bin";
      bin.innerHTML = "";

      const chip = createCandyChip(candy);
      bin.appendChild(chip);
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = candy.name;
      bin.appendChild(label);

      const example = document.createElement("div");
      example.className = "example";
      [1,2].forEach(() => example.appendChild(createCandyChip(candy, true)));
      bin.appendChild(example);

      bin.addEventListener("click", () => {
        addCandyToTray(candy.id);
      });
      bins.appendChild(bin);
    });
  }

  function renderTray() {
    const trayGrid = $("#tray-grid");
    trayGrid.innerHTML = "";
    state.tray.forEach(id => {
      const candy = CANDIES.find(c => c.id === id);
      trayGrid.appendChild(createCandyChip(candy));
    });
  }

  function addCandyToTray(candyId) {
    if (!state.currentOrder) return;
    if (state.tray.length >= GAME_CONFIG.trayMax) {
      showMessage("Tray is full!");
      return;
    }
    state.tray.push(candyId);
    renderTray();
    pulseMessage("Added to tray.");
  }

  function clearTray() {
    state.tray = [];
    renderTray();
  }

  function undoTray() {
    state.tray.pop();
    renderTray();
  }

  function serveTray() {
    if (!state.currentOrder) return;
    const { perfect, ok } = evaluateTray(state.currentOrder, state.tray);
    let coins = 0;
    if (perfect) {
      coins = 8 + Math.max(0, Math.floor(state.currentPatience / 5));
      state.perfect += 1;
      showMessage("Perfect! The customer is delighted ✨");
    } else if (ok) {
      coins = 4 + Math.max(0, Math.floor(state.currentPatience / 10));
      state.ok += 1;
      showMessage("Pretty good! They seem satisfied 😊");
    } else {
      coins = 0;
      state.failed += 1;
      showMessage("Oops, that's not what they wanted 😕");
    }
    state.coins += coins;
    state.served += 1;
    updateHud();
    endCurrentCustomer();
  }

  function updateHud() {
    $("#label-day").textContent = String(state.day);
    $("#label-time").textContent = formatTime(state.timeLeft);
    $("#label-coins").textContent = String(state.coins);
  }

  function showMessage(text) {
    const el = $("#message");
    el.textContent = text;
  }
  function pulseMessage(text) {
    const el = $("#message");
    el.textContent = text;
    el.classList.remove("pulse");
    void el.offsetWidth; // restart animation
    el.classList.add("pulse");
    setTimeout(() => el.classList.remove("pulse"), 350);
  }

  function nextCustomer() {
    state.currentOrder = generateOrder(state.day);
    state.currentPatience = GAME_CONFIG.patienceSeconds;
    renderOrder(state.currentOrder);
    clearTray();
    updatePatienceBar();
  }

  function updatePatienceBar() {
    const pct = Math.max(0, Math.min(1, state.currentPatience / GAME_CONFIG.patienceSeconds));
    $("#patience-bar").style.width = `${pct * 100}%`;
  }

  function tickPatience() {
    if (!state.currentOrder) return;
    state.currentPatience -= 1;
    updatePatienceBar();
    if (state.currentPatience <= 0) {
      state.failed += 1;
      showMessage("Customer left... time's up! 😭");
      endCurrentCustomer();
    }
  }

  function endCurrentCustomer() {
    state.currentOrder = null;
    state.tray = [];
    renderTray();
    // Short delay then spawn next
    clearInterval(state.timers.patience);
    setTimeout(() => {
      nextCustomer();
      clearInterval(state.timers.patience);
      state.timers.patience = setInterval(tickPatience, 1000);
    }, 800);
  }

  function startDay() {
    state.timeLeft = GAME_CONFIG.dayLengthSeconds;
    state.coins = 0;
    state.served = 0; state.perfect = 0; state.ok = 0; state.failed = 0;
    updateHud();
    setScreen("#screen-game");
    setupBins();
    nextCustomer();

    clearInterval(state.timers.day);
    state.timers.day = setInterval(() => {
      state.timeLeft -= 1;
      updateHud();
      if (state.timeLeft <= 0) {
        endDay();
      }
    }, 1000);

    clearInterval(state.timers.patience);
    state.timers.patience = setInterval(tickPatience, 1000);
  }

  function endDay() {
    clearInterval(state.timers.day);
    clearInterval(state.timers.patience);

    // Populate summary
    $("#summary-day").textContent = String(state.day);
    $("#summary-served").textContent = String(state.served);
    $("#summary-perfect").textContent = String(state.perfect);
    $("#summary-ok").textContent = String(state.ok);
    $("#summary-failed").textContent = String(state.failed);
    $("#summary-coins").textContent = String(state.coins);

    setScreen("#screen-summary");
  }

  function nextDay() {
    state.day += 1;
    startDay();
  }

  function restart() {
    state.day = 1;
    setScreen("#screen-storefront");
  }

  // ------------- Events -------------
  function wireUi() {
    $("#btn-start").addEventListener("click", startDay);
    $("#btn-next-day").addEventListener("click", nextDay);
    $("#btn-restart").addEventListener("click", restart);
    $("#btn-clear").addEventListener("click", clearTray);
    $("#btn-undo").addEventListener("click", undoTray);
    $("#btn-serve").addEventListener("click", serveTray);

    // Simple keyboard shortcuts for speed
    window.addEventListener("keydown", (e) => {
      if (!$("#screen-game").classList.contains("visible")) return;
      if (e.key === "Enter") serveTray();
      if (e.key === "Backspace") undoTray();
      if (e.key.toLowerCase() === "c") clearTray();
      const num = parseInt(e.key, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= CANDIES.length) {
        addCandyToTray(CANDIES[num - 1].id);
      }
    });
  }

  // ------------- Init -------------
  function init() {
    wireUi();
    updateHud();
    setScreen("#screen-storefront");
  }

  document.addEventListener("DOMContentLoaded", init);
})();


