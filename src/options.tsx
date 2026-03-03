import { useEffect, useState } from "react"
import { getSettings, saveSettings } from "./storage"
import { getClosedPages, clearClosedPages, removeClosedPage, getAppStats, getDomainStats } from "./storage"
import type { Settings, ClosedPage, DomainStats } from "./types"
import { DEFAULT_SETTINGS } from "./types"
import { formatTime } from "./utils"

type TabType = "settings" | "history" | "report"

function OptionsIndex() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [whitelistText, setWhitelistText] = useState("")
  const [closedCount, setClosedCount] = useState(0)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("settings")
  const [closedPages, setClosedPages] = useState<ClosedPage[]>([])
  const [domainStats, setDomainStats] = useState<Record<string, DomainStats>>({})
  const [appStats, setAppStats] = useState<{totalClosed: number, totalTimeSaved: number}>({totalClosed: 0, totalTimeSaved: 0})

  useEffect(() => {
    Promise.all([loadSettings(), loadClosedCount()])
  }, [])

  useEffect(() => {
    if (activeTab === "history") {
      loadClosedPages()
    } else if (activeTab === "report") {
      loadStats()
    }
  }, [activeTab])

  async function loadSettings() {
    const s = await getSettings()
    setSettings(s)
    setWhitelistText(s.whitelistedDomains.join("\n"))
  }

  async function loadClosedCount() {
    const result = await chrome.storage.local.get("closedCount")
    setClosedCount(result.closedCount || 0)
  }

  async function loadClosedPages() {
    const pages = await getClosedPages()
    setClosedPages(pages)
  }

  async function loadStats() {
    const [stats, domains] = await Promise.all([
      getAppStats(),
      getDomainStats()
    ])
    setAppStats({ totalClosed: stats.totalClosed, totalTimeSaved: stats.totalTimeSaved })
    setDomainStats(domains)
  }

  async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const newSettings = { ...settings, [key]: value }
    await saveSettings(newSettings)
    setSettings(newSettings)
    showSaved()
  }

  function showSaved() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleWhitelistChange(text: string) {
    setWhitelistText(text)
    const domains = text
      .split("\n")
      .map(d => d.trim())
      .filter(d => d.length > 0)
    await saveSettings({ whitelistedDomains: domains })
    showSaved()
  }

  async function resetStats() {
    await chrome.storage.local.set({ closedCount: 0 })
    setClosedCount(0)
    showSaved()
  }

  async function handleClearHistory() {
    await clearClosedPages()
    setClosedPages([])
    showSaved()
  }

  async function handleRemovePage(id: string) {
    await removeClosedPage(id)
    await loadClosedPages()
  }

  async function handleRestorePage(page: ClosedPage) {
    await chrome.tabs.create({ url: page.url, active: false })
    await removeClosedPage(page.id)
    await loadClosedPages()
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const topDomains = Object.values(domainStats)
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 10)

  return (
    <div style={styles.page}>
      {saved && <div style={styles.savedToast}>Settings saved</div>}
      
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.logo}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <rect x="4" y="8" width="16" height="10" rx="1" fill="currentColor" opacity="0.2"/>
                <path d="M8 13L10 15L14 11" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 style={styles.title}>Tab Manager</h1>
              <p style={styles.subtitle}>Smart tab management for Chrome</p>
            </div>
          </div>
          <div style={styles.statsBadge}>
            <span style={styles.statsNumber}>{closedCount}</span>
            <span style={styles.statsLabel}>tabs closed</span>
            <button style={styles.resetBtn} onClick={resetStats}>Reset</button>
          </div>
        </header>

        <nav style={styles.nav}>
          <button 
            style={{...styles.navBtn, ...(activeTab === "settings" ? styles.navBtnActive : {})}}
            onClick={() => setActiveTab("settings")}
          >
            <svg style={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>
          <button 
            style={{...styles.navBtn, ...(activeTab === "history" ? styles.navBtnActive : {})}}
            onClick={() => setActiveTab("history")}
          >
            <svg style={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            History
          </button>
          <button 
            style={{...styles.navBtn, ...(activeTab === "report" ? styles.navBtnActive : {})}}
            onClick={() => setActiveTab("report")}
          >
            <svg style={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Report
          </button>
        </nav>

        <main style={styles.main}>
          {activeTab === "settings" && (
            <>
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Tab Grouping</h2>
                <div style={styles.settingCard}>
                  <div style={styles.settingInfo}>
                    <div style={styles.settingLabel}>Auto-group by domain</div>
                    <div style={styles.settingDesc}>Automatically organize new tabs into groups based on their domain</div>
                  </div>
                  <button
                    style={{ ...styles.toggle, ...(settings.autoGroupEnabled ? styles.toggleActive : {}) }}
                    onClick={() => updateSetting("autoGroupEnabled", !settings.autoGroupEnabled)}
                  >
                    <div style={{ ...styles.toggleKnob, ...(settings.autoGroupEnabled ? styles.toggleKnobActive : {}) }} />
                  </button>
                </div>
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Auto-close Settings</h2>
                <div style={styles.settingCard}>
                  <div style={styles.settingInfo}>
                    <div style={styles.settingLabel}>Auto-close inactive tabs</div>
                    <div style={styles.settingDesc}>Close tabs that have not been used for a specified period</div>
                  </div>
                  <button
                    style={{ ...styles.toggle, ...(settings.autoCloseEnabled ? styles.toggleActive : {}) }}
                    onClick={() => updateSetting("autoCloseEnabled", !settings.autoCloseEnabled)}
                  >
                    <div style={{ ...styles.toggleKnob, ...(settings.autoCloseEnabled ? styles.toggleKnobActive : {}) }} />
                  </button>
                </div>

                <div style={styles.settingsGrid}>
                  <div style={styles.inputCard}>
                    <label style={styles.inputLabel}>Inactive threshold</label>
                    <div style={styles.inputRow}>
                      <input
                        style={styles.numberInput}
                        type="number"
                        min={1}
                        max={1440}
                        value={settings.inactiveMinutes}
                        onChange={(e) => updateSetting("inactiveMinutes", Math.max(1, Math.min(1440, parseInt(e.target.value, 10) || 60)))}
                      />
                      <span style={styles.inputUnit}>minutes</span>
                    </div>
                    <div style={styles.inputHint}>Time before a tab is considered inactive</div>
                  </div>

                  <div style={styles.inputCard}>
                    <label style={styles.inputLabel}>Check interval</label>
                    <div style={styles.inputRow}>
                      <input
                        style={styles.numberInput}
                        type="number"
                        min={1}
                        max={60}
                        value={settings.checkIntervalMinutes}
                        onChange={(e) => updateSetting("checkIntervalMinutes", Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 5)))}
                      />
                      <span style={styles.inputUnit}>minutes</span>
                    </div>
                    <div style={styles.inputHint}>How often to check for inactive tabs</div>
                  </div>
                </div>
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Smart Close</h2>
                <p style={styles.sectionDesc}>Automatically adjust close time for frequently visited pages</p>
                <div style={styles.settingCard}>
                  <div style={styles.settingInfo}>
                    <div style={styles.settingLabel}>Enable smart close</div>
                    <div style={styles.settingDesc}>Extend close time for pages you visit frequently</div>
                  </div>
                  <button
                    style={{ ...styles.toggle, ...(settings.enableSmartClose ? styles.toggleActive : {}) }}
                    onClick={() => updateSetting("enableSmartClose", !settings.enableSmartClose)}
                  >
                    <div style={{ ...styles.toggleKnob, ...(settings.enableSmartClose ? styles.toggleKnobActive : {}) }} />
                  </button>
                </div>

                {settings.enableSmartClose && (
                  <div style={styles.settingsGrid}>
                    <div style={styles.inputCard}>
                      <label style={styles.inputLabel}>Visit threshold</label>
                      <div style={styles.inputRow}>
                        <input
                          style={styles.numberInput}
                          type="number"
                          min={3}
                          max={100}
                          value={settings.frequentVisitThreshold}
                          onChange={(e) => updateSetting("frequentVisitThreshold", Math.max(3, Math.min(100, parseInt(e.target.value, 10) || 10)))}
                        />
                        <span style={styles.inputUnit}>visits</span>
                      </div>
                      <div style={styles.inputHint}>Min visits to be considered frequent</div>
                    </div>

                    <div style={styles.inputCard}>
                      <label style={styles.inputLabel}>Time multiplier</label>
                      <div style={styles.inputRow}>
                        <input
                          style={styles.numberInput}
                          type="number"
                          min={2}
                          max={10}
                          value={settings.frequentVisitMultiplier}
                          onChange={(e) => updateSetting("frequentVisitMultiplier", Math.max(2, Math.min(10, parseInt(e.target.value, 10) || 3)))}
                        />
                        <span style={styles.inputUnit}>x</span>
                      </div>
                      <div style={styles.inputHint}>Multiply threshold for frequent pages</div>
                    </div>
                  </div>
                )}
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Protected Domains</h2>
                <p style={styles.sectionDesc}>Domains listed below will never be auto-closed. Enter one domain per line.</p>
                <textarea
                  style={styles.textarea}
                  placeholder="google.com&#10;github.com&#10;stackoverflow.com"
                  value={whitelistText}
                  onChange={(e) => handleWhitelistChange(e.target.value)}
                />
              </section>
            </>
          )}

          {activeTab === "history" && (
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Closed Pages History</h2>
                <button style={styles.clearBtn} onClick={handleClearHistory}>Clear All</button>
              </div>
              <p style={styles.sectionDesc}>View and restore recently closed tabs</p>
              
              {closedPages.length === 0 ? (
                <div style={styles.emptyState}>
                  <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                  <p>No closed pages yet</p>
                </div>
              ) : (
                <div style={styles.historyList}>
                  {closedPages.map(page => (
                    <div key={page.id} style={styles.historyItem}>
                      <div style={styles.historyInfo}>
                        <div style={styles.historyTitle}>{page.title}</div>
                        <div style={styles.historyDomain}>{page.domain}</div>
                      </div>
                      <div style={styles.historyMeta}>
                        <span style={styles.historyTime}>{formatDate(page.closedAt)}</span>
                        <button 
                          style={styles.restoreBtn}
                          onClick={() => handleRestorePage(page)}
                        >
                          Restore
                        </button>
                        <button 
                          style={styles.deleteBtn}
                          onClick={() => handleRemovePage(page.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "report" && (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Usage Analytics</h2>
              <p style={styles.sectionDesc}>Insights into your tab usage patterns</p>
              
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statCardValue}>{appStats.totalClosed}</div>
                  <div style={styles.statCardLabel}>Total Closed</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statCardValue}>{formatTime(Math.floor(appStats.totalTimeSaved / 60000))}</div>
                  <div style={styles.statCardLabel}>Est. Time Saved</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statCardValue}>{Object.keys(domainStats).length}</div>
                  <div style={styles.statCardLabel}>Domains Tracked</div>
                </div>
              </div>

              <h3 style={styles.subsectionTitle}>Top Domains</h3>
              <div style={styles.domainList}>
                {topDomains.length === 0 ? (
                  <div style={styles.emptyState}>
                    <p>No domain data yet. Start browsing!</p>
                  </div>
                ) : (
                  topDomains.map(domain => (
                    <div key={domain.domain} style={styles.domainItem}>
                      <div style={styles.domainInfo}>
                        <div style={styles.domainName}>{domain.domain}</div>
                        <div style={styles.domainStats}>
                          {domain.visitCount} visits · {domain.closedCount} closed
                        </div>
                      </div>
                      <div style={styles.domainBar}>
                        <div 
                          style={{
                            ...styles.domainBarFill,
                            width: `${Math.min(100, (domain.visitCount / (topDomains[0]?.visitCount || 1)) * 100)}%`
                          }} 
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </main>

        <footer style={styles.footer}>
          <div style={styles.footerContent}>
            <span>Tab Manager v1.0.0</span>
            <a 
              style={styles.githubLink}
              href="https://github.com/joe223/tab-manager"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg style={styles.githubIcon} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#fafafa',
    color: '#1a1a1a',
    minHeight: '100vh'
  },
  container: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '0 24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '32px 0',
    borderBottom: '1px solid #eee',
    marginBottom: 32
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 16
  },
  logo: {
    width: 52,
    height: 52,
    background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff'
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.5px'
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    margin: '4px 0 0'
  },
  statsBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fff',
    padding: '8px 16px',
    borderRadius: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  },
  statsNumber: {
    fontSize: 20,
    fontWeight: 700,
    color: '#4F46E5'
  },
  statsLabel: {
    fontSize: 13,
    color: '#888'
  },
  resetBtn: {
    background: '#f5f5f7',
    border: 'none',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    color: '#666',
    cursor: 'pointer',
    marginLeft: 8
  },
  main: {
    paddingBottom: 48
  },
  section: {
    marginBottom: 40
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: '0 0 16px',
    color: '#1a1a1a'
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
    margin: '0 0 16px'
  },
  settingCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff',
    padding: 20,
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  },
  settingInfo: {
    flex: 1
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: 500,
    marginBottom: 4
  },
  settingDesc: {
    fontSize: 13,
    color: '#888'
  },
  toggle: {
    width: 48,
    height: 28,
    background: '#e5e5e5',
    borderRadius: 14,
    border: 'none',
    cursor: 'pointer',
    padding: 2,
    transition: 'background 0.2s',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: 16
  },
  toggleActive: {
    background: '#4F46E5'
  },
  toggleKnob: {
    width: 24,
    height: 24,
    background: '#fff',
    borderRadius: '50%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s'
  },
  toggleKnobActive: {
    transform: 'translateX(20px)'
  },
  settingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
    marginTop: 16
  },
  inputCard: {
    background: '#fff',
    padding: 16,
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  },
  inputLabel: {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 8
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  numberInput: {
    width: 80,
    padding: '10px 12px',
    border: '1px solid #e5e5e5',
    borderRadius: 8,
    fontSize: 15,
    textAlign: 'center' as const,
    outline: 'none'
  },
  inputUnit: {
    fontSize: 13,
    color: '#888'
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8
  },
  textarea: {
    width: '100%',
    padding: 16,
    border: '1px solid #e5e5e5',
    borderRadius: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    resize: 'vertical' as const,
    minHeight: 120,
    outline: 'none',
    boxSizing: 'border-box' as const,
    background: '#fff'
  },
  savedToast: {
    position: 'fixed',
    top: 24,
    right: 24,
    background: '#10B981',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
    zIndex: 1000
  },
  footer: {
    textAlign: 'center' as const,
    padding: '24px 0',
    borderTop: '1px solid #eee',
    fontSize: 13,
    color: '#888'
  },
  footerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16
  },
  githubLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: '#666',
    textDecoration: 'none',
    transition: 'color 0.2s'
  },
  githubIcon: {
    width: 16,
    height: 16
  },
  footerDot: {
    margin: '0 8px'
  },
  nav: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
    borderBottom: '1px solid #eee',
    paddingBottom: 0
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: 14,
    fontWeight: 500,
    color: '#666',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: -1
  },
  navBtnActive: {
    color: '#4F46E5',
    borderBottomColor: '#4F46E5'
  },
  navIcon: {
    width: 18,
    height: 18
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  clearBtn: {
    padding: '8px 16px',
    background: '#FEE2E2',
    color: '#DC2626',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#888'
  },
  emptyIcon: {
    width: 48,
    height: 48,
    marginBottom: 16,
    opacity: 0.3
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff',
    padding: '12px 16px',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  },
  historyInfo: {
    flex: 1,
    minWidth: 0
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  historyDomain: {
    fontSize: 12,
    color: '#888',
    marginTop: 2
  },
  historyMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginLeft: 16
  },
  historyTime: {
    fontSize: 12,
    color: '#888',
    whiteSpace: 'nowrap'
  },
  restoreBtn: {
    padding: '6px 12px',
    background: '#EEF2FF',
    color: '#4F46E5',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer'
  },
  deleteBtn: {
    width: 24,
    height: 24,
    background: '#F5F5F5',
    border: 'none',
    borderRadius: 6,
    fontSize: 16,
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 32
  },
  statCard: {
    background: '#fff',
    padding: 20,
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    textAlign: 'center'
  },
  statCardValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#4F46E5'
  },
  statCardLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 4
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: '0 0 16px',
    color: '#1a1a1a'
  },
  domainList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  domainItem: {
    background: '#fff',
    padding: '12px 16px',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  },
  domainInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  domainName: {
    fontSize: 14,
    fontWeight: 500
  },
  domainStats: {
    fontSize: 12,
    color: '#888'
  },
  domainBar: {
    height: 6,
    background: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden'
  },
  domainBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
    borderRadius: 3,
    transition: 'width 0.3s'
  }
}

export default OptionsIndex
