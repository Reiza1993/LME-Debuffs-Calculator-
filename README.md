# Survivor.io — Clan Leader Debuff Calculator

A single-page web app to help **Survivor.io** clan leaders plan their **Last Man
Standing (LME)** debuffs based on the clan's **Testament Medals**.

The data is taken from the `LME_Debuff_Calculator.xlsm` sheet.

## What it does

Enter the Testament Medals your clan has achieved, and the page shows:

1. **Milestone Options** — the higher your medals, the more milestones unlock.
   Each unlocked milestone lets leaders pick **one** of several debuff options.
   - **Manual** tab: pick each milestone yourself.
   - **Auto-Pick by Priority** tab: set a priority slider per debuff type and let
     the calculator allocate every milestone for you. Because each milestone is a
     single choice, raising one debuff's priority means the others reach less —
     the live preview shows each type's result vs. its solo maximum. Presets
     (Crit Focus, Skill Nuke, Control, …) set the sliders in one click, and
     **Apply** fills your picks so you can still fine-tune them manually.
2. **Static Milestones** — fixed debuffs that always apply (leaders can't
   change these) for every milestone you've reached.
3. **Total Debuff Summary** — the sum of your picked options **plus** the static
   debuffs, grouped by debuff type (percentages stack additively per type).
   Flat Defense reduction and special unlocks (Supreme Boss, Sentinel HP, etc.)
   are shown separately.

Your medal count and picks are saved in the browser automatically.

## Usage

Just open `index.html` in any browser — no build step or server required.
It also works when hosted on GitHub Pages.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page markup |
| `style.css` | Styling |
| `app.js` | Calculator logic |
| `data.js` | Milestone + static debuff data extracted from the sheet |
