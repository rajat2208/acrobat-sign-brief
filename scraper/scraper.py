"""
Acrobat Sign feedback scraper.

Sources:
  - Reddit public JSON API (no credentials required)

Outputs src/data/themes.json with updated `vol` (% share) and `n` (raw count).
"""

import json
import os
import re
import time
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError

REDDIT_SUBREDDITS = ["sysadmin", "legaltech", "smallbusiness"]
REDDIT_SEARCH_URL = "https://www.reddit.com/r/{sub}/search.json?q=acrobat+sign&restrict_sr=1&sort=new&limit=100"
REDDIT_UA = "acrobat-sign-brief-scraper/1.0 (research tool)"

THEME_KEYWORDS: dict[str, list[str]] = {
    "workflow": [
        "template", "workflow", "routing", "multi-signer", "multi signer",
        "conditional field", "template logic", "config", "configuration",
        "set up", "setup", "reusable", "admin", "can't find", "cannot find",
    ],
    "uiregression": [
        "new ui", "new interface", "redesign", "redesigned", "classic ui",
        "old interface", "old ui", "20 minute", "30 minute", "5 minute",
        "takes longer", "used to be", "before the update", "april 2025",
        "ui change", "ux regression",
    ],
    "integration": [
        "webhook", "api", "iframe", "i-frame", "integration", "third-party cookie",
        "third party cookie", "embed", "embedded", "broken", "auto-disable",
        "auto disable", "silent fail", "zapier", "salesforce", "microsoft",
    ],
    "pricing": [
        "pricing", "price", "billing", "overage", "cost", "expensive",
        "overcharge", "per document", "plan", "subscription", "tier",
        "enterprise pricing", "no warning", "surprise charge",
    ],
    "mobile": [
        "mobile", "ios", "iphone", "ipad", "android", "app store",
        "mobile app", "phone", "tablet", "docusign", "dead end",
        "feature parity",
    ],
    "recipient": [
        "recipient", "signer", "signing experience", "field placement",
        "illegible", "signature rendering", "guided signing", "unsupported file",
        "receiving end", "client experience",
    ],
}

THEME_META = {
    "workflow":    {"title": "Workflow configuration complexity",    "desc": "Setting up multi-signer routing, conditional fields, and template logic is the most-cited pain point across all sources. Enterprise admins struggle to create reusable templates, and some users report being unable to locate basic features after the new UI rollout.", "accent": "#3B0F70", "cv": 9, "ui": 9, "ai": 9, "ls": "2025-09", "rec": "live"},
    "uiregression":{"title": "Persistent UX regression",             "desc": "Complaints about the redesigned request-signature flow continued unbroken from Jan 2024 through Sep 2025, including a fresh wave in April 2025 when the classic UI was sunset. Tasks that took 5 minutes now take 20–30 across law firms, HR teams, and SMBs.", "accent": "#8C2981", "cv": 9, "ui": 8, "ai": 6, "ls": "2025-09", "rec": "live"},
    "integration": {"title": "Integration brittleness & API friction","desc": "Webhooks auto-disable on repeated failures with no graceful recovery. Third-party cookie deprecation broke iFrame-embedded sign flows. G2 rates Acrobat Sign's approval process at 8.5 vs. a competitor average of 9.4 — a gap that maps directly to workflow abandonment.", "accent": "#C73E4C", "cv": 7, "ui": 8, "ai": 8, "ls": "2025-07", "rec": "live"},
    "pricing":     {"title": "Pricing opacity & value perception",    "desc": "Overage billing at 4× standard rates with no warnings, and confusion across personal, educational, and business accounts tied to one email. Enterprise pricing requires contacting sales with no published rates.", "accent": "#E8692A", "cv": 8, "ui": 7, "ai": 4, "ls": "2025-04", "rec": "recent"},
    "mobile":      {"title": "Mobile app as a dead end",              "desc": "The iOS app supports basic signing but is not viable for document preparation or template management. Field-based users consistently cite this as a reason to evaluate DocuSign. App Store reviews call out the gap between mobile and desktop feature parity.", "accent": "#F59033", "cv": 7, "ui": 7, "ai": 7, "ls": "2025-03", "rec": "recent"},
    "recipient":   {"title": "Recipient-side signing friction",       "desc": "Signers report field placement errors, illegible signature rendering, and no guided signing flow. Documents pre-signed by another tool trigger “unsupported file type” errors. The receiving experience reflects directly on enterprise customers sending via Acrobat Sign.", "accent": "#F8C840", "cv": 8, "ui": 8, "ai": 7, "ls": "2024-11", "rec": "old"},
}

THEME_ORDER = ["workflow", "uiregression", "integration", "pricing", "mobile", "recipient"]


def score_text(text: str) -> dict[str, int]:
    text_lower = text.lower()
    return {
        theme_id: hits
        for theme_id, keywords in THEME_KEYWORDS.items()
        if (hits := sum(1 for kw in keywords if kw in text_lower))
    }


def scrape_reddit_public(counts: dict) -> int:
    """Use Reddit's public JSON API — no credentials needed."""
    total = 0
    for sub in REDDIT_SUBREDDITS:
        url = REDDIT_SEARCH_URL.format(sub=sub)
        try:
            req = Request(url, headers={"User-Agent": REDDIT_UA})
            with urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read())
        except HTTPError as e:
            print(f"  [warn] Reddit {sub} returned HTTP {e.code} — skipping")
            continue
        except Exception as exc:
            print(f"  [warn] Reddit {sub} failed: {exc}")
            continue

        posts = data.get("data", {}).get("children", [])
        for post in posts:
            d = post.get("data", {})
            text = f"{d.get('title', '')} {d.get('selftext', '')}"
            for theme_id, hits in score_text(text).items():
                counts[theme_id] += hits
        total += len(posts)
        print(f"  {sub}: {len(posts)} posts")
        time.sleep(1)  # be polite to Reddit's servers

    return total


def build_themes_json(counts: dict) -> list[dict]:
    total_hits = sum(counts.values()) or 1
    themes = []
    for theme_id in THEME_ORDER:
        meta = THEME_META[theme_id]
        n = counts.get(theme_id, 0)
        vol = round((n / total_hits) * 100)
        themes.append({
            "id": theme_id,
            "title": meta["title"],
            "desc": meta["desc"],
            "vol": max(vol, 1),
            "n": n if n > 0 else None,
            "accent": meta["accent"],
            "cv": meta["cv"],
            "ui": meta["ui"],
            "ai": meta["ai"],
            "ls": meta["ls"],
            "rec": meta["rec"],
        })
    return themes


def main() -> None:
    counts: dict[str, int] = defaultdict(int)

    print("Scraping Reddit (public JSON API)…")
    total = scrape_reddit_public(counts)
    print(f"  Total posts scanned: {total}")

    if not any(counts.values()):
        print("[warn] No keyword hits — themes.json not updated")
        return

    print("Theme hit counts:", dict(counts))
    themes = build_themes_json(counts)

    out_path = Path(__file__).parent.parent / "src" / "data" / "themes.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(themes, indent=2, ensure_ascii=False))
    print(f"Written → {out_path}")


if __name__ == "__main__":
    main()
