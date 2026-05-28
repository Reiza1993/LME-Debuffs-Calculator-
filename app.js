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
    allocList: document.getElementById("allocList"),
    allocSummary: document.getElementById("allocSummary"),
    balanceBtn: document.getElementById("balanceBtn"),
    clearAllocBtn: document.getElementById("clearAllocBtn"),
    applyAuto: document.getElementById("applyAuto"),
  };

  // Debuff types that appear as milestone options, main damage debuffs first.
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

  // ---- state ----
  let medals = 0;
  let picks = {};   // milestone -> selected option index (number) or "skip"
  let target = {};  // stat -> desired total magnitude (%) from the allocation tab
  let assign = {};  // milestone -> option index, the allocation-tab assignment
  let allocTouched = false; // once the user edits the allocation, stop auto-balancing

  function loadStorage() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      medals = Number(s.medals) || 0;
      picks = s.picks && typeof s.picks === "object" ? s.picks : {};
      target = s.target && typeof s.target === "object" ? s.target : {};
      assign = s.assign && typeof s.assign === "object" ? s.assign : {};
      allocTouched = !!s.allocTouched;
    } catch (e) { /* ignore */ }
  }
  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify({ medals, picks, target, assign, allocTouched }));
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
      (el.getBoundingClientRect().top - container.getBoundingClientRect().top) - 8;
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

  // =========================================================================
  //  ALLOCATION TAB — sliders measured in total % picked per debuff type
  // =========================================================================
  const unlockedRows = () => DATA.options.filter((o) => o.milestone <= medals);

  // Best (most negative) option index for a given stat within a milestone row.
  function offerIndex(row, stat) {
    let best = -1, bestPct = 0;
    row.options.forEach((o, i) => {
      if (o.type === stat && (best < 0 || o.pct < bestPct)) { best = i; bestPct = o.pct; }
    });
    return best;
  }

  // Smallest option magnitude for a stat among free / its own / others' milestones.
  function smallestFreeChunk(s) {
    let m = null;
    unlockedRows().forEach((r) => {
      if (assign[r.milestone] != null) return;
      const i = offerIndex(r, s);
      if (i >= 0) { const mag = Math.abs(r.options[i].pct); if (m == null || mag < m) m = mag; }
    });
    return m;
  }
  function smallestAssignedChunk(s) {
    let m = null;
    unlockedRows().forEach((r) => {
      const oi = assign[r.milestone];
      if (oi != null && r.options[oi].type === s) {
        const mag = Math.abs(r.options[oi].pct); if (m == null || mag < m) m = mag;
      }
    });
    return m;
  }
  function smallestOtherChunk(s) {
    let m = null;
    unlockedRows().forEach((r) => {
      const oi = assign[r.milestone];
      if (oi != null && r.options[oi].type !== s) {
        const i = offerIndex(r, s);
        if (i >= 0) { const mag = Math.abs(r.options[i].pct); if (m == null || mag < m) m = mag; }
      }
    });
    return m;
  }

  // Nudge a stat by one milestone via the +/- buttons.
  function stepStat(s, dir) {
    const picked = Math.abs(pickedByStat()[s]);
    if (dir < 0) {
      const sm = smallestAssignedChunk(s);
      target[s] = sm == null ? 0 : Math.max(0, picked - sm);
    } else {
      const free = smallestFreeChunk(s);
      if (free != null) {
        target[s] = picked + free;            // claim one free milestone
      } else {
        const other = smallestOtherChunk(s);  // none free: ask beyond max -> flags blockers
        target[s] = picked + (other != null ? other : 5);
      }
    }
    allocTouched = true;
    normalize();
    refreshAlloc();
    save();
  }

  // Picked % per stat from the current `assign`.
  function pickedByStat() {
    const t = {};
    OPTION_TYPES.forEach((s) => { t[s] = 0; });
    unlockedRows().forEach((row) => {
      const oi = assign[row.milestone];
      if (oi != null && row.options[oi]) t[row.options[oi].type] += row.options[oi].pct;
    });
    return t;
  }

  // Fixed static % per stat (excludes flat Defense and special unlocks).
  function staticByStat() {
    const t = {};
    DATA.static.filter((s) => s.milestone <= medals).forEach((s) => {
      if (SPECIAL_TYPES.has(s.type) || FLAT_TYPES.has(s.type)) return;
      t[s.type] = (t[s.type] || 0) + s.value;
    });
    return t;
  }

  // Absolute ceiling: % if this stat claimed the best option in every milestone
  // that offers it (ignoring all other stats).
  function soloMax(stat) {
    let total = 0;
    unlockedRows().forEach((row) => {
      const i = offerIndex(row, stat);
      if (i >= 0) total += row.options[i].pct;
    });
    return Math.abs(total);
  }

  // Balanced seed: spread picks evenly using an equal-weight divisor method.
  function balancedAlloc() {
    const counts = {};
    OPTION_TYPES.forEach((s) => { counts[s] = 0; });
    const a = {};
    unlockedRows()
      .slice()
      .sort((x, y) => x.milestone - y.milestone)
      .forEach((row) => {
        let best = null;
        row.options.forEach((opt, idx) => {
          const q = 1 / (counts[opt.type] + 1);
          if (
            !best || q > best.q + 1e-9 ||
            (Math.abs(q - best.q) < 1e-9 && Math.abs(opt.pct) > Math.abs(best.opt.pct))
          ) {
            best = { idx, opt, q };
          }
        });
        if (best) { a[row.milestone] = best.idx; counts[best.opt.type] += 1; }
      });
    return a;
  }

  function initBalanced() {
    assign = balancedAlloc();
    const picked = pickedByStat();
    target = {};
    OPTION_TYPES.forEach((s) => { target[s] = Math.abs(picked[s]); });
  }

  // Re-derive a feasible assignment from the user's `target` wishes.
  // Releases over-target picks, then fills unmet stats from the free pool
  // (never stealing from a satisfied stat — that's what the red flags are for).
  function normalize() {
    // ensure every type has a target and assign is within unlocked range
    Object.keys(assign).forEach((ms) => { if (Number(ms) > medals) delete assign[ms]; });
    OPTION_TYPES.forEach((s) => {
      if (typeof target[s] !== "number") target[s] = Math.abs(pickedByStat()[s]);
      target[s] = Math.max(0, Math.min(target[s], soloMax(s)));
    });

    // 1) release where we hold more than the target (drop smallest chunks first)
    OPTION_TYPES.forEach((s) => {
      let picked = Math.abs(pickedByStat()[s]);
      if (picked <= target[s] + 1e-9) return;
      const mine = unlockedRows()
        .filter((r) => assign[r.milestone] != null && r.options[assign[r.milestone]].type === s)
        .sort((a, b) => Math.abs(a.options[assign[a.milestone]].pct) - Math.abs(b.options[assign[b.milestone]].pct));
      for (const r of mine) {
        if (picked <= target[s] + 1e-9) break;
        picked -= Math.abs(r.options[assign[r.milestone]].pct);
        delete assign[r.milestone];
      }
    });

    // 2) fill unmet stats from currently-unassigned milestones (no overshoot)
    let progress = true;
    let guard = 0;
    while (progress && guard++ < 5000) {
      progress = false;
      const picked = pickedByStat();
      const unmet = OPTION_TYPES
        .map((s) => ({ s, deficit: target[s] - Math.abs(picked[s]) }))
        .filter((x) => x.deficit > 1e-9)
        .sort((a, b) => b.deficit - a.deficit);
      for (const { s, deficit } of unmet) {
        const cand = unlockedRows()
          .filter((r) => assign[r.milestone] == null && offerIndex(r, s) >= 0)
          .map((r) => ({ r, oi: offerIndex(r, s), mag: Math.abs(r.options[offerIndex(r, s)].pct) }))
          .filter((c) => c.mag <= deficit + 1e-9)
          .sort((a, b) => b.mag - a.mag);
        if (cand.length) { assign[cand[0].r.milestone] = cand[0].oi; progress = true; break; }
      }
    }
  }

  // Returns achieved %, dynamic max, and which stats block each unmet stat.
  function allocState() {
    const picked = pickedByStat();
    const stat = staticByStat();
    const free = unlockedRows().filter((r) => assign[r.milestone] == null);

    const rows = {};
    const blockers = new Set();
    OPTION_TYPES.forEach((s) => {
      const got = Math.abs(picked[s]);
      const freeForS = free.reduce((sum, r) => {
        const i = offerIndex(r, s);
        return i >= 0 ? sum + Math.abs(r.options[i].pct) : sum;
      }, 0);
      const softMax = got + freeForS; // reachable now without touching others
      const deficit = target[s] - got;
      const wanting = deficit > 1e-9;

      // stats currently holding a milestone that could serve S (and fits the gap)
      const holders = new Set();
      if (wanting) {
        unlockedRows().forEach((r) => {
          const oi = assign[r.milestone];
          if (oi == null) return;
          const held = r.options[oi].type;
          if (held === s) return;
          const i = offerIndex(r, s);
          if (i >= 0 && Math.abs(r.options[i].pct) <= deficit + 1e-9) holders.add(held);
        });
      }
      const realWant = wanting && holders.size > 0;
      if (realWant) holders.forEach((h) => blockers.add(h));

      rows[s] = {
        picked: -got,
        total: -(got + Math.abs(stat[s] || 0)),
        target: realWant ? target[s] : got, // snap target to reality unless genuinely blocked
        softMax,
        solo: soloMax(s),
        wanting: realWant,
        holders: [...holders],
      };
      if (!realWant) target[s] = got; // keep slider honest when nothing is blocking
    });

    return { rows, blockers, freeCount: free.length };
  }

  function renderAllocList() {
    els.allocList.innerHTML = "";
    const stats = OPTION_TYPES.filter((s) => soloMax(s) > 0);
    if (!stats.length) {
      els.allocList.innerHTML = '<p class="empty">No option milestones unlocked yet — raise your medals.</p>';
      els.allocSummary.innerHTML = "";
      return;
    }
    stats.forEach((s) => {
      const row = document.createElement("div");
      row.className = "alloc-row";
      row.dataset.stat = s;
      row.innerHTML =
        `<div class="a-top">` +
        `<span class="a-name">${s}<span class="blk-tag" hidden>↓ reduce</span></span>` +
        `<span class="a-read"></span></div>` +
        `<div class="a-ctl">` +
        `<button type="button" class="a-step a-minus" aria-label="Decrease ${s}">−</button>` +
        `<input type="range" min="0" step="5" />` +
        `<button type="button" class="a-step a-plus" aria-label="Increase ${s}">+</button>` +
        `</div>` +
        `<div class="a-bar"><span class="a-fill"></span><span class="a-room"></span><span class="a-short"></span></div>`;
      const input = row.querySelector("input");
      input.addEventListener("input", () => {
        allocTouched = true;
        target[s] = Number(input.value);
        normalize();
        refreshAlloc();
        save();
      });
      row.querySelector(".a-minus").addEventListener("click", () => stepStat(s, -1));
      row.querySelector(".a-plus").addEventListener("click", () => stepStat(s, 1));
      els.allocList.appendChild(row);
    });
    refreshAlloc();
  }

  // Update dynamic parts without rebuilding inputs (keeps drag smooth).
  function refreshAlloc() {
    const { rows, blockers, freeCount } = allocState();
    els.allocList.querySelectorAll(".alloc-row").forEach((row) => {
      const s = row.dataset.stat;
      const d = rows[s];
      if (!d) return;
      const input = row.querySelector("input");
      const solo = Math.max(1, d.solo);
      input.max = d.solo;
      if (document.activeElement !== input) input.value = d.target;

      const got = Math.abs(d.picked);
      const fillPct = (got / solo) * 100;
      const roomPct = (Math.max(0, d.softMax - got) / solo) * 100; // headroom you can still claim now
      const shortPct = d.wanting ? (Math.max(0, d.target - d.softMax) / solo) * 100 : 0; // needs others freed
      row.querySelector(".a-fill").style.width = fillPct + "%";
      row.querySelector(".a-room").style.width = roomPct + "%";
      row.querySelector(".a-short").style.width = shortPct + "%";

      row.classList.toggle("blocker", blockers.has(s));
      row.classList.toggle("wanting", d.wanting);
      const hasRoom = d.softMax - got > 1e-9;
      row.classList.toggle("hasroom", hasRoom && !d.wanting);
      row.querySelector(".blk-tag").hidden = !blockers.has(s);

      const capTxt =
        ` · <span class="a-cap">max ${fmtPct(-Math.round(d.softMax))}</span>` +
        (d.wanting ? ` · <span class="redword">wants ${fmtPct(-d.target)}</span>` : "");
      row.querySelector(".a-read").innerHTML =
        `picked <span class="a-picked">${fmtPct(d.picked)}</span> · ` +
        `total <span class="a-total">${fmtPct(d.total)}</span>${capTxt}`;
    });

    // summary line
    const used = Object.keys(assign).length;
    const blockerNames = [...blockers];
    let msg =
      `<span class="as-grand">${used}</span> milestone pick(s) allocated` +
      (freeCount ? `, <strong>${freeCount}</strong> still free` : "") + ".";
    if (blockerNames.length) {
      msg += ` <span class="as-warn">Reduce ${blockerNames.join(", ")}</span> to free milestones for the red-marked goals.`;
    }
    msg += " Press Apply to load these into your picks.";
    els.allocSummary.innerHTML = msg;
  }

  // Until the user edits the allocation, keep it balanced for the current medals.
  function ensureAlloc() {
    if (!allocTouched) initBalanced();
    normalize();
  }

  // ---- main render ----
  function update() {
    medals = Math.max(0, Math.floor(Number(els.medals.value) || 0));
    renderReach();
    renderOptions();
    renderStatic();
    renderSummary();
    ensureAlloc();
    renderAllocList();
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
      if (auto) { ensureAlloc(); renderAllocList(); }
    });
  });

  els.balanceBtn.addEventListener("click", () => {
    allocTouched = false; // let it re-balance and keep tracking medals
    initBalanced();
    renderAllocList();
    save();
  });
  els.clearAllocBtn.addEventListener("click", () => {
    allocTouched = true;
    assign = {};
    OPTION_TYPES.forEach((s) => { target[s] = 0; });
    renderAllocList();
    save();
  });
  els.applyAuto.addEventListener("click", () => {
    ensureAlloc();
    picks = {};
    Object.keys(assign).forEach((ms) => { picks[ms] = assign[ms]; });
    update();
    els.tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === "manual"));
    els.tabAuto.hidden = true;
    els.tabManual.hidden = false;
    showToast(`Applied ${Object.keys(assign).length} pick(s) — fine-tune in Manual`);
  });

  // ---- init ----
  loadStorage();
  tryLoadFromHash(); // a shared link overrides stored state
  els.medals.value = medals || "";
  update();
})();
