# LinkedIn Job Tracker — Bookmarklet & Chrome Extension

Track your job applications from LinkedIn in seconds. This project gives you two ways to capture key fields from any LinkedIn job page and export them to a spreadsheet-friendly file.

- **Milestone A – Bookmarklet:** one click on a job page copies a CSV row you can paste into Google Sheets/Excel.
- **Milestone B – Chrome Extension (MV3):** click **Save row** as you browse; later click **Export CSV** to download everything at once.

> **Columns (default order):** `title, company, location, posted date, job url`  
> Optional: add a trailing `status` column (e.g., “Pending/Accepted/Rejected/Ghosted”). CSV can’t store dropdowns, but Google Sheets/Excel can add them via Data Validation (see below).

---

## Why this is useful (and portfolio‑worthy)

- **Practical automation:** DOM parsing, content scripts, and MV3 popup → real workflow wins.
- **Robust scraping-by-UI:** avoids raw HTTP scraping; reuses what you already see in the browser.
- **Clean data pipeline:** consistent CSV schema you can extend (status, notes, easy apply, work mode).
- **Good engineering signals:** rate-limited approach, selector fallbacks, storage, export, and docs.

---

## Quick Start

### A) Bookmarklet (fastest)

1. **Create a bookmark** in your browser’s bookmarks bar.
2. **Name:** `LI → CSV`  
3. **URL:** paste the code from [`bookmarklet/bookmarklet.min.js`](bookmarklet/bookmarklet.min.js) (it starts with `javascript:(()=>{...`) and save.
4. Open a LinkedIn job **in its own tab** (URL contains `/jobs/view/…`).
5. Click **LI → CSV** → a prompt appears with a CSV row → copy and paste under your header row in your sheet.

> If nothing happens, make sure you’re on a full job page (not the right-hand preview in search).

### B) Chrome Extension (recommended)

1. Go to **chrome://extensions** → toggle **Developer mode**.
2. Click **Load unpacked** → choose the `extension/` folder.
3. Pin the extension.
4. Open a LinkedIn job **/jobs/view/** page → click the extension → **Save row**.
5. Repeat on as many jobs as you want → click **Export CSV** to download.

**Files (MV3):**
```
extension/
  manifest.json
  content.js     # reads the job page and extracts fields
  popup.html     # UI with Save / Export / Clear
  popup.js       # message wiring, storage, CSV export
```

---

## CSV Schema

Default (5 columns):
```
title, company, location, posted date, job url
```

Optional 6th column (status):
```
title, company, location, posted date, job url, status
```

You can change the schema by editing the `HEADERS` array and row builder in `popup.js`. Make sure your Google Sheet/Excel file uses the matching header/order.

---

## Add a Status Dropdown in your Sheet

### Google Sheets
1. Add a **status** column to your header.
2. Select the status range (e.g., `F2:F`).
3. Data → **Data validation** → **Dropdown** → items:
   ```
   Pending, Accepted, Rejected, Ghosted
   ```
4. (Optional) “Display style: Chip” for colored pills.

**Auto-apply rule (optional):** Extensions → Apps Script → paste and run:
```javascript
function onOpen(){ setStatusValidation_(); }
function setStatusValidation_(){
  const sh = SpreadsheetApp.getActiveSheet();
  const range = sh.getRange("F2:F");
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Pending","Accepted","Rejected","Ghosted"], true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}
```

### Excel
1. Add **status** as the last header.
2. Select the status column (e.g., `F2:F1048576`).
3. Data → **Data Validation** → **List** → Source:
   ```
   Pending,Accepted,Rejected,Ghosted
   ```
4. (Optional) Format as **Table** so validation persists for new rows.

---

## Usage Tips

- Open jobs in a **new tab** so the URL includes `/jobs/view/…`.
- The extension stores rows locally (Chrome storage). **Export CSV** any time.
- **De‑dupe**: rows are de‑duplicated by `job_url` on save.
- **Selectors**: the content script uses multiple fallbacks and JSON‑LD for resilience; update selectors if LinkedIn’s layout changes.
- **Performance**: no background scripts; everything runs on click.

---

## Troubleshooting

- **Buttons do nothing (extension):** reload the extension, then open a full job page and try again. In the popup, right‑click → **Inspect** to view console logs.
- **Company/location blank:** LinkedIn uses multiple layouts. Open DevTools → Console on the job page to inspect the DOM; adjust selectors in `content.js` under `getCompany()` / `getLocation()`.
- **Pasted row lands in one cell:** use **Data → Split text to columns → Comma** (Sheets).

---

## Customization

- **Fields:** Add/remove columns in `popup.js` (`HEADERS` and the row builder), and update `content.js` to extract any new fields (e.g., `easy_apply`, `work_mode`, `applicants_count`, `description_snippet`).
- **Status default:** If you include a `status` column in CSV, set a default in the row builder (e.g., `"Pending"` or empty string).
- **Bookmarklet**: tailor output fields by editing the `FIELDS` array in the minified code.

---

## Ethics, ToS, and Rate‑Limiting

This tool reads data you can already see while browsing. Use it for **personal tracking**. Don’t run at scale, and respect LinkedIn’s Terms of Service and your local laws. Avoid sharing cookies or exported data.

---

## Roadmap Ideas

- Export to Google Sheets via API (append rows automatically).
- Add a Notes field in the popup.
- Optional Excel export with built‑in dropdowns (via ExcelJS).
- Tagging (Remote/Hybrid/On‑site) normalization.
- Salary and recruiter extraction when present.

---

## License

MIT — see [LICENSE](LICENSE) (add one if missing).

---

## Screenshots

Add a couple of screenshots to improve the repo:

- `docs/popup.png` — the popup UI with Save/Export.
- `docs/sheet.png` — the Google Sheet after a few captures.

