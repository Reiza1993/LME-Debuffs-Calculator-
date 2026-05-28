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
  };

  // ---- state ----
  let medals = 0;
  let picks = {}; // milestone -> selected option index (number) or "skip"

  function loadStorage() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      medals = Number(s.medals) || 0;
      picks = s.picks && typeof s.picks === "object" ? s.picks : {};
    } catch (e) { /* ignore */ }
  }
  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify({ medals, picks }));
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

  function update() {
    medals = Math.max(0, Math.floor(Number(els.medals.value) || 0));
    renderReach();
    renderOptions();
    renderStatic();
    renderSummary();
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

  // ---- init ----
  loadStorage();
  tryLoadFromHash(); // a shared link overrides stored state
  els.medals.value = medals || "";
  update();
})();
