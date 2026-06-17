"""Render docs/dashboard-preview.svg: a faithful preview of the Overview page.

The numbers come from the committed seed data, so the preview matches what the
running app shows. Regenerate after changing the data with:
    python docs/make_preview.py
"""

from pathlib import Path

# Revenue by month, last 12 full months (from the seed data).
MONTHS = [
    ("Jun", 605071), ("Jul", 665919), ("Aug", 567801), ("Sep", 544511),
    ("Oct", 532827), ("Nov", 573396), ("Dec", 666847), ("Jan", 759524),
    ("Feb", 671304), ("Mar", 622137), ("Apr", 570717), ("May", 633918),
]

KPIS = [
    ("Revenue (30d)", "$608,550", "▲ +3.0%", "up"),
    ("Jobs Completed (30d)", "587", "▲ +7.7%", "up"),
    ("First-Time-Fix Rate", "78.2%", "▼ -0.3 pts", "down"),
    ("Average Ticket", "$1,037", "▼ -4.4%", "down"),
]

INSIGHT = (
    "Revenue eased to $136,149 for the week ending 2026-06-15, -6.5% against "
    "the prior week. The team completed 129 jobs (-8.5% week over week), at an "
    "average ticket of $1,055. First-time-fix landed at 79.8%, an improvement "
    "of 1.1 points. Furnace Installation led revenue at $39,600, and Elizabeth "
    "Johnson carried the most completed jobs (11). The call center booked 52.7% "
    "of calls. Momentum is steady; keep senior technicians on the high-ticket "
    "installation work where first-time-fix is strongest."
)

W, H = 1180, 720
GREEN, RED, ACCENT = "#11875a", "#c0392b", "#2f6df6"


