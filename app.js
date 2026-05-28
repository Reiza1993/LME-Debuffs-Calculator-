(function () {
  "use strict";

  const DATA = window.LME_DATA || { options: [], static: [] };
  const SPECIAL_TYPES = new Set(["Supreme Arcanum HP"]);
  const FLAT_TYPES = new Set(["Defense"]);
  const STORE_KEY = "lme_debuff_state_v1";

  const els = {
    medals: document.getElementById("medals"),
    maxBtn: document.getElementById("maxBtn"),
    reachInfo: document.getElementById("reachInfo"),
    optionsList: document.getElementById("optionsList"),
    staticList: document.getElementById("staticList"),
    summary: document.getElementById("summary"),
    special: document.getElementById("specialUnlocks"),
    clearPicks: document.getElementById("clearPicks"),
    copyLink: document.getElementById("copyLink"),
    copySummary: document.getElementById("copySummary"),
    toast: document.getElementById("toast"),
    shareOut: document.getElementById("shareOut"),
    shareText: document.getElementById("shareText"),
    shareHint: document.getElementById("shareHint"),
    tabs: document.querySelectorAll(".tab"),
    tabManual: document.getElementById("tab-manual"),
    tabAuto: document.getElementById("tab-auto"),
    sliders: document.getElementById("sliders"),
    presets: document.getElementById("presets"),
    applyAuto: document.getElementById("applyAuto"),
    resetWeights: document.getElementById("resetWeights"),
    autoPreview: document.getElementById("autoPreview"),
  };

  // Debuff types that can appear as milestone options, ordered with the main
  // damage debuffs first. Used for the Auto-Pick priority sliders.
  const PRIORITY_ORDER = [
    "Crit Rate", "Crit Damage", "Weakened", "Chill",
    "Poison", "Shield", "Laceration", "Skill",
    "Vulnerability", "Damage to Bosses", "Xeno Pet Damage",
  ];
  const OPTION_TYPES = (() => {
    const set = new Set();
    DATA.options.forEach((r) => r.options.forEach((o) => set.add(o.type)));
    const ordered = PRIORITY_ORDER.filter((t) => set.has(t));
    [...set].forEach((t) => { if (!ordered.includes(t)) ordered.push(t); });
    return ordered;
  })();
  const DEFAULT_WEIGHT = 5;
  const MAX_WEIGHT = 10;

  const PRESETS = {
    "Balanced": null, // null = every type at DEFAULT_WEIGHT
    "Crit Focus": { "Crit Rate": 10, "Crit Damage": 10 },
    "Skill Nuke": { "Skill": 10, "Crit Damage": 8 },
    "Control": { "Chill": 10, "Poison": 9, "Weakened": 8 },
    "Defense Shred": { "Shield": 10, "Vulnerability": 9 },
  };

  // ---- state ----
  let medals = 0;
  let picks = {}; // milestone -> selected option index (number) or "skip"
  let weights = {}; // type -> priority 0..MAX_WEIGHT

  function defaultWeights() {
    const w = {};
    OPTION_TYPES.forEach((t) => { w[t] = DEFAULT_WEIGHT; });
    return w;
  }

  function loadStorage() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      medals = Number(s.medals) || 0;
      picks = s.picks && typeof s.picks === "object" ? s.picks : {};
      weights = defaultWeights();
      if (s.weights && typeof s.weights === "object") {
        OPTION_TYPES.forEach((t) => {
          if (typeof s.weights[t] === "number") weights[t] = s.weights[t];
        });
      }
    } catch (e) {
      weights = defaultWeights();
    }
  }
  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify({ medals, picks, weights }));
  }

  const fmtPct = (n) => (n > 0 ? "+" : "") + n + "%";
  const fmtNum = (n) => n.toLocaleString("en-US");

  // ---- shared totals computation ----
  function computeTotals() {
    const pct = {};   // type -> { total, picked, static }
    const flat = {};  // type -> total
    const unlocks = []; // labels

    function addPct(type, v, src) {
      if (!pct[type]) pct[type] = { total: 0, picked: 0, static: 0 };
      pct[type].total += v;
      pct[type][src] += v;
    }

    DATA.options
      .filter((o) => o.milestone <= medals)
      .forEach((row) => {
        const sel = picks[row.milestone];
        if (typeof sel === "number" && row.options[sel]) {
          addPct(row.options[sel].type, row.options[sel].pct, "picked");
        }
      });

    DATA.static
      .filter((s) => s.milestone <= medals)
      .forEach((s) => {
        if (SPECIAL_TYPES.has(s.type)) { unlocks.push(s.label); return; }
        if (FLAT_TYPES.has(s.type)) { flat[s.type] = (flat[s.type] || 0) + s.value; return; }
        addPct(s.type, s.value, "static");
      });

    return { pct, flat, unlocks };
  }

  // ---- render: milestone options ----
  function renderOptions() {
    const unlocked = DATA.options.filter((o) => o.milestone <= medals);
    els.optionsList.innerHTML = "";

    if (!unlocked.length) {
      els.optionsList.innerHTML =
        '<p class="empty">No milestone options unlocked yet. Enter your Testament Medals above.</p>';
      return;
    }

    unlocked.forEach((row) => {
      const block = document.createElement("div");
      block.className = "ms-block";
      block.dataset.ms = row.milestone;

      const head = document.createElement("div");
      head.className = "ms-head";
      const picked = picks[row.milestone];
      const skip = document.createElement("button");
      skip.className = "ms-skip";
      skip.textContent = picked === undefined || picked === "skip" ? "skip" : "clear pick";
      skip.addEventListener("click", () => {
        if (picks[row.milestone] === "skip" || picks[row.milestone] === undefined) {
          delete picks[row.milestone];
        } else {
          picks[row.milestone] = "skip";
        }
        update();
      });
      head.innerHTML = `<span class="ms-badge">${fmtNum(row.milestone)} medals</span>`;
      head.appendChild(skip);
      block.appendChild(head);

      const optRow = document.createElement("div");
      optRow.className = "opt-row";
      row.options.forEach((opt, i) => {
        const el = document.createElement("div");
        el.className = "opt" + (picks[row.milestone] === i ? " selected" : "");
        el.innerHTML = `<span class="ty">${opt.type}</span><span class="pc">${fmtPct(opt.pct)}</span>`;
        el.addEventListener("click", () => {
          const wasSelected = picks[row.milestone] === i;
          if (wasSelected) {
            delete picks[row.milestone];
          } else {
            picks[row.milestone] = i;
          }
          update();
          if (!wasSelected) scrollToNextMilestone(row.milestone);
        });
        optRow.appendChild(el);
      });
      block.appendChild(optRow);
      els.optionsList.appendChild(block);
    });
  }

  // After picking, scroll the options list to the next milestone block.
  function scrollToNextMilestone(currentMs) {
    const list = DATA.options
      .filter((o) => o.milestone <= medals)
      .map((o) => o.milestone)
      .sort((a, b) => a - b);
    const idx = list.indexOf(currentMs);
    const next = list[idx + 1];
    if (next == null) return;
    const container = els.optionsList;
    const el = container.querySelector(`[data-ms="${next}"]`);
    if (!el) return;
    const top =
      container.scrollTop +
      (el.getBoundingClientRect().top - container.getBoundingClientRect().top) -
      8;
    container.scrollTo({ top, behavior: "smooth" });
  }

  // ---- render: static milestones ----
  function renderStatic() {
    const unlocked = DATA.static.filter((s) => s.milestone <= medals);
    els.staticList.innerHTML = "";
    if (!unlocked.length) {
      els.staticList.innerHTML = '<p class="empty">No static milestones unlocked yet.</p>';
      return;
    }
    unlocked.forEach((s) => {
      const isSpecial = SPECIAL_TYPES.has(s.type);
      const row = document.createElement("div");
      row.className = "static-row" + (isSpecial ? " special" : "");
      let val;
      if (isSpecial) val = "Unlocked";
      else if (FLAT_TYPES.has(s.type)) val = fmtNum(s.value);
      else val = fmtPct(s.value);
      row.innerHTML =
        `<span class="sm">${fmtNum(s.milestone)}</span>` +
        `<span class="st">${s.label}</span>` +
        `<span class="sv">${val}</span>`;
      els.staticList.appendChild(row);
    });
  }

  // ---- render: summary ----
  function renderSummary() {
    const { pct, flat, unlocks } = computeTotals();
    const tiles = [];

    Object.keys(pct)
      .sort((a, b) => Math.abs(pct[b].total) - Math.abs(pct[a].total))
      .forEach((type) => {
        const d = pct[type];
        tiles.push(
          `<div class="sum-tile"><div class="label">${type}</div>` +
          `<div class="value ${d.total < 0 ? "neg" : ""}">${fmtPct(d.total)}</div>` +
          `<div class="breakdown">picked ${fmtPct(d.picked)} · static ${fmtPct(d.static)}</div></div>`
        );
      });

    Object.keys(flat).forEach((type) => {
      tiles.push(
        `<div class="sum-tile defense"><div class="label">${type} (flat)</div>` +
        `<div class="value">${fmtNum(flat[type])}</div>` +
        `<div class="breakdown">total flat reduction</div></div>`
      );
    });

    els.summary.innerHTML = tiles.length
      ? tiles.join("")
      : '<p class="empty">Nothing selected yet — pick options and/or raise your medals.</p>';

    els.special.innerHTML = unlocks
      .map((u) => `<span class="unlock-chip">🔓 ${u}</span>`)
      .join("");
  }

  function renderReach() {
    const nextOpt = DATA.options.find((o) => o.milestone > medals);
    const optUnlocked = DATA.options.filter((o) => o.milestone <= medals).length;
    const staticUnlocked = DATA.static.filter((s) => s.milestone <= medals).length;
    let txt = `<strong>${optUnlocked}</strong> option milestone(s) and <strong>${staticUnlocked}</strong> static milestone(s) unlocked.`;
    if (nextOpt) txt += ` Next option milestone at <strong>${fmtNum(nextOpt.milestone)}</strong> medals.`;
    els.reachInfo.innerHTML = txt;
  }

  // ---- auto-pick by priority ----
  // Allocate each unlocked milestone to one of its option types using the
  // divisor (Jefferson/D'Hondt) method, so a type with priority 8 wins roughly
  // twice as many contested milestones as one with priority 4. Maxing one type
  // therefore starves the others. Returns picks map + per-type totals/counts.
  function allocate(w) {
    const counts = {};
    const totals = {};
    const picksMap = {};
    OPTION_TYPES.forEach((t) => { counts[t] = 0; totals[t] = 0; });

    DATA.options
      .filter((o) => o.milestone <= medals)
      .sort((a, b) => a.milestone - b.milestone)
      .forEach((row) => {
        let best = null;
        row.options.forEach((opt, idx) => {
          const weight = w[opt.type] || 0;
          if (weight <= 0) return;
          const quotient = weight / (counts[opt.type] + 1);
          if (
            !best ||
            quotient > best.quotient + 1e-9 ||
            (Math.abs(quotient - best.quotient) < 1e-9 &&
              Math.abs(opt.pct) > Math.abs(best.opt.pct))
          ) {
            best = { idx, opt, quotient };
          }
        });
        if (best) {
          picksMap[row.milestone] = best.idx;
          counts[best.opt.type] += 1;
          totals[best.opt.type] += best.opt.pct;
        }
      });

    return { picksMap, counts, totals };
  }

  // Max % a type could reach if it had absolute priority everywhere it appears.
  function soloMax(type) {
    let total = 0;
    DATA.options
      .filter((o) => o.milestone <= medals)
      .forEach((row) => {
        const matches = row.options.filter((o) => o.type === type);
        if (matches.length) {
          total += Math.min(...matches.map((o) => o.pct)); // most negative
        }
      });
    return total;
  }

  function renderSliders() {
    els.sliders.innerHTML = "";
    OPTION_TYPES.forEach((type) => {
      const row = document.createElement("div");
      row.className = "slider-row" + (weights[type] === 0 ? " zero" : "");
      row.innerHTML =
        `<span class="s-name">${type}</span>` +
        `<input type="range" min="0" max="${MAX_WEIGHT}" step="1" value="${weights[type]}" data-type="${type}" />` +
        `<span class="s-out" data-out="${type}"></span>`;
      els.sliders.appendChild(row);
    });
    els.sliders.querySelectorAll('input[type="range"]').forEach((inp) => {
      inp.addEventListener("input", () => {
        weights[inp.dataset.type] = Number(inp.value);
        inp.closest(".slider-row").classList.toggle("zero", Number(inp.value) === 0);
        markActivePreset();
        renderAutoPreview();
        save();
      });
    });
  }

  function renderAutoPreview() {
    const { totals, counts } = allocate(weights);
    // update slider readouts: achieved vs solo-max
    OPTION_TYPES.forEach((type) => {
      const out = els.sliders.querySelector(`[data-out="${type}"]`);
      if (!out) return;
      const got = totals[type] || 0;
      const max = soloMax(type);
      out.innerHTML =
        `<b>${fmtPct(got)}</b> <span style="opacity:.6">/ max ${fmtPct(max)}</span>`;
    });

    const tiles = OPTION_TYPES
      .filter((t) => (totals[t] || 0) !== 0)
      .sort((a, b) => Math.abs(totals[b]) - Math.abs(totals[a]))
      .map(
        (t) =>
          `<div class="pv-tile"><div class="pv-t">${t}</div>` +
          `<div class="pv-v">${fmtPct(totals[t])}</div>` +
          `<div class="pv-sub">${counts[t]} milestone${counts[t] === 1 ? "" : "s"}</div></div>`
      );

    const totalPicks = OPTION_TYPES.reduce((s, t) => s + counts[t], 0);
    els.autoPreview.innerHTML =
      `<div class="pv-head">Preview — ${totalPicks} milestone pick(s) allocated. This does not change your build until you press Apply.</div>` +
      (tiles.length ? `<div class="pv-grid">${tiles.join("")}</div>` : '<p class="empty">Raise a priority above 0 to allocate picks.</p>');
  }

  function renderPresets() {
    els.presets.innerHTML = "";
    Object.keys(PRESETS).forEach((name) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.dataset.preset = name;
      b.addEventListener("click", () => {
        const preset = PRESETS[name];
        weights = defaultWeights();
        if (preset) {
          OPTION_TYPES.forEach((t) => { weights[t] = 1; }); // non-favoured baseline
          Object.keys(preset).forEach((t) => { if (t in weights) weights[t] = preset[t]; });
        }
        renderSliders();
        renderAutoPreview();
        markActivePreset();
        save();
      });
      els.presets.appendChild(b);
    });
  }

  function markActivePreset() {
    els.presets.querySelectorAll("button").forEach((b) => {
      const preset = PRESETS[b.dataset.preset];
      let match;
      if (preset === null) {
        match = OPTION_TYPES.every((t) => weights[t] === DEFAULT_WEIGHT);
      } else {
        match = OPTION_TYPES.every((t) =>
          (t in preset) ? weights[t] === preset[t] : weights[t] === 1
        );
      }
      b.classList.toggle("active", match);
    });
  }

  function update() {
    medals = Math.max(0, Math.floor(Number(els.medals.value) || 0));
    renderReach();
    renderOptions();
    renderStatic();
    renderSummary();
    renderAutoPreview();
    save();
  }

  // ---- share / export ----
  function encodeState() {
    return "s=" + btoa(JSON.stringify({ m: medals, p: picks }));
  }
  function tryLoadFromHash() {
    const h = (location.hash || "").replace(/^#/, "");
    if (!h.startsWith("s=")) return false;
    try {
      const obj = JSON.parse(atob(h.slice(2)));
      medals = Number(obj.m) || 0;
      picks = obj.p && typeof obj.p === "object" ? obj.p : {};
      return true;
    } catch (e) {
      return false;
    }
  }
  function shareUrl() {
    const base = location.href.split("#")[0];
    return base + "#" + encodeState();
  }

  // Try the async Clipboard API, fall back to execCommand on the visible field.
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error("clipboard-unavailable"));
  }

  function legacyCopy() {
    try {
      els.shareText.focus();
      els.shareText.select();
      els.shareText.setSelectionRange(0, els.shareText.value.length);
      return document.execCommand("copy");
    } catch (e) {
      return false;
    }
  }

  // Show the text in a selectable field and try to copy it to the clipboard.
  function offerCopy(text) {
    els.shareOut.hidden = false;
    els.shareText.value = text;
    copyText(text).then(
      () => {
        showToast("Copied to clipboard!");
        els.shareHint.textContent = "Copied! You can also select the text above to copy again.";
      },
      () => {
        const ok = legacyCopy();
        showToast(ok ? "Copied to clipboard!" : "Select the text above and copy (Ctrl/Cmd+C)");
        els.shareHint.textContent = ok
          ? "Copied! The text is also selectable above."
          : "Couldn't auto-copy here — the text is selected above, press Ctrl/Cmd+C.";
      }
    );
  }

  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function summaryText() {
    const { pct, flat, unlocks } = computeTotals();
    const lines = [];
    lines.push(`Survivor.io LME Debuffs — ${fmtNum(medals)} Testament Medals`);
    lines.push("");
    lines.push("Total debuff by type:");
    const ordered = Object.keys(pct).sort(
      (a, b) => Math.abs(pct[b].total) - Math.abs(pct[a].total)
    );
    if (ordered.length) {
      ordered.forEach((t) => lines.push(`  ${t}: ${fmtPct(pct[t].total)}`));
    } else {
      lines.push("  (none)");
    }
    Object.keys(flat).forEach((t) => lines.push(`  ${t} (flat): ${fmtNum(flat[t])}`));
    if (unlocks.length) {
      lines.push("");
      lines.push("Unlocked: " + unlocks.join(", "));
    }
    lines.push("");
    lines.push("Open this build: " + shareUrl());
    return lines.join("\n");
  }

  // ---- events ----
  els.medals.addEventListener("input", update);
  els.maxBtn.addEventListener("click", () => {
    const maxMs = Math.max(
      ...DATA.options.map((o) => o.milestone),
      ...DATA.static.map((s) => s.milestone)
    );
    els.medals.value = maxMs;
    update();
  });
  document.querySelectorAll(".quick-set button").forEach((b) => {
    b.addEventListener("click", () => {
      els.medals.value = b.dataset.set;
      update();
    });
  });
  els.clearPicks.addEventListener("click", () => {
    picks = {};
    update();
  });
  els.copyLink.addEventListener("click", () => {
    try { history.replaceState(null, "", "#" + encodeState()); } catch (e) { /* file:// */ }
    offerCopy(shareUrl());
  });
  els.copySummary.addEventListener("click", () => {
    offerCopy(summaryText());
  });

  // tabs
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      els.tabs.forEach((t) => t.classList.toggle("active", t === tab));
      const auto = tab.dataset.tab === "auto";
      els.tabAuto.hidden = !auto;
      els.tabManual.hidden = auto;
      if (auto) renderAutoPreview();
    });
  });

  els.applyAuto.addEventListener("click", () => {
    const { picksMap, counts } = allocate(weights);
    picks = picksMap;
    update();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    // jump to manual tab so the user can fine-tune the applied picks
    els.tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === "manual"));
    els.tabAuto.hidden = true;
    els.tabManual.hidden = false;
    showToast(`Applied ${total} auto-pick(s) — fine-tune them in Manual`);
  });

  els.resetWeights.addEventListener("click", () => {
    weights = defaultWeights();
    renderSliders();
    renderAutoPreview();
    markActivePreset();
    save();
  });

  // ---- init ----
  loadStorage();
  tryLoadFromHash(); // a shared link overrides stored state
  els.medals.value = medals || "";
  renderPresets();
  renderSliders();
  markActivePreset();
  update();
})();
