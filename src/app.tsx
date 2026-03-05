import { useState, useEffect } from "react"
import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom"
import { getSettings, saveSettings, getClosedCount, getClosedTabsHistory, removeClosedTab, clearClosedHistory, getAnalyticsData } from "./storage"
import type { Settings, ClosedTab } from "./types"
import { DEFAULT_SETTINGS } from "./types"

function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [whitelistText, setWhitelistText] = useState("")
  const [closedCount, setClosedCount] = useState(0)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([loadSettings(), loadClosedCount()])
  }, [])

  async function loadSettings() {
    const s = await getSettings()
    setSettings(s)
    setWhitelistText(s.whitelistedDomains.join("\n"))
  }

  async function loadClosedCount() {
    const result = await chrome.storage.local.get("closedCount")
    setClosedCount(result.closedCount || 0)
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
    const domains = text.split("\n").map(d => d.trim()).filter(d => d.length > 0)
    await saveSettings({ whitelistedDomains: domains })
    showSaved()
  }

  async function resetStats() {
    await chrome.storage.local.set({ closedCount: 0 })
    setClosedCount(0)
    showSaved()
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.logo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>Settings</h1>
            <p style={styles.subtitle}>Configure Tab Manager</p>
          </div>
        </header>

        <main style={styles.main}>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Auto Features</h2>
            <div style={styles.setting}>
              <div>
                <div style={styles.settingLabel}>Auto-group tabs</div>
                <div style={styles.settingDesc}>Automatically group new tabs by domain</div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings.autoGroupEnabled}
                  onChange={(e) => updateSetting('autoGroupEnabled', e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={{
                  ...styles.toggleSlider,
                  ...(settings.autoGroupEnabled ? styles.toggleSliderActive : {})
                }} />
              </label>
            </div>
            <div style={styles.setting}>
              <div>
                <div style={styles.settingLabel}>Cross-window group</div>
                <div style={styles.settingDesc}>Group tabs across different windows</div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings.crossWindowGroupEnabled}
                  onChange={(e) => updateSetting('crossWindowGroupEnabled', e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={{
                  ...styles.toggleSlider,
                  ...(settings.crossWindowGroupEnabled ? styles.toggleSliderActive : {})
                }} />
              </label>
            </div>
            <div style={styles.setting}>
              <div>
                <div style={styles.settingLabel}>Auto-close inactive</div>
                <div style={styles.settingDesc}>Automatically close tabs inactive for {settings.inactiveMinutes} minutes</div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings.autoCloseEnabled}
                  onChange={(e) => updateSetting('autoCloseEnabled', e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={{
                  ...styles.toggleSlider,
                  ...(settings.autoCloseEnabled ? styles.toggleSliderActive : {})
                }} />
              </label>
            </div>
            <div style={styles.setting}>
              <div>
                <div style={styles.settingLabel}>Close last tab</div>
                <div style={styles.settingDesc}>Allow closing the last tab in a window</div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings.closeLastTabEnabled}
                  onChange={(e) => updateSetting('closeLastTabEnabled', e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={{
                  ...styles.toggleSlider,
                  ...(settings.closeLastTabEnabled ? styles.toggleSliderActive : {})
                }} />
              </label>
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Timing</h2>
            <div style={styles.setting}>
              <div>
                <div style={styles.settingLabel}>Inactive threshold (minutes)</div>
              </div>
              <input
                type="number"
                value={settings.inactiveMinutes}
                onChange={(e) => updateSetting('inactiveMinutes', parseInt(e.target.value) || 60)}
                style={styles.input}
                min={1}
              />
            </div>
            <div style={styles.setting}>
              <div>
                <div style={styles.settingLabel}>Check interval (minutes)</div>
              </div>
              <input
                type="number"
                value={settings.autoCloseInterval}
                onChange={(e) => updateSetting('autoCloseInterval', parseInt(e.target.value) || 5)}
                style={styles.input}
                min={1}
              />
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Whitelist</h2>
            <div style={styles.settingDesc}>Domains that will never be auto-closed (one per line)</div>
            <textarea
              value={whitelistText}
              onChange={(e) => handleWhitelistChange(e.target.value)}
              style={styles.textarea}
              placeholder="google.com&#10;github.com"
            />
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>History</h2>
            <div style={styles.setting}>
              <div>
                <div style={styles.settingLabel}>Closed history enabled</div>
                <div style={styles.settingDesc}>Track closed tabs for recovery</div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings.closedHistoryEnabled}
                  onChange={(e) => updateSetting('closedHistoryEnabled', e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={{
                  ...styles.toggleSlider,
                  ...(settings.closedHistoryEnabled ? styles.toggleSliderActive : {})
                }} />
              </label>
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Analytics</h2>
            <div style={styles.setting}>
              <div>
                <div style={styles.settingLabel}>Analytics enabled</div>
                <div style={styles.settingDesc}>Collect data for the analytics report</div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings.analyticsEnabled}
                  onChange={(e) => updateSetting('analyticsEnabled', e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={{
                  ...styles.toggleSlider,
                  ...(settings.analyticsEnabled ? styles.toggleSliderActive : {})
                }} />
              </label>
            </div>
            <div style={styles.setting}>
              <div>
                <div style={styles.settingLabel}>Analytics days</div>
              </div>
              <input
                type="number"
                value={settings.analyticsDays}
                onChange={(e) => updateSetting('analyticsDays', parseInt(e.target.value) || 30)}
                style={styles.input}
                min={7}
                max={365}
              />
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Statistics</h2>
            <div style={styles.statRow}>
              <span>Total tabs closed:</span>
              <strong>{closedCount}</strong>
            </div>
            <button style={styles.btn} onClick={resetStats}>Reset Counter</button>
          </section>
        </main>

        {saved && <div style={styles.saved}>Settings saved</div>}
      </div>
    </div>
  )
}

function HistoryPage() {
  const [closedTabs, setClosedTabs] = useState<ClosedTab[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDomain, setFilterDomain] = useState("all")

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    const history = await getClosedTabsHistory()
    setClosedTabs(history.tabs)
  }

  function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  async function restoreTab(tab: ClosedTab) {
    await chrome.tabs.create({ url: tab.url, active: false })
    await removeClosedTab(tab.id)
    await loadHistory()
  }

  async function deleteTab(tabId: string) {
    await removeClosedTab(tabId)
    await loadHistory()
  }

  async function handleClearAll() {
    if (confirm('Are you sure you want to clear all closed tabs history?')) {
      await clearClosedHistory()
      await loadHistory()
    }
  }

  const domains = Array.from(new Set(closedTabs.map(t => t.domain).filter(Boolean)))

  const filteredTabs = closedTabs.filter(tab => {
    const matchesSearch = searchQuery === "" || 
      (tab.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       tab.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
       tab.domain?.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesDomain = filterDomain === "all" || tab.domain === filterDomain
    return matchesSearch && matchesDomain
  })

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.logo}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <h1 style={styles.title}>Closed Tabs</h1>
              <p style={styles.subtitle}>Recover your closed tabs</p>
            </div>
          </div>
          <button style={styles.dangerBtn} onClick={handleClearAll}>Clear All</button>
        </header>

        <div style={styles.filters}>
          <input
            type="text"
            placeholder="Search tabs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All Domains</option>
            {domains.map(domain => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
        </div>

        <main style={styles.main}>
          {filteredTabs.length === 0 ? (
            <div style={styles.emptyState}>
              {closedTabs.length === 0 ? <p>No closed tabs yet</p> : <p>No tabs match your search</p>}
            </div>
          ) : (
            <div style={styles.tabsList}>
              {filteredTabs.map(tab => (
                <div key={tab.id} style={styles.tabItem}>
                  <div style={styles.tabInfo}>
                    <div style={styles.tabTitle}>{tab.title || tab.url}</div>
                    <div style={styles.tabMeta}>
                      <span style={styles.domain}>{tab.domain}</span>
                      <span> · </span>
                      <span>{formatTimeAgo(tab.closedAt)}</span>
                      {tab.source === 'auto' && <span style={styles.autoBadge}> auto</span>}
                    </div>
                  </div>
                  <div style={styles.tabActions}>
                    <button style={styles.restoreBtn} onClick={() => restoreTab(tab)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                      </svg>
                      Restore
                    </button>
                    <button style={styles.deleteBtn} onClick={() => deleteTab(tab.id)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <footer style={styles.footer}>
          <span>{closedTabs.length} tabs in history</span>
        </footer>
      </div>
    </div>
  )
}

function ReportPage() {
  const [analytics, setAnalytics] = useState<{ daily: Record<string, any>; lastUpdated: string }>({ daily: {}, lastUpdated: '' })
  const [closedCount, setClosedCount] = useState(0)
  const [historyCount, setHistoryCount] = useState(0)
  const [dateRange, setDateRange] = useState(7)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const a = await getAnalyticsData()
    setAnalytics(a)
    const count = await getClosedCount()
    setClosedCount(count)
    const history = await getClosedTabsHistory()
    setHistoryCount(history.tabs.length)
  }

  function getDateRangeDates(): string[] {
    const dates: string[] = []
    const now = new Date()
    for (let i = dateRange - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      dates.push(d.toISOString().split('T')[0])
    }
    return dates
  }

  function getStatsForDateRange() {
    const dates = getDateRangeDates()
    return dates.map(date => analytics.daily[date] || {
      date,
      tabsOpened: 0,
      tabsClosed: 0,
      tabsAutoClosed: 0,
      tabsManuallyClosed: 0,
      domainsAccessed: 0,
      topDomains: []
    })
  }

  function getTotalStats() {
    const stats = getStatsForDateRange()
    return stats.reduce((acc, s) => ({
      opened: acc.opened + s.tabsOpened,
      closed: acc.closed + s.tabsClosed,
      auto: acc.auto + s.tabsAutoClosed,
      manual: acc.manual + s.tabsManuallyClosed
    }), { opened: 0, closed: 0, auto: 0, manual: 0 })
  }

  function getTopDomainsOverall() {
    const stats = getStatsForDateRange()
    const domainMap = new Map<string, number>()
    stats.forEach(s => {
      s.topDomains.forEach((d: { domain: string; count: number }) => {
        domainMap.set(d.domain, (domainMap.get(d.domain) || 0) + d.count)
      })
    })
    return Array.from(domainMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  function getMaxTabsValue() {
    const stats = getStatsForDateRange()
    return Math.max(...stats.map(s => Math.max(s.tabsOpened, s.tabsClosed)), 1)
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const totalStats = getTotalStats()
  const topDomains = getTopDomainsOverall()
  const maxValue = getMaxTabsValue()

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.logo}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div>
              <h1 style={styles.title}>Analytics Report</h1>
              <p style={styles.subtitle}>Tab usage insights</p>
            </div>
          </div>
          <div style={styles.dateSelector}>
            {[7, 14, 30].map(days => (
              <button
                key={days}
                style={{...styles.dateBtn, ...(dateRange === days ? styles.dateBtnActive : {})}}
                onClick={() => setDateRange(days)}
              >
                {days} Days
              </button>
            ))}
          </div>
        </header>

        <main style={styles.main}>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{closedCount}</div>
              <div style={styles.statLabel}>Total Closed</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{totalStats.opened}</div>
              <div style={styles.statLabel}>Opened</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{totalStats.closed}</div>
              <div style={styles.statLabel}>Closed</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{historyCount}</div>
              <div style={styles.statLabel}>In History</div>
            </div>
          </div>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Tabs Activity</h2>
            <div style={styles.chart}>
              <div style={styles.chartBars}>
                {getStatsForDateRange().map((stat, idx) => (
                  <div key={idx} style={styles.barGroup}>
                    <div style={styles.barContainer}>
                      <div style={{...styles.bar, height: `${(stat.tabsOpened / maxValue) * 100}%`, background: '#4F46E5'}} />
                      <div style={{...styles.bar, height: `${(stat.tabsClosed / maxValue) * 100}%`, background: '#ef4444'}} />
                    </div>
                    <div style={styles.barLabel}>{formatDate(stat.date)}</div>
                  </div>
                ))}
              </div>
              <div style={styles.chartLegend}>
                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#4F46E5'}} /> Opened</span>
                <span style={styles.legendItem}><span style={{...styles.legendDot, background: '#ef4444'}} /> Closed</span>
              </div>
            </div>
          </section>

          <div style={styles.splitSection}>
            <section style={styles.halfSection}>
              <h2 style={styles.sectionTitle}>Close Breakdown</h2>
              <div style={styles.breakdownItem}>
                <div style={styles.breakdownLabel}>
                  <span>Auto-closed</span>
                  <span style={styles.breakdownValue}>{totalStats.auto}</span>
                </div>
                <div style={styles.progressBar}>
                  <div style={{...styles.progressFill, width: `${totalStats.closed > 0 ? (totalStats.auto / totalStats.closed) * 100 : 0}%`, background: '#f59e0b'}} />
                </div>
              </div>
              <div style={styles.breakdownItem}>
                <div style={styles.breakdownLabel}>
                  <span>Manually closed</span>
                  <span style={styles.breakdownValue}>{totalStats.manual}</span>
                </div>
                <div style={styles.progressBar}>
                  <div style={{...styles.progressFill, width: `${totalStats.closed > 0 ? (totalStats.manual / totalStats.closed) * 100 : 0}%`, background: '#10b981'}} />
                </div>
              </div>
            </section>

            <section style={styles.halfSection}>
              <h2 style={styles.sectionTitle}>Top Domains</h2>
              <div style={styles.domainsList}>
                {topDomains.length === 0 ? (
                  <div style={styles.emptyState}>No data yet</div>
                ) : (
                  topDomains.slice(0, 5).map((domain, idx) => (
                    <div key={idx} style={styles.domainItem}>
                      <span style={styles.domainRank}>{idx + 1}</span>
                      <span style={styles.domainName}>{domain.domain}</span>
                      <span style={styles.domainCount}>{domain.count}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

function Navigation() {
  const location = useLocation()
  
  return (
    <nav style={styles.nav}>
      <Link to="/" style={{...styles.navLink, ...(location.pathname === '/' ? styles.navLinkActive : {})}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4"/>
        </svg>
        Settings
      </Link>
      <Link to="/history" style={{...styles.navLink, ...(location.pathname === '/history' ? styles.navLinkActive : {})}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        History
      </Link>
      <Link to="/report" style={{...styles.navLink, ...(location.pathname === '/report' ? styles.navLinkActive : {})}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
        </svg>
        Report
      </Link>
    </nav>
  )
}

function App() {
  return (
    <HashRouter>
      <Navigation />
      <Routes>
        <Route path="/" element={<SettingsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </HashRouter>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#fafafa', color: '#1a1a1a', minHeight: '100vh' },
  container: { maxWidth: 800, margin: '0 auto', padding: '0 24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0', borderBottom: '1px solid #eee', marginBottom: 24, flexWrap: 'wrap' as const, gap: 16 },
  headerContent: { display: 'flex', alignItems: 'center', gap: 16 },
  logo: { width: 44, height: 44, background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
  title: { fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 14, color: '#888', margin: '4px 0 0' },
  main: { paddingBottom: 48 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: '#1a1a1a' },
  setting: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' },
  settingLabel: { fontSize: 14, fontWeight: 500 },
  settingDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  toggle: { position: 'relative' as const, width: 44, height: 24, cursor: 'pointer' },
  checkbox: { opacity: 0, width: 0, height: 0 },
  toggleSlider: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, background: '#e5e5e5', borderRadius: 12, transition: '0.2s' },
  toggleSliderActive: { background: '#4F46E5' },
  input: { padding: '8px 12px', border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 14, width: 80 },
  textarea: { width: '100%', minHeight: 120, padding: 12, border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' as const, marginTop: 8 },
  btn: { padding: '10px 20px', border: '1px solid #e5e5e5', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer', marginTop: 8 },
  dangerBtn: { padding: '10px 20px', border: '1px solid #fecaca', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer', color: '#ef4444' },
  statRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0' },
  saved: { position: 'fixed' as const, bottom: 20, right: 20, background: '#10B981', color: '#fff', padding: '12px 24px', borderRadius: 8, fontSize: 14 },
  nav: { display: 'flex', gap: 4, padding: '12px 24px', background: '#fff', borderBottom: '1px solid #eee', position: 'sticky' as const, top: 0, zIndex: 10 },
  navLink: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, textDecoration: 'none', color: '#666', fontSize: 14, transition: 'all 0.2s' },
  navLinkActive: { background: '#f0f0f0', color: '#4F46E5', fontWeight: 500 },
  filters: { display: 'flex', gap: 12, marginBottom: 24 },
  searchInput: { flex: 1, minWidth: 200, padding: '10px 16px', border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 14 },
  filterSelect: { padding: '10px 16px', border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 14, background: '#fff' },
  emptyState: { textAlign: 'center' as const, color: '#888', padding: '48px 0', fontSize: 14 },
  tabsList: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  tabItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  tabInfo: { flex: 1, minWidth: 0 },
  tabTitle: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  tabMeta: { fontSize: 12, color: '#888', marginTop: 4, display: 'flex', alignItems: 'center' },
  domain: { color: '#4F46E5' },
  autoBadge: { background: '#fef3c7', color: '#d97706', padding: '1px 6px', borderRadius: 4, fontSize: 10, marginLeft: 4 },
  tabActions: { display: 'flex', alignItems: 'center', gap: 8 },
  restoreBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#10B981', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  deleteBtn: { padding: 8, border: 'none', borderRadius: 8, background: 'none', color: '#ef4444', cursor: 'pointer' },
  footer: { textAlign: 'center' as const, padding: '24px 0', borderTop: '1px solid #eee', fontSize: 13, color: '#888' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 32 },
  statCard: { background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' as const },
  statValue: { fontSize: 32, fontWeight: 700, color: '#4F46E5' },
  statLabel: { fontSize: 13, fontWeight: 500, marginTop: 8 },
  chart: { background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  chartBars: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 200, gap: 4 },
  barGroup: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 },
  barContainer: { display: 'flex', gap: 2, alignItems: 'flex-end', height: 160, width: '100%', justifyContent: 'center' },
  bar: { width: 12, borderRadius: '2px 2px 0 0', minHeight: 2 },
  barLabel: { fontSize: 10, color: '#888' },
  chartLegend: { display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' },
  legendDot: { width: 10, height: 10, borderRadius: '50%' },
  splitSection: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32 },
  halfSection: { background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  breakdownItem: { marginBottom: 16 },
  breakdownLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 },
  breakdownValue: { fontWeight: 600 },
  progressBar: { height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  domainsList: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
  domainItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f0f0f0' },
  domainRank: { width: 20, height: 20, background: '#f0f0f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' },
  domainName: { flex: 1, fontSize: 13 },
  domainCount: { fontSize: 13, fontWeight: 600, color: '#4F46E5' },
  dateSelector: { display: 'flex', gap: 8 },
  dateBtn: { padding: '8px 16px', border: '1px solid #e5e5e5', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' },
  dateBtnActive: { background: '#4F46E5', color: '#fff', borderColor: '#4F46E5' }
}

export default App