def wrap(text: str, width: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > width:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return lines


def chart_geometry(x0, y0, w, h):
    vals = [v for _, v in MONTHS]
    lo, hi = min(vals) * 0.92, max(vals) * 1.04
    n = len(MONTHS)
    pts = []
    for i, (_, v) in enumerate(MONTHS):
        x = x0 + (w * i / (n - 1))
        y = y0 + h - (h * (v - lo) / (hi - lo))
        pts.append((x, y))
    return pts


def build() -> str:
    s = []
    s.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
             f'viewBox="0 0 {W} {H}" font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,Arial,sans-serif">')
    s.append(f'<rect width="{W}" height="{H}" fill="#f5f6f8"/>')

    # Sidebar
    s.append('<rect width="244" height="720" fill="#111726"/>')
    s.append('<rect x="18" y="22" width="30" height="30" rx="8" fill="#2f6df6"/>')
    s.append('<text x="56" y="43" fill="#ffffff" font-size="19" font-weight="700">OpsPulse</text>')
    s.append('<text x="18" y="70" fill="#8b93a7" font-size="12">Northwind Field Services</text>')
    nav = [("Overview", True), ("Operations", False), ("Data Explorer", False)]
    y = 110
    for label, active in nav:
        if active:
            s.append(f'<rect x="14" y="{y - 18}" width="216" height="34" rx="8" fill="#2f6df6" fill-opacity="0.18"/>')
        color = "#ffffff" if active else "#8b93a7"
        s.append(f'<text x="28" y="{y + 4}" fill="{color}" font-size="14" font-weight="500">{label}</text>')
        y += 44
    s.append('<text x="18" y="678" fill="#8b93a7" font-size="11">Demo on 100% synthetic data.</text>')
    s.append('<text x="18" y="696" fill="#8b93a7" font-size="11">Built by HenryLabs Consulting.</text>')

    # Page head
    mx = 284
    s.append(f'<text x="{mx}" y="56" fill="#1a2233" font-size="24" font-weight="700">Overview</text>')
    s.append(f'<text x="{mx}" y="80" fill="#5b6577" font-size="14">Revenue, throughput, and service quality at a glance.</text>')

    # KPI cards
    card_w, gap = 196, 16
    kx, ky = mx, 104
    for i, (label, value, delta, dirn) in enumerate(KPIS):
        x = kx + i * (card_w + gap)
        s.append(f'<rect x="{x}" y="{ky}" width="{card_w}" height="104" rx="12" fill="#ffffff" stroke="#e4e7ec"/>')
        s.append(f'<text x="{x + 18}" y="{ky + 30}" fill="#5b6577" font-size="13">{label}</text>')
        s.append(f'<text x="{x + 18}" y="{ky + 62}" fill="#1a2233" font-size="26" font-weight="700">{value}</text>')
        color = GREEN if dirn == "up" else RED
        s.append(f'<text x="{x + 18}" y="{ky + 86}" fill="{color}" font-size="13" font-weight="600">{delta}</text>')

    # Chart card
    cy = 232
    chart_x, chart_w = mx, 540
    s.append(f'<rect x="{chart_x}" y="{cy}" width="{chart_w}" height="408" rx="12" fill="#ffffff" stroke="#e4e7ec"/>')
    s.append(f'<text x="{chart_x + 20}" y="{cy + 30}" fill="#1a2233" font-size="14" font-weight="600">Revenue by Month</text>')

    px0, py0, pw, ph = chart_x + 56, cy + 56, chart_w - 84, 300
    # gridlines
    for g in range(5):
        gy = py0 + ph * g / 4
        s.append(f'<line x1="{px0}" y1="{gy:.0f}" x2="{px0 + pw}" y2="{gy:.0f}" stroke="#eef0f4"/>')
    pts = chart_geometry(px0, py0, pw, ph)
    line = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    area = f"{px0:.1f},{py0 + ph:.1f} " + line + f" {px0 + pw:.1f},{py0 + ph:.1f}"
    s.append(f'<polygon points="{area}" fill="{ACCENT}" fill-opacity="0.14"/>')
    s.append(f'<polyline points="{line}" fill="none" stroke="{ACCENT}" stroke-width="2.5"/>')
    for x, y in pts:
        s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3" fill="{ACCENT}"/>')
    for (label, _), (x, _) in zip(MONTHS, pts):
        s.append(f'<text x="{x:.0f}" y="{py0 + ph + 22:.0f}" fill="#5b6577" font-size="11" text-anchor="middle">{label}</text>')
    # y labels
    vals = [v for _, v in MONTHS]
    lo, hi = min(vals) * 0.92, max(vals) * 1.04
    for g in range(5):
        val = hi - (hi - lo) * g / 4
        gy = py0 + ph * g / 4
        s.append(f'<text x="{px0 - 10}" y="{gy + 4:.0f}" fill="#5b6577" font-size="11" text-anchor="end">${val / 1000:.0f}k</text>')

    # Insight panel
    ix = chart_x + chart_w + 16
    iw = W - ix - 24
    s.append(f'<rect x="{ix}" y="{cy}" width="{iw}" height="408" rx="12" fill="#ffffff" stroke="#e4e7ec"/>')
    s.append(f'<circle cx="{ix + 26}" cy="{cy + 27}" r="5" fill="#2f6df6"/>')
    s.append(f'<text x="{ix + 38}" y="{cy + 32}" fill="#1a2233" font-size="14" font-weight="600">Daily Insights</text>')
    s.append(f'<rect x="{ix + iw - 78}" y="{cy + 18}" width="58" height="22" rx="11" fill="#eaf1ff"/>')
    s.append(f'<text x="{ix + iw - 49}" y="{cy + 33}" fill="#2f6df6" font-size="11" font-weight="700" text-anchor="middle">DEMO</text>')
    ty = cy + 64
    for ln in wrap(INSIGHT, 42):
        s.append(f'<text x="{ix + 20}" y="{ty}" fill="#1a2233" font-size="13.5">{ln}</text>')
        ty += 22
    s.append(f'<text x="{ix + 20}" y="{cy + 392}" fill="#5b6577" font-size="11">Set ANTHROPIC_API_KEY for a live Claude summary.</text>')

    s.append("</svg>")
    return "\n".join(s)


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "dashboard-preview.svg"
    out.write_text(build(), encoding="utf-8")
    print(f"Wrote {out}")
