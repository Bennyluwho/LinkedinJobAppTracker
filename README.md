# LinkedIn Job → CSV 📄

A lightweight Chrome extension that lets you save LinkedIn job details with one click and export them as a single CSV file — perfect for tracking job applications without leaving your browser.

## 🔧 Features

- ✅ Save job **title**, **company**, and **job URL** from:
  - Job detail pages (`/jobs/view/…`)
  - Collection panels (`/jobs/collections/…`)
  - Search results (`/jobs/search-results/?currentJobId=…`)
- 📥 Export all saved jobs as a downloadable CSV
- 🗑️ Clear saved jobs with one click
- 🕶️ Works in both light and dark mode
- 🛟 100% local – **no data ever leaves your browser**

## 🧠 How It Works

1. Visit any LinkedIn job page (view, collection, or search result)
2. Open the extension popup
3. Click **“Save row”**
4. Repeat as you browse job listings
5. Click **“Export CSV”** to download your full list

Jobs are de-duplicated automatically by their canonical job URL (`/jobs/view/<id>/`), even across different LinkedIn views.

## 📦 Output Format

Exported CSV contains:

| company | title | job url |
|---------|-------|---------|

Example:

```csv
"OpenAI","Research Engineer","https://www.linkedin.com/jobs/view/1234567890/"
"Spotify","Software Intern","https://www.linkedin.com/jobs/view/9876543210/"
```

## 🛠️ Installation (Developer Mode)

1. Clone or download this repo
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **“Load unpacked”** and select this folder

## 📁 File Structure

```
├── manifest.json       # Chrome extension config
├── popup.html          # UI for Save/Export/Clear
├── popup.js            # Handles scraping + storage
├── popup.css           # Dark/light theme styling
└── content.js          # Scraper injected into job tabs
```

## 🧪 Tested URL Formats

This extension works on all of the following:
- `https://www.linkedin.com/jobs/view/1234567890/`
- `https://www.linkedin.com/jobs/collections/…`
- `https://www.linkedin.com/jobs/search-results/?currentJobId=1234567890`

It automatically canonicalizes the job to `/jobs/view/<id>/` for consistency.

## 🧘 Limitations

- Only works while browsing jobs on desktop (not mobile app)
- CSV includes only: title, company, job URL
- You must manually click “Save row” to record a job

## 💡 Tips

- Paste your CSV into Google Sheets or Excel
- Use “Data → Split text to columns” if needed
- Use filters or add columns like `Status` or `Notes` manually

---

Made with ❤️ for job seekers who want **simple, private tracking** of their applications.