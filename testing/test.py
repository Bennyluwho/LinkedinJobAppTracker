#!/usr/bin/env python3
# Read a file of LinkedIn job URLs (one per line), extract:
# ["title","company","location","posted date","job url"]
# Append to CSV and to a single NDJSON file. No per-job JSON files are created.

import os, re, sys, csv, json, time, random, argparse
from datetime import datetime, timedelta
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

HEADERS = ["title","company","location","posted date","job url"]

# ---- URL helpers ----
JOB_VIEW_RE  = re.compile(r"/jobs/(?:guest/)?view/(\d+)")
JOB_POST_RE   = re.compile(r"/jobPosting/(\d+)")  # new: handle jobPosting paths too
JOB_POST_RE  = re.compile(r"/jobPosting/(\d+)")
URN_JOB_RE   = re.compile(r"urn:li:(?:fs_)?jobPosting:(\d+)")
COMPANY_SPLIT_RE = re.compile(r"(?:[\r\n]+|[•·\u00B7|]|—|–)")



def job_id_from(url: str) -> str:
    # Try /jobs/view/<id> and /jobPosting/<id>
    for rx in (JOB_VIEW_RE, JOB_POST_RE):
        m = rx.search(url or "")
        if m:
            return m.group(1)
    # Try common query params
    qs = parse_qs(urlparse(url or "").query)
    for k in ("currentJobId", "jobId", "id"):
        if qs.get(k):
            return qs[k][0]
    return ""

def clean_company_name(txt: str) -> str:
    if not txt: return ""
    s = COMPANY_SPLIT_RE.split(txt)[0].strip()  # first chunk only
    # If we accidentally caught "Title at Company", prefer the part after ' at '
    m = re.search(r"\bat\s+(.+)$", s, flags=re.I)
    if m and len(s.split(" at ")[0]) > 20 and 2 <= len(m.group(1)) <= 60:
        s = m.group(1).strip()
    # Drop tails like 'followers'/'employees'
    s = re.sub(r"\s+(?:employees|followers).*$", "", s, flags=re.I).strip()
    # Collapse whitespace
    s = re.sub(r"\s{2,}", " ", s)
    return s

def best_job_id(page, url_hint: str) -> str:
    # 1) From the URL we have
    jid = job_id_from(url_hint)
    if jid: return jid

    # 2) From meta/canonical
    for (sel, attr) in (
        ("link[rel='canonical']", "href"),
        ("meta[property='og:url']", "content"),
        ("meta[name='twitter:url']", "content"),
    ):
        try:
            v = page.locator(sel).first.get_attribute(attr, timeout=250)
            jid = job_id_from(v or "")
            if jid: return jid
        except Exception:
            pass

    # 3) From any link href on page
    try:
        links = page.locator("a[href*='/jobs/view/'], a[href*='/jobPosting/']")
        for i in range(min(links.count(), 50)):
            href = links.nth(i).get_attribute("href") or ""
            jid = job_id_from(href)
            if jid: return jid
    except Exception:
        pass

    # 4) From URNs in HTML
    try:
        html = page.content()
        m = URN_JOB_RE.search(html)
        if m: return m.group(1)
    except Exception:
        pass

    # 5) From JSON-LD 'identifier' if present
    try:
        scripts = page.locator('script[type="application/ld+json"]')
        for i in range(min(10, scripts.count())):
            import json
            jtxt = scripts.nth(i).inner_text()
            obj = json.loads(jtxt)
            arr = obj if isinstance(obj, list) else [obj]
            for o in arr:
                ident = (o.get("identifier") or {}).get("value") if isinstance(o.get("identifier"), dict) else o.get("identifier")
                if ident and str(ident).isdigit():
                    return str(ident)
    except Exception:
        pass

    return ""

def canonicalize(url: str) -> str:
    jid = job_id_from(url)
    if jid: return f"https://www.linkedin.com/jobs/view/{jid}/"
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}{p.path}".rstrip("/") + "/"

def normalize_input(line: str) -> str | None:
    s = (line or "").strip()
    if not s or s.startswith("#"): return None
    if s.startswith("http"): return canonicalize(s)
    m = JOB_VIEW_RE.search(s)  # allow /jobs/view/... or ../jobs/view/...
    if m:
        at = s.find("/jobs/")
        return canonicalize("https://www.linkedin.com" + s[at:])
    return None

# ---- text helpers ----
BULLETS_RE   = re.compile(r"\s*[•·\u00B7|]\s*|\s+\.\s+")
BAD_LOC_TOKS = re.compile(r"(posted|reposted|minute|hour|week|day|apply|applicant|people|clicked|promoted|response|managed|saved|premium)", re.I)

