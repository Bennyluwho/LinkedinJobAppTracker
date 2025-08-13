const HEADERS = ["title","company","location","posted date","job url"]; // your schema

function csvQuote(v){ return `"${String(v ?? "").replace(/"/g,'""')}"`; }
function toRow(o){
  return [o.title, o.company, o.location, o.posted_date_iso, o.job_url]
    .map(csvQuote).join(",");
}

function setRowCount(){
  chrome.storage.local.get({ rows: [] }, ({ rows }) => {
    const el = document.getElementById("rowCount");
    el.textContent = rows.length ? `${rows.length} saved` : "0 saved";
  });
}
function setLoading(on){
  const btn = document.getElementById("save");
  btn.classList.toggle("loading", !!on);
  btn.disabled = !!on;
}

setRowCount();

async function getActiveJobTabId(){
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  if (!tab || !/^https:\/\/www\.linkedin\.com\/jobs\/view\//.test(tab.url || "")) {
    throw new Error("Open a LinkedIn job page first (URL must contain /jobs/view/).");
  }
  return tab.id;
}

document.getElementById("save").onclick = async () => {
  const msg = document.getElementById("msg");
  msg.textContent = "Reading page…";
  setLoading(true);

  try {
    const tabId = await getActiveJobTabId();

    // Listen first (avoid MV3 race), then inject
    const payload = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("No data received from the page.")), 7000);
      const once = (message, sender) => {
        if (sender?.tab?.id === tabId && message?.type === "JOB_DATA") {
          chrome.runtime.onMessage.removeListener(once);
          clearTimeout(timer);
          resolve(message.payload);
        }
      };
      chrome.runtime.onMessage.addListener(once);
      chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] })
        .catch(err => { chrome.runtime.onMessage.removeListener(once); clearTimeout(timer); reject(err); });
    });

    const row = toRow(payload);

    chrome.storage.local.get({ rows: [] }, ({ rows }) => {
      // De-dupe by job_url
      const key = csvQuote(payload.job_url);
      const filtered = rows.filter(r => !r.startsWith(key + ","));
      filtered.push(row);
      chrome.storage.local.set({ rows: filtered }, () => {
        msg.textContent = "Saved ✓";
        setRowCount();
        setLoading(false);
      });
    });

  } catch (e) {
    msg.textContent = e.message || String(e);
    setLoading(false);
  }
};

document.getElementById("exportCsv").onclick = () => {
  const msg = document.getElementById("msg");
  chrome.storage.local.get({ rows: [] }, ({ rows }) => {
    if (!rows.length) { msg.textContent = "Nothing to export yet."; return; }
    const csv = ["\uFEFF" + HEADERS.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
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
