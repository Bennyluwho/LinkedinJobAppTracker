function getCanonicalJobUrl() {
  try {
    const url = new URL(window.location.href);

    // Case 1: collections page → extract currentJobId
    const jobId = url.searchParams.get("currentJobId");
    if (jobId) {
      return `https://www.linkedin.com/jobs/view/${jobId}/`;
    }

    // Case 2: regular /jobs/view/<id>/ page
    const m = url.pathname.match(/\/jobs\/view\/(\d+)/);
    if (m) {
      return `https://www.linkedin.com/jobs/view/${m[1]}/`;
    }

    // Fallback: just return the raw URL
    return window.location.href;
  } catch (e) {
    console.warn("Error canonicalizing job URL:", e);
    return window.location.href;
  }
}

(async function () {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

  let source = null;

  // Wait for the main content to load (LinkedIn is dynamic)
  async function waitFor(sel, timeout = 6000) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      const el = document.querySelector(sel);
      if (el) return el;
      await new Promise(r => setTimeout(r, 150));
    }
    return null;
  }

  // 1) DOM selectors (most reliable on full /jobs/view/* pages)
  await waitFor("main, [data-test='job-details']");
  const titleEl =
    document.querySelector("[data-test='job-details__job-title'], h1, [class*='job-title']");
  const companyEl =
    document.querySelector("[data-test='job-details__company-url'], a[href*='/company/'], [class*='company-name']");

  let title = norm(titleEl?.textContent);
  // --- company extraction (view + collections support) ---
let company = "";
try {
  const companyElement =
    document.querySelector(".jobs-unified-top-card__company-name a") || // normal /jobs/view
    document.querySelector(".job-details-jobs-unified-top-card__company-name a") || // collections detail panel
    document.querySelector("a[data-control-name='jobdetails_company_link']"); // extra fallback

  if (companyElement) {
    company = companyElement.innerText.trim();

    // cleanup: strip trailing bullets like "• 10,001+ employees"
    company = company.replace(/\s*[•·|].*$/, "").trim();
  }
} catch (e) {
  console.warn("Company extraction failed:", e);
}


  if (title && company) {
    source = "1"; // DOM
  }

  

  // 2) JSON-LD fallback for company/title if missing
  if (!title || !company) {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse((s.textContent || "").trim());
        const items = Array.isArray(data) ? data : [data];
        for (const it of items) {
          if (it && (it["@type"] === "JobPosting" || it["@type"] === "Posting")) {
            title ||= norm(it.title || it.name);
            const org = it.hiringOrganization;
            company ||= norm(typeof org === "string" ? org : org?.name);
          }
        }
        if (title && company) {
          source = "2"; // JSON-LD
          break;
        }
      } catch {}
    }
  }

  // 3) <title> fallback last
  if (!title || !company) {
    let t = document.querySelector("title")?.textContent || "";
    t = t.replace(/^\(\d+\)\s*/, "").trim(); // strip "(4) "
    const parts = t.split(" | ").map(norm).filter(Boolean);
    if (parts.length >= 3 && parts.at(-1).toLowerCase() === "linkedin") {
      company ||= parts.at(-2);
      title ||= parts.slice(0, -2).join(" | ");
    }
    if (title && company && !source) {
      source = "3"; // <title> fallback
    }
  }

  const payload = {
    title: title || null,
    company: company || null,
    job_url: getCanonicalJobUrl(),
    source
  };

  console.log(`[JOB_DATA] method ${source}:`, payload);

  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: "JOB_DATA", payload }, () => void 0);
  }
})();
