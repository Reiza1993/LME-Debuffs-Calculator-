(function () {
  "use strict";

  const DATA = window.LME_DATA || { options: [], static: [] };
  const SPECIAL_TYPES = new Set(["Supreme Arcanum HP", "Supreme Boss", "Sentinal HP"]);
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
  };

  // ---- state ----
  let medals = 0;
  let picks = {}; // milestone -> selected option index

  function load() {
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
          picks[row.milestone] = picks[row.milestone] === i ? undefined : i;
          if (picks[row.milestone] === undefined) delete picks[row.milestone];
          update();
        });
        optRow.appendChild(el);
      });
      block.appendChild(optRow);
      els.optionsList.appendChild(block);
    });
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
    const pct = {};   // type -> { total, picked, static }
    const flat = {};  // type -> total
    const unlocks = new Set();

    function addPct(type, v, src) {
      if (!pct[type]) pct[type] = { total: 0, picked: 0, static: 0 };
      pct[type].total += v;
      pct[type][src] += v;
    }

    // picked options
    DATA.options
      .filter((o) => o.milestone <= medals)
      .forEach((row) => {
        const sel = picks[row.milestone];
        if (typeof sel === "number" && row.options[sel]) {
          const opt = row.options[sel];
          addPct(opt.type, opt.pct, "picked");
        }
      });

    // static
    DATA.static
      .filter((s) => s.milestone <= medals)
      .forEach((s) => {
        if (SPECIAL_TYPES.has(s.type)) { unlocks.add(s.type); return; }
        if (FLAT_TYPES.has(s.type)) { flat[s.type] = (flat[s.type] || 0) + s.value; return; }
        addPct(s.type, s.value, "static");
      });

    // build tiles, percentage types sorted by magnitude desc
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

    els.special.innerHTML = [...unlocks]
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

  // ---- init ----
  load();
  els.medals.value = medals || "";
  update();
})();
