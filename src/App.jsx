import { useState, useMemo } from 'react'
import themesData from './data/themes.json'
import './App.css'

const CUTS = { all: null, '24m': '2024-05', '12m': '2025-05', '6m': '2025-11' }
const FILTERS = [
  { key: 'all', label: 'All time' },
  { key: '24m', label: 'Last 2 years' },
  { key: '12m', label: 'Last 12 months' },
  { key: '6m', label: 'Last 6 months' },
]

const RATIONALE = {
  workflow: "The dominant theme across every source. Workflow config failures block the core send-and-sign loop — the product's primary value delivery moment. AI field detection is the clearest near-term lever.",
  uiregression: "The single highest complaint volume. The April 2025 classic UI sunset reignited a thread that had been running since January 2024. Unlike most UX debt, this one has a clear before/after — users know exactly what they lost.",
  recipient: "Often overlooked because the sender files the complaint, but the recipient is the customer's client. Signing failures at that moment damage the Acrobat Sign customer's own professional relationship — making this a retention risk that doesn't show up in standard NPS.",
  integration: "Webhook self-disabling and iFrame breakage are the kind of silent failures that don't generate support tickets — they generate cancellations. High AI solvability makes this a strong quick-win candidate for enterprise accounts.",
  mobile: "Steady signal across App Store reviews and G2. Not the loudest theme but the most competitive — DocuSign is cited by name as the direct alternative chosen because of mobile. A gap that compounds over time.",
  pricing: "Consistent pain especially in SMB. Lower AI solvability because it's a packaging and transparency problem, not a product one. Worth a roadmap slot but likely requires business model input beyond PM scope alone.",
}

const PHASES = [
  {
    id: 1, label: 'Listen & map', window: 'Days 1–30', bg: '#1a1a2e',
    actions: [
      { icon: 'ti-eye', title: 'Shadow daily send workflows with 5 power users', why: 'The new UI regression is most visible watching someone who sends 10+ documents a day — exactly where the 5→30 minute complaint lives', themes: ['uiregression', 'workflow'] },
      { icon: 'ti-users', title: 'Interview 15 enterprise admins specifically about template setup', why: 'Workflow config pain is worst for admins building templates for others — a segment often missed in general user interviews', themes: ['workflow'] },
      { icon: 'ti-terminal', title: 'Audit every active integration partner and their webhook failure rate', why: 'Integration failures are silent — CS tickets undercount them. Going direct to the data surfaces the real scope', themes: ['integration'] },
      { icon: 'ti-device-mobile', title: 'Complete a full send-sign-manage flow using only the iOS app', why: 'Doing it yourself is faster than reading App Store reviews and reveals exactly where the mobile dead end is', themes: ['mobile'] },
      { icon: 'ti-chart-bar', title: 'Map all 6 themes against current roadmap and recent sprint history', why: "Avoid duplicating in-flight work or contradicting decisions already made — establish what's known before proposing anything", themes: ['workflow', 'uiregression', 'integration', 'pricing', 'mobile', 'recipient'] },
    ],
  },
  {
    id: 2, label: 'Scope & align', window: 'Days 31–60', bg: '#3B0F70',
    actions: [
      { icon: 'ti-bolt', title: 'Define a specific “send time” reduction target for the workflow config fix', why: 'The community threads cite exact time regressions (5 min → 30 min). Setting a concrete reversal target makes the sprint accountable', themes: ['workflow', 'uiregression'] },
      { icon: 'ti-cpu', title: 'Prototype AI-assisted field placement with one real template type', why: 'Test on the highest-volume template category first — most likely an NDA or offer letter — to validate the AI solvability assumption before scoping a full build', themes: ['workflow'] },
      { icon: 'ti-code', title: 'Write a spec for webhook self-healing with auto-retry and admin alerting', why: 'The fix is known — auto-disable without recovery is the exact documented failure mode. The gap is prioritization and spec, not discovery', themes: ['integration'] },
      { icon: 'ti-file-description', title: 'Write PRDs for top 2 initiatives with explicit go/no-go criteria', why: 'Scope creep and missing criteria contributed to the 2024 redesign outcome — the bar for shipping needs to be defined before build begins', themes: ['workflow', 'uiregression'] },
      { icon: 'ti-building', title: 'Align with enterprise sales on which accounts cite sign friction as a renewal risk', why: 'Converts abstract pain themes into named accounts — makes the business case for prioritization concrete to stakeholders', themes: ['workflow', 'uiregression', 'integration', 'recipient'] },
    ],
  },
  {
    id: 3, label: 'Ship & measure', window: 'Days 61–90', bg: '#8C2981',
    actions: [
      { icon: 'ti-rocket', title: 'Beta the workflow config improvement with 50 accounts flagged as churn-risk', why: "Churn-risk accounts give the sharpest signal — if the fix moves retention there, it moves it everywhere", themes: ['workflow', 'uiregression'] },
      { icon: 'ti-clock', title: 'Measure actual time-to-send before and after for beta cohort', why: 'The complaint was specific (5 min → 30 min) so the validation should be equally specific — not NPS, actual task time', themes: ['workflow', 'uiregression'] },
      { icon: 'ti-user-check', title: 'Run 10 structured recipient interviews on the signing experience', why: "Recipient friction is the most underresearched theme — no prior team is likely to have this data, making it a fast differentiated insight", themes: ['recipient'] },
      { icon: 'ti-trending-up', title: 'Track feature exposure vs. utilization on new config flow', why: 'If users see the new flow but revert to workarounds, the friction has shifted — not been removed', themes: ['workflow', 'uiregression'] },
      { icon: 'ti-presentation', title: 'Present findings, beta results, and updated roadmap to leadership', why: '90 days is long enough for a real data story — time-to-send delta, retention movement, and recipient research are three concrete outputs', themes: ['workflow', 'uiregression', 'integration', 'pricing', 'mobile', 'recipient'] },
    ],
  },
]

