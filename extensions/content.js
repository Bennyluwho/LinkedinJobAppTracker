(() => {
  // Helpers
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const T  = (el) => (el ? el.innerText.trim() : "");
  const Q  = (s)  => T($(s));

  const canonical = ($('link[rel="canonical"]') || {}).href || window.location.href;

  // Title
  const title = Q("h1[class*='jobs-unified-top-card__job-title'], h1[class*='job-details-jobs-title'], .top-card-layout__title, h1");

  // Posted date normalization
  const posted_raw = Q("span[class*='posted-time-ago__text'], span[class*='jobs-unified-top-card__posted-date'], time[datetime]");
  function normDate(s) {
    const now = new Date();
    if (!s) return now.toISOString().slice(0,10);
    const t = String(s).toLowerCase();
    if (t.includes("today") || t.includes("just")) return now.toISOString().slice(0,10);
    const m = t.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
    if (!m) {
      const dt = $("time[datetime]")?.getAttribute("datetime");
      if (dt) {
        const d = new Date(dt);
        if (!isNaN(d)) return d.toISOString().slice(0,10);
      }
      return now.toISOString().slice(0,10);
    }
    const n = +m[1], u = m[2];
    const days = {minute:1/1440, hour:1/24, day:1, week:7, month:30, year:365}[u] * n;
    return new Date(Date.now() - days*86400000).toISOString().slice(0,10);
  }

  // Company (robust across layouts)
  function getCompany() {
    // Obvious company links
    let links = $$("a[href*='/company/'], a[href*='linkedin.com/company/'], a[data-tracking-control-name*='topcard']")
      .filter(a => a.offsetParent && a.innerText.trim());
    if (links.length) return links[0].innerText.trim();

    // Other common spots
    const fallbacks = [
      "a[class*='jobs-unified-top-card__company-name']",
      "a.topcard__org-name-link",
      ".top-card-layout__second-subline a",
      ".sub-nav-cta__subtitle a",
      ".jobs-company__box a"
    ];
    for (const s of fallbacks) {
      const el = $(s);
      if (el && el.innerText.trim()) return el.innerText.trim();
    }

    // JSON-LD fallback
    for (const s of $$('script[type="application/ld+json"]')) {
      try {
        const j = JSON.parse(s.textContent);
        const arr = Array.isArray(j) ? j : [j];
        for (const o of arr) {
          const name = o?.hiringOrganization?.name || o?.jobLocation?.hiringOrganization?.name;
          if (name) return String(name).trim();
        }
      } catch {}
    }

    // Page title fallback: "Role - Company | LinkedIn"
    const m = document.title.match(/-\s*([^-\|•]+)\s*(?:[-\|•]|$)/);
    return m ? m[1].trim() : "";
  }

  // Location (handles bullet-separated first subline)
  const SEP = /\s*[•·\u00B7|]\s*|\s+\.\s+/;
  function pickLocFrom(s) {
    if (!s) return "";
    const parts = String(s).split(SEP).map(x => x.trim()).filter(Boolean);
    for (const p of parts) {
      if (/^remote$/i.test(p)) return "Remote";
      if (/,?\s*[A-Za-z]{2}\b/.test(p) && /,/.test(p)) return p;
      if (/\b(United States|USA|Canada|United Kingdom|UK|Germany|France|India|Australia|Mexico|Brazil|Spain|Italy|Netherlands|Singapore)\b/i.test(p)) return p;
    }
    return "";
  }
  function getLocation() {
    // 1) Subline block
    const sub = $(".top-card-layout__first-subline, .jobs-unified-top-card__subtitle-primary, .jobs-unified-top-card__subtitle-primary-group");
    let loc = pickLocFrom(sub?.innerText);
    if (loc) return loc;

    // 2) Nearby spans
    for (const el of $$(".top-card-layout__entity-info span, span[class*='jobs-unified-top-card__bullet'], .jobs-unified-top-card__subtitle-primary span")) {
      loc = pickLocFrom(el.innerText);
      if (loc) return loc;
    }

    // 3) Scan lines
    const top = $(".jobs-unified-top-card, .top-card-layout, .jobs-details-top-card, .jobs-details__main") || document.body;
    const lines = (top.innerText || "").split(/\n+/).slice(0, 30);
    for (const l of lines) {
      loc = pickLocFrom(l);
      if (loc) return loc;
    }

    // 4) JSON-LD
    for (const s of $$('script[type="application/ld+json"]')) {
      try {
        const j = JSON.parse(s.textContent);
        const arr = Array.isArray(j) ? j : [j];
        for (const o of arr) {
          const jl = o?.jobLocation || o?.jobLocationType;
          if (typeof jl === "string" && /remote/i.test(jl)) return "Remote";
          const list = [].concat(jl || []);
          for (const L of list) {
            const a = L?.address || {};
            const v = (a.addressLocality && a.addressRegion)
              ? `${a.addressLocality}, ${a.addressRegion}`
              : (a.addressLocality || a.addressRegion || a.addressCountry || "");
            if (v) return String(v).trim();
          }
        }
      } catch {}
    }
    return "";
  }

  const payload = {
    title: title || "",
    company: getCompany() || "",
    location: getLocation() || "",
    posted_date_iso: normDate(posted_raw),
    job_url: canonical
  };

  chrome.runtime.sendMessage({ type: "JOB_DATA", payload });
})();
