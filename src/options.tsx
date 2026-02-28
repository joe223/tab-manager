import { useEffect, useState } from "react"
import { getSettings, saveSettings } from "./storage"
import type { Settings } from "./types"
import { DEFAULT_SETTINGS } from "./types"

function OptionsIndex() {
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

        <main style={styles.main}>
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
            <h2 style={styles.sectionTitle}>Protected Domains</h2>
            <p style={styles.sectionDesc}>Domains listed below will never be auto-closed. Enter one domain per line.</p>
            <textarea
              style={styles.textarea}
              placeholder="google.com&#10;github.com&#10;stackoverflow.com"
              value={whitelistText}
              onChange={(e) => handleWhitelistChange(e.target.value)}
            />
          </section>
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
  }
}

export default OptionsIndex