const score = t => Math.round(((t.cv * 0.35) + (t.ui * 0.40) + (t.ai * 0.25)) * 10) / 10

function DonutChart({ themes }) {
  const tot = themes.reduce((s, t) => s + t.vol, 0)
  const paths = []
  let ang = -Math.PI / 2
  const R = 82, r = 55, cx = 90, cy = 90

  themes.forEach(t => {
    const sl = (t.vol / tot) * Math.PI * 2
    const gap = 0.03
    const a1 = ang + gap
    const a2 = ang + sl - gap
    ang += sl
    if (a2 <= a1) return
    const lf = sl > Math.PI ? 1 : 0
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1)
    const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2)
    const x3 = cx + r * Math.cos(a2), y3 = cy + r * Math.sin(a2)
    const x4 = cx + r * Math.cos(a1), y4 = cy + r * Math.sin(a1)
    paths.push(
      <path key={t.id} d={`M${x1},${y1}A${R},${R},0,${lf},1,${x2},${y2}L${x3},${y3}A${r},${r},0,${lf},0,${x4},${y4}Z`} fill={t.accent} />
    )
  })

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 180 180" width="180" height="180">{paths}</svg>
      <div className="donut-center">
        <div className="donut-n">{themes.length}</div>
        <div className="donut-lbl">themes</div>
      </div>
    </div>
  )
}

function Legend({ themes }) {
  const tot = themes.reduce((s, t) => s + t.vol, 0)
  const hasReal = themes.some(t => t.n !== null)
  const totalN = themes.reduce((s, t) => s + (t.n || 0), 0)
  return (
    <div className="legend">
      <div className="leg-n-note">
        {hasReal ? `n = ${totalN.toLocaleString()} feedback items` : 'Proportions based on manual source review'}
      </div>
      {themes.map(t => {
        const pct = Math.round((t.vol / tot) * 100)
        return (
          <div key={t.id} className="leg-row">
            <div className="leg-sw" style={{ background: t.accent }} />
            <span className="leg-name">{t.title}</span>
            <span className="leg-pct">{pct}%</span>
            <span className="leg-n">{t.n !== null ? `n=${t.n}` : 'est.'}</span>
          </div>
        )
      })}
    </div>
  )
}

function ThemeCards({ allThemes, visibleThemes }) {
  const visibleIds = new Set(visibleThemes.map(t => t.id))
  return (
    <div className="cards">
      {allThemes.filter(t => visibleIds.has(t.id)).map(t => {
        const bc = t.rec === 'live' ? 'b-live' : t.rec === 'recent' ? 'b-recent' : 'b-old'
        const bl = t.rec === 'live' ? 'Active through 2025' : t.rec === 'recent' ? 'Verified early 2025' : 'Verified late 2024'
        return (
          <div key={t.id} className="card">
            <div className="card-top-bar" style={{ background: t.accent }} />
            <div className="card-name">{t.title}</div>
            <div className="card-desc">{t.desc}</div>
            <div className="card-footer"><span className={`badge ${bc}`}>{bl}</span></div>
          </div>
        )
      })}
    </div>
  )
}

