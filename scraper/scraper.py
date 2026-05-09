"""
Acrobat Sign feedback scraper.

Sources:
  - Adobe Community Sign subforum via RSS (no auth required)
  - Reddit via PRAW (optional — skipped if env vars not set)

Outputs src/data/themes.json with updated `vol` (% share) and `n` (raw count).

Optional env vars for Reddit (skip if unavailable):
  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT
"""

import json
import os
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen, Request

ADOBE_RSS_FEEDS = [
    "https://community.adobe.com/t5/acrobat-sign/bd-p/acrobat-sign/rss.board?interaction.style=forum",
    "https://community.adobe.com/t5/acrobat-sign/bd-p/acrobat-sign/rss.board?interaction.style=qanda",
]

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
    "integration": {"title": "Integration brittleness & API friction","desc": "Webhooks auto-disable on repeated failures with no graceful recovery. Third-party cookie deprecation broke iFrame-embedded sign flows. G2 rates Acrobat Sign’s approval process at 8.5 vs. a competitor average of 9.4 — a gap that maps directly to workflow abandonment.", "accent": "#C73E4C", "cv": 7, "ui": 8, "ai": 8, "ls": "2025-07", "rec": "live"},
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


def scrape_adobe_rss(counts: dict) -> int:
    total = 0
    for feed_url in ADOBE_RSS_FEEDS:
        try:
            req = Request(feed_url, headers={"User-Agent": "acrobat-sign-scraper/1.0"})
            with urlopen(req, timeout=15) as resp:
                tree = ET.parse(resp)
        except Exception as exc:
            print(f"  [warn] RSS fetch failed for {feed_url}: {exc}")
            continue

        items = tree.findall(".//item")
        for item in items:
            title = item.findtext("title") or ""
            desc = item.findtext("description") or ""
            text = f"{title} {re.sub('<[^>]+>', '', desc)}"
            for theme_id, hits in score_text(text).items():
                counts[theme_id] += hits
        total += len(items)

    return total


def scrape_reddit(counts: dict) -> int:
    client_id = os.environ.get("REDDIT_CLIENT_ID")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("  [skip] REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set — skipping Reddit")
        return 0

    try:
        import praw
    except ImportError:
        print("  [skip] praw not installed — skipping Reddit")
        return 0

    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=os.environ.get("REDDIT_USER_AGENT", "acrobat-sign-scraper/1.0"),
    )

    total = 0
    for sub_name in ["sysadmin", "legaltech", "smallbusiness"]:
        subreddit = reddit.subreddit(sub_name)
        for post in subreddit.search("acrobat sign", limit=250, sort="new"):
            body = f"{post.title} {post.selftext}"
            post.comments.replace_more(limit=0)
            for comment in list(post.comments)[:20]:
                body += f" {comment.body}"
            for theme_id, hits in score_text(body).items():
                counts[theme_id] += hits
            total += 1

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

    print("Scraping Adobe Community RSS…")
    adobe_items = scrape_adobe_rss(counts)
    print(f"  Scanned {adobe_items} items")

    print("Scraping Reddit…")
    reddit_posts = scrape_reddit(counts)
    print(f"  Scanned {reddit_posts} posts")

    if not any(counts.values()):
        print("[warn] No hits found — themes.json not updated to avoid wiping manual estimates")
        return

    print("Theme hit counts:", dict(counts))
    themes = build_themes_json(counts)

    out_path = Path(__file__).parent.parent / "src" / "data" / "themes.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(themes, indent=2, ensure_ascii=False))
    print(f"Written → {out_path}")


if __name__ == "__main__":
    main()