def norm_date(text: str) -> str:
    now = datetime.now()
    if not text: return now.date().isoformat()
    t = text.lower().strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}", t):
        try: return datetime.fromisoformat(t.replace("Z","+00:00")).date().isoformat()
        except: pass
    if "today" in t or "just" in t: return now.date().isoformat()
    m = re.search(r"(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago", t)
    if not m: return now.date().isoformat()
    n, unit = int(m.group(1)), m.group(2)
    days = {"minute":1/1440,"hour":1/24,"day":1,"week":7,"month":30,"year":365}[unit]*n
    return (now - timedelta(days=days)).date().isoformat()

def first_text(page, sel: str, timeout=700):
    try:
        loc = page.locator(sel).first
        return (loc.inner_text(timeout=timeout) or "").strip() if loc.count() else ""
    except: return ""

def first_attr(page, sel: str, name: str, timeout=250):
    try:
        loc = page.locator(sel).first
        return loc.get_attribute(name, timeout=timeout) if loc.count() else None
    except: return None

def split_tokens(s: str):
    return [p.strip() for p in BULLETS_RE.split(s or "") if p.strip()]

def looks_like_location(tok: str) -> bool:
    if not tok: return False
    x = tok.strip()
    if not x or len(x) > 70: return False
    if BAD_LOC_TOKS.search(x.lower()): return False
    if x.lower() == "remote": return True
    if re.search(r",\s*[A-Za-z]{2}\b", x): return True
    if re.search(r"\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s+[A-Z]{2}\b", x): return True
    if re.search(r"\b(United States|USA|Canada|United Kingdom|UK|India|Germany|France|Australia|Netherlands|Spain|Italy|Singapore)\b", x, re.I):
        return True
    return False

# ---- core scrape for one URL ----
def scrape_one(page, url: str) -> dict:
    url = canonicalize(url)
    page.goto(url, wait_until="domcontentloaded", timeout=120_000)
    try: page.wait_for_load_state("networkidle", timeout=8000)
    except: pass

    # If login/authwall → skip
    if any(k in page.url for k in ("/authwall","/checkpoint","/uas/login")):
        raise RuntimeError("AUTHWALL")

    raw_canon = first_attr(page, "link[rel='canonical']", "href") or page.url
    jid = best_job_id(page, raw_canon)
    job_url = f"https://www.linkedin.com/jobs/view/{jid}/" if jid else canonicalize(raw_canon)


    # title
    title = first_text(page, "h1[class*='jobs-unified-top-card__job-title'], h1[class*='job-details-jobs-title'], .top-card-layout__title, h1")

    # company
    top = page.locator(".jobs-unified-top-card, .top-card-layout, .jobs-details-top-card").first
    if not top.count(): top = page
    company = ""
    for sel in [
        "a[href*='/company/']",
        "a[href*='linkedin.com/company/']",
        "a[data-entity-hovercard-id^='urn:li:fs_miniCompany']",
        ".jobs-unified-top-card__company-name a",
        ".top-card-layout__second-subline a",
        ".top-card-layout__entity-info a",
    ]:
        n = min(top.locator(sel).count(), 20)
        for i in range(n):
            el = top.locator(sel).nth(i)
            href = (el.get_attribute("href") or "")
            txt  = clean_company_name((el.inner_text() or "").strip())
            if txt and "/company/" in (href or ""):
                company = clean_company_name(txt); break
        if company: break
    if not company:
        block = first_text(page, ".jobs-unified-top-card__company-name") \
             or first_text(page, ".top-card-layout__second-subline") \
             or first_text(page, ".top-card-layout__entity-info")
        if block:
            company = clean_company_name(block)
    if not company:
        m = re.search(r"-\s*([^-\|•]+)\s*(?:[-\|•]|$)", page.title())
        company = clean_company_name(m.group(1).strip()) if m else ""

    # posted date
    posted_raw = first_text(page, "span[class*='posted-time-ago__text'], span[class*='jobs-unified-top-card__posted-date'], time[datetime]") \
              or (first_attr(page, "time[datetime]", "datetime") or "")
    posted_date = norm_date(posted_raw)

    # location
    loc = ""
    subline = first_text(page, ".top-card-layout__first-subline, .jobs-unified-top-card__subtitle-primary, .jobs-unified-top-card__subtitle-primary-group")
    for tok in split_tokens(subline):
        if looks_like_location(tok): loc = tok; break
    if not loc:
        try:
            spans = page.locator(".top-card-layout__entity-info span, span[class*='jobs-unified-top-card__bullet'], .jobs-unified-top-card__subtitle-primary span")
            for i in range(min(spans.count(), 40)):
                t = (spans.nth(i).inner_text() or "").strip()
                for tok in split_tokens(t):
                    if looks_like_location(tok): loc = tok; break
                if loc: break
        except: pass
    if not loc:
        try:
            scs = page.locator('script[type="application/ld+json"]')
            for i in range(min(10, scs.count())):
                jtxt = scs.nth(i).inner_text()
                j = json.loads(jtxt)
                arr = j if isinstance(j, list) else [j]
                for o in arr:
                    jl = o.get("jobLocation") or o.get("jobLocationType")
                    if isinstance(jl, str) and re.search(r"remote", jl, re.I):
                        loc = "Remote"; break
                    elif jl:
                        items = [jl] if isinstance(jl, dict) else jl
                        for it in items or []:
                            a = (it or {}).get("address") or {}
                            city = a.get("addressLocality") or ""
                            region = a.get("addressRegion") or ""
                            country = a.get("addressCountry") or ""
                            if city and region: loc = f"{city}, {region}"; break
                            if city: loc = city; break
                            if region: loc = region; break
                            if country: loc = country; break
                    if loc: break
                if loc: break
        except: pass

    return {
        "title": title or "",
        "company": company or "",
        "location": loc or "",
        "posted date": posted_date,
        "job url": job_url,
    }