function PrioTable({ themes }) {
  const sorted = [...themes].map(t => ({ ...t, s: score(t) })).sort((a, b) => b.s - a.s)
  return (
    <div className="ptable-wrap">
      <div className="pformula">
        <div className="pformula-eq">Pulse-check score = (Complaint Volume × 0.35) + (Usage Impact × 0.40) + (AI Solvability × 0.25)</div>
        <div className="dim-row"><span className="dim-label">Complaint Volume</span><span className="dim-def">How frequently and severely this pain appears across sources</span></div>
        <div className="dim-row"><span className="dim-label">Usage Impact</span><span className="dim-def">How much this pain reduces day-to-day product utilization — weighted highest because e-signature churn starts at workflow abandonment</span></div>
        <div className="dim-row"><span className="dim-label">AI Solvability</span><span className="dim-def">How meaningfully an AI-driven solution could address this pain point</span></div>
        <div className="pformula-note">Primary ranking driver is the rationale column — scores confirm directional alignment. Ranks 1 and 2 are highlighted as recommended immediate focus.</div>
      </div>
      <table className="ptable">
        <thead>
          <tr>
            <th style={{ width: 36 }}>Rank</th>
            <th>Pain point</th>
            <th style={{ width: 68 }}>Pulse-check</th>
            <th style={{ width: 68 }}>Quick win</th>
            <th>Rationale</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => (
            <tr key={t.id}>
              <td><span className={`rnk ${i === 0 ? 'r1' : i === 1 ? 'r2' : 'rn'}`}>{i + 1}</span></td>
              <td style={{ fontWeight: 500 }}>{t.title}</td>
              <td><span className={`sc ${t.s >= 8 ? 'sc-h' : t.s >= 7 ? 'sc-m' : 'sc-l'}`}>{t.s}</span></td>
              <td>{t.ai >= 7 && t.cv >= 7 ? <span className="qwy">✓ Yes</span> : <span className="qwn">—</span>}</td>
              <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{RATIONALE[t.id] || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function getTagLabel(ids, allThemes) {
  if (ids.length >= 5) return '→ All themes'
  return '→ ' + ids.map(id => {
    const t = allThemes.find(x => x.id === id)
    return t ? t.title.split(' ').slice(0, 2).join(' ') : ''
  }).filter(Boolean).join(' · ')
}

function PlanGrid({ allThemes }) {
  return (
    <div className="plan-grid">
      {PHASES.map(ph => (
        <div key={ph.id} className="pcol">
          <div className="phdr" style={{ background: ph.bg }}>
            <div className="pphase">Phase {ph.id}</div>
            <div className="ptheme">{ph.label}</div>
            <div className="pwin">{ph.window}</div>
          </div>
          <div className="pbody">
            {ph.actions.map((a, ai) => {
              const borderColor = a.themes.length >= 5
                ? 'var(--color-border-secondary)'
                : allThemes.find(x => x.id === a.themes[0])?.accent || 'var(--color-border-tertiary)'
              const tagColor = a.themes.length >= 5
                ? 'var(--color-text-tertiary)'
                : allThemes.find(x => x.id === a.themes[0])?.accent || 'var(--color-text-tertiary)'
              return (
                <div key={ai} className="ac" style={{ borderLeftColor: borderColor }}>
                  <div className="act">
                    <i className={`ti ${a.icon} aci`} aria-hidden="true" />
                    <div className="acn">{a.title}</div>
                  </div>
                  <div className="acw">{a.why}</div>
                  <span className="ac-tag" style={{ color: tagColor }}>{getTagLabel(a.themes, allThemes)}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [cur, setCur] = useState('all')

  const visibleThemes = useMemo(() => {
    const cutoff = CUTS[cur]
    return cutoff ? themesData.filter(t => t.ls >= cutoff) : themesData
  }, [cur])

  const fnote = cur === 'all'
    ? `${visibleThemes.length} themes`
    : visibleThemes.length
      ? `${visibleThemes.length} of ${themesData.length} themes in this window`
      : 'No themes in this window — will populate once live scraper is connected'

  return (
    <div className="w">
      <h2 className="sr-only">Acrobat Sign customer feedback analysis — PM brief by Rajat Singh</h2>

      <div className="hdr">
        <div className="hdr-l">
          <span className="ar-mark">Ar</span>
          <div>
            <div className="hdr-title">Acrobat Sign — Customer Feedback Analysis</div>
            <div className="hdr-sub">Product brief by Rajat Singh</div>
          </div>
        </div>
        <div className="hdr-r"><strong>May 2026</strong></div>
      </div>

      <div className="exec-box">
        <div className="exec-lbl">What the research says</div>
        <div className="exec-text">
          Acrobat Sign&apos;s core problem is not a missing feature — it&apos;s accumulated friction at the moments users rely on most. The loudest and most sustained signal across every source is the 2024–2025 interface redesign, which turned routine 5-minute sends into 20–30 minute ordeals and generated one of Adobe&apos;s longest-running community complaint threads. Behind it sits a deeper structural issue: the template and workflow configuration system is too brittle for the enterprise admins who depend on it daily. Integration failures compound this — webhooks that silently self-disable and iFrame sign flows broken by third-party cookie changes are the kind of invisible breakdowns that produce churn before a single support ticket is filed. Pricing opacity and a mobile experience that dead-ends at basic signing round out a picture of a product with strong foundational trust but meaningful gaps in the daily workflows of its most active users. The opportunity is real: the top two themes both have high AI solvability, and fixing them would disproportionately benefit the enterprise segment where Acrobat Sign&apos;s retention risk is highest.
        </div>
      </div>

      <div className="eyebrow">Section 1</div>
      <div className="sh">Customer pain landscape</div>
      <div className="sd">All feedback is sourced exclusively from Acrobat Sign — not Acrobat or Adobe broadly.</div>

      <div className="src-box">
        <div className="src-box-lbl">Source universe</div>
        <div className="src-cats">
          <div>
            <div className="src-cat-lbl">Review platforms</div>
            {[['#3B0F70','G2'],['#8C2981','Capterra'],['#C73E4C','TrustRadius'],['#E8692A','SoftwareAdvice'],['#F59033','Trustpilot'],['#F8C840','Gartner Peer Insights']].map(([c,l]) => (
              <div key={l} className="src-item"><div className="src-dot" style={{ background: c }} />{l}</div>
            ))}
          </div>
          <div>
            <div className="src-cat-lbl">Community &amp; forums</div>
            <div className="src-item"><div className="src-dot" style={{ background: '#3B0F70' }} />Adobe Community (Sign subforum)</div>
            <div className="src-item"><div className="src-dot" style={{ background: '#8C2981' }} />Reddit (r/sysadmin, r/legaltech)</div>
          </div>
          <div>
            <div className="src-cat-lbl">App stores</div>
            <div className="src-item"><div className="src-dot" style={{ background: '#C73E4C' }} />iOS App Store</div>
          </div>
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-lbl">Feedback window:</span>
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`fbtn${cur === f.key ? ' on' : ''}`}
            onClick={() => setCur(f.key)}
          >{f.label}</button>
        ))}
        <span className="fnote">{fnote}</span>
      </div>

      <div className="viz-wrap">
        <DonutChart themes={visibleThemes} />
        <Legend themes={visibleThemes} />
      </div>
      <div className="chart-disclaimer">Volume proportions are estimates based on source review frequency.</div>

      <ThemeCards allThemes={themesData} visibleThemes={visibleThemes} />

      <div className="divider" />

      <div className="eyebrow">Section 2</div>
      <div className="sh">Prioritization</div>
      <div className="sd">Ranked by subjective judgment based on source review — the score is a directional pulse-check, not a precise measurement.</div>
      <PrioTable themes={visibleThemes} />

      <div className="divider" />

      <div className="eyebrow">Section 3</div>
      <div className="sh">First 90 days</div>
      <div className="sd">Actions derived directly from the themes above. Each card is color-coded to its target theme. Standard onboarding activities — team introductions, tooling access, process ramp-up — run in parallel and are not listed here.</div>

      <div className="plan-legend">
        <span className="pl-lbl">Color key:</span>
        {themesData.map(t => (
          <div key={t.id} className="pl-item">
            <div className="pl-sw" style={{ background: t.accent }} />
            {t.title.split(' ').slice(0, 2).join(' ')}
          </div>
        ))}
      </div>

      <PlanGrid allThemes={themesData} />

      <div className="fn">
        <div className="fnl">Methodology note</div>
        <div className="fnt">All themes are sourced exclusively from Acrobat Sign feedback — not Acrobat or Adobe broadly. Volume proportions and signal scores are the author&apos;s estimates based on manual source review across G2, Capterra, TrustRadius, Adobe Community, Reddit, and the iOS App Store. Last research pass: September 2025.</div>
      </div>
    </div>
  )
}
