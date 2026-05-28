# Survivor.io — Clan Leader Debuff Calculator

A single-page web app to help **Survivor.io** clan leaders plan their **Last Man
Standing (LME)** debuffs based on the clan's **Testament Medals**.

The data is taken from the `LME_Debuff_Calculator.xlsm` sheet.

## What it does

Enter the Testament Medals your clan has achieved, and the page shows:

1. **Milestone Options** — the higher your medals, the more milestones unlock.
   Each unlocked milestone lets leaders pick **one** of several debuff options.
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
