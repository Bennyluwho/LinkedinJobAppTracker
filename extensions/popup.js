const HEADERS = ["title","company","location","posted date","job url"]; // matches your sheet

function csvQuote(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}
function toRow(o) {
  return [o.title, o.company, o.location, o.posted_date_iso, o.job_url].map(csvQuote).join(",");
}
function setRowCount() {
  chrome.storage.local.get({ rows: [] }, ({ rows }) => {
    document.getElementById("rowCount").textContent = rows.length ? `${rows.length} saved` : "0 saved";
  });
}
setRowCount();

async function runContentScriptOnActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/www\.linkedin\.com\/jobs\/view\//.test(tab.url || "")) {
    throw new Error("Open a LinkedIn job page first (URL must contain /jobs/view/).");
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  return tab.id;
}

document.getElementById("save").onclick = async () => {
  const msg = document.getElementById("msg");
  msg.textContent = "Reading page…";
  try {
    await runContentScriptOnActiveTab();
    const once = (message) => {
      if (message?.type !== "JOB_DATA") return;
      chrome.runtime.onMessage.removeListener(once);
      const row = toRow(message.payload);
      chrome.storage.local.get({ rows: [] }, ({ rows }) => {
        // de-dupe by job_url
        const key = csvQuote(message.payload.job_url);
        const filtered = rows.filter(r => !r.startsWith(key + ","));
        filtered.push(row);
        chrome.storage.local.set({ rows: filtered }, () => {
          msg.textContent = "Saved ✓";
          setRowCount();
        });
      });
    };
    chrome.runtime.onMessage.addListener(once);
  } catch (e) {
    msg.textContent = e.message || String(e);
  }
};

document.getElementById("export").onclick = () => {
  const msg = document.getElementById("msg");
  chrome.storage.local.get({ rows: [] }, ({ rows }) => {
    if (!rows.length) { msg.textContent = "Nothing to export yet."; return; }
    const csv = ["\uFEFF" + HEADERS.join(","), ...rows].join("\n"); // BOM for Excel UTF-8
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: "applications.csv" });
    msg.textContent = `Exported ${rows.length} rows.`;
  });
};

document.getElementById("clear").onclick = () => {
  chrome.storage.local.set({ rows: [] }, () => {
    document.getElementById("msg").textContent = "Cleared.";
    setRowCount();
  });
};