# ---- outputs ----
def append_csv(csv_path: str, data: dict):
    os.makedirs(os.path.dirname(csv_path) or ".", exist_ok=True)
    new = not os.path.exists(csv_path)
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new: w.writerow(HEADERS)
        w.writerow([data[h] for h in HEADERS])

def append_ndjson(txt_path: str, data: dict):
    # pretty text dump (one block per job) separated by ---
    if not txt_path:
        return
    os.makedirs(os.path.dirname(txt_path) or ".", exist_ok=True)
    with open(txt_path, "a", encoding="utf-8") as f:
        import json
        f.write(json.dumps(data, ensure_ascii=False, indent=2))
        f.write("\n---\n")  # separator between jobs (remove if you don't want it)

# ---- main ----
def main():
    ap = argparse.ArgumentParser(description="Batch extract LinkedIn job info → CSV + NDJSON.")
    ap.add_argument("--in", dest="infile", required=True, help="Path to jobs.txt (one URL per line)")
    ap.add_argument("--csv", default="out/applications.csv", help="CSV output path")
    ap.add_argument("--txt", default="out/jobs.ndjson", help="NDJSON output path (set to '' to disable)")
    ap.add_argument("--headful", action="store_true", help="Show the browser while running")
    ap.add_argument("--delay-min", type=float, default=1.5)
    ap.add_argument("--delay-max", type=float, default=3.0)
    ap.add_argument("--max", type=int, default=None, help="Process only first N URLs")
    args = ap.parse_args()
    #removing old output files if they exist
    for path in [args.csv, args.txt]:
        if path and os.path.exists(path):
            try:
                os.remove(path)
                print(f"Removed old: {path}")
            except OSError as e:
                print(f"Could not remove {path}: {e}")


    with open(args.infile, "r", encoding="utf-8") as f:
        urls = [u for u in (normalize_input(x) for x in f) if u]
    if not urls:
        print(f"No valid job URLs in {args.infile}"); sys.exit(1)
    if args.max: urls = urls[:args.max]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headful)
        ctx = browser.new_context()
        page = ctx.new_page()

        seen = set()
        for i, url in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] {url}")
            try:
                data = scrape_one(page, url)
                if data["job url"] in seen:
                    print("  - duplicate, skipping")
                else:
                    seen.add(data["job url"])
                    append_csv(args.csv, data)
                    append_ndjson(args.txt, data)
                    print(f"  ✓ {data['company']} — {data['location']}")
            except RuntimeError as e:
                if "AUTHWALL" in str(e):
                    print("  - skipped (login/auth wall)")
                else:
                    print("  ! error:", e)
            except Exception as e:
                print("  ! error:", e)
            time.sleep(random.uniform(args.delay_min, args.delay_max))

        browser.close()

    print(f"\nDone. CSV → {os.path.abspath(args.csv)}")
    if args.txt:
        print(f"NDJSON → {os.path.abspath(args.txt)}")

if __name__ == "__main__":
    main()
