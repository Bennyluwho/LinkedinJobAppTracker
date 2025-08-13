# LinkedIn Job Tracker  Install This As **Your** Chrome/Edge Extension

This guide shows you how to load this project as your **own local browser extension** (no publishing needed). You’ll be able to click **Save row** on any LinkedIn job page and later **Export CSV** with the fields:

```
title, company, location, posted date, job url
```

> Optional: you can add a trailing `status` column (e.g., Pending/Accepted/Rejected/Ghosted)  see **Customize columns** below.

---

## 0) What’s in the folder

```
extension/
  manifest.json   # MV3 manifest (Chrome/Edge/Brave)
  popup.html      # Popup UI with buttons
  popup.js        # Logic: inject content script, save rows, export CSV
  content.js      # Runs on the job page; extracts fields
bookmarklet/      # Optional: one-click capture as a bookmarklet
README.md         # This file
```

You only need the **extension/** folder to load the extension.

---

## 1) Prerequisites

- A Chromium-based browser (Chrome, Microsoft Edge, Brave, Arc, etc.).  
- You don’t need a developer account; we’ll **load it unpacked** locally.

> Firefox note: Firefox MV3 support is still evolving. This project targets Chrome/Edge (MV3).

---

## 2) Load the extension (Chrome / Brave / Arc)

1. Open your browser and go to: `chrome://extensions`
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the project’s **`extension/`** folder.
5. (Optional) Click the puzzle icon → **Pin** the extension for easy access.

### Microsoft Edge
1. Go to `edge://extensions` → enable **Developer mode**.
2. Click **Load unpacked** → choose the **`extension/`** folder.
3. Pin the extension.

> If you change any files, click **Reload** (↻) on the extension card to pick up changes.

---

## 3) Use the extension

1. Open a LinkedIn job **in its own tab** (URL contains `/jobs/view/...`).
2. Click the extension icon.
3. Click **Save row** → you should see **“Saved ✓”**.
4. Repeat as you browse other jobs.
5. Click **Export CSV** → a file named `applications.csv` downloads. Open it in Google Sheets/Excel.

**CSV headers (default):**
```
title,company,location,posted date,job url
```

**Clear** removes the saved rows from your browser’s local storage (handy between sessions).

---

## 4) Customize columns (optional)

All export formatting happens in **`extension/popup.js`**.

- **Change header order**: edit the `HEADERS` array.
- **Add a `status` column**: extend headers and the row builder.

**Example  add `status` as the last column with default “Pending”:**
```js
// popup.js
const HEADERS = ["title","company","location","posted date","job url","status"];
const DEFAULT_STATUS = "Pending";

function csvQuote(v){ return `"${String(v ?? "").replace(/"/g,'""')}"`; }
function toRow(item){
  return [item.title, item.company, item.location, item.posted_date_iso, item.job_url, DEFAULT_STATUS]
    .map(csvQuote).join(",");
}
```

After editing, go to `chrome://extensions` and hit **Reload** on the extension.

> **Dropdowns:** CSV is plain text, so it can’t *contain* dropdowns. Add them in your sheet once via **Data → Data validation**. See the “Status dropdown in Sheets/Excel” section below.

---

## 5) How the data is captured (mental model)

- When you click **Save row**, the popup injects **`content.js`** into the current tab.
- `content.js` reads visible fields from the job page using selector fallbacks and small heuristics, then sends them back to the popup.
- The popup stores a compact object (title/company/location/date/url) in Chrome’s **local storage**.
- **Export CSV** formats those objects into a CSV file (and de-duplicates by job URL).

This avoids raw HTTP scraping and works reliably with what your browser already renders.

---

## 6) Status dropdown in Sheets/Excel (recommended)

### Google Sheets
1. Add a **status** header as your last column.
2. Select the status range (e.g., `F2:F`).
3. Data → **Data validation** → **Dropdown** → items:
   ```
   Pending, Accepted, Rejected, Ghosted
   ```
4. (Optional) Display style **Chip** for colored pills.

**Optional Apps Script to keep validation applied:**
```js
function onOpen(){ setStatusValidation_(); }
function setStatusValidation_(){
  const sh = SpreadsheetApp.getActiveSheet();
  const range = sh.getRange("F2:F"); // adjust if your status col differs
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Pending","Accepted","Rejected","Ghosted"], true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}
```

### Excel
1. Put **status** as the last header (e.g., column F).
2. Select `F2:F1048576` → Data → **Data Validation** → Allow: **List** → Source:
   ```
   Pending,Accepted,Rejected,Ghosted
   ```
3. (Optional) **Format as Table** so validation persists for new rows.

---

## 7) Common issues & fixes

- **Buttons do nothing**  
  Reload the extension. Make sure you’re on a **/jobs/view/** page (not the right-hand search preview).  
  Right-click popup → **Inspect** → check Console for errors.

- **Company or location is empty**  
  LinkedIn uses multiple layouts. The extractor in `content.js` tries several selectors and JSON-LD. If a field is blank on a specific page:
  - Open DevTools (F12) on that page
  - Inspect the elements showing the company/location
  - Tweak the fallback selectors in `getCompany()` / `getLocation()`

- **Everything pastes into one cell** (Sheets)  
  Use **Data → Split text to columns → Comma**.

- **Permission prompts or downloads blocked**  
  The extension uses `activeTab` (granted on click), `scripting` (to run `content.js`), `storage` (to save rows), and `downloads` (to save the CSV). If downloads are blocked, allow them for “linkedin.com” or the extension.

---

## 8) Make it your own

- Add columns: `easy_apply`, `work_mode`, `applicants_count`, `description_snippet` (update `HEADERS`, row builder, and `content.js` extraction).
- Add a **Notes** column (manual notes typed later in your sheet).
- Export Excel with built‑in dropdowns (use a small ExcelJS build to generate `.xlsx`).

---

## 9) Uninstall / clean up

- Remove saved rows: open the popup → **Clear**.  
- Remove the extension: `chrome://extensions` → **Remove**.  
- Your CSVs/Sheets stay on your machine or in Drive this tool doesn’t upload data anywhere.

---

## 10) License

MIT (or your preferred license). Add a `LICENSE` file at the repo root if you want others to reuse it.

---

## 11) Changelog (suggested)

- v1.0.0  Initial public version: Save row, Export CSV, robust selectors for company/location, de-dup by URL.

---

## FAQ

**Q: Does this violate LinkedIn’s rules?**  
A: This reads what *you* can see in your own session for personal tracking. Don’t run it at scale, don’t share cookies, and respect LinkedIn’s Terms of Service and applicable laws.

**Q: Can it auto-append to Google Sheets without downloads?**  
A: Yesusing Apps Script or the Google Sheets API. This repo keeps things local and simple; feel free to add an API script later.

**Q: Will it work on the right‑hand preview panel in job search?**  
A: It’s more reliable on full job pages (`/jobs/view/...`). Right‑click the job title → **Open link in new tab** first.

