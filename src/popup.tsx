import { useEffect, useState } from "react"
import { getSettings, saveSettings } from "./storage"
import { getGroupColor, getLevel1Domain } from "./utils"
import type { Settings } from "./types"
import { DEFAULT_SETTINGS } from "./types"

function IndexPopup() {
  const [tabCount, setTabCount] = useState(0)
  const [groupCount, setGroupCount] = useState(0)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [closedCount, setClosedCount] = useState(0)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")

  useEffect(() => {
    Promise.all([
      loadStats(),
      loadSettings(),
      loadClosedCount()
    ])
  }, [])

  async function loadStats() {
    const [tabs, groups] = await Promise.all([
      chrome.tabs.query({}),
      chrome.tabGroups.query({})
    ])
    setTabCount(tabs.length)
    setGroupCount(groups.length)
  }

  async function loadSettings() {
    const s = await getSettings()
    setSettings(s)
  }

  async function loadClosedCount() {
    const result = await chrome.storage.local.get("closedCount")
    setClosedCount(result.closedCount || 0)
  }

  function showNotification(message: string) {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }

  async function toggleAutoGroup() {
    const newValue = !settings.autoGroupEnabled
    await saveSettings({ autoGroupEnabled: newValue })
    setSettings({ ...settings, autoGroupEnabled: newValue })
    showNotification(newValue ? "Auto-group enabled" : "Auto-group disabled")
  }

  async function toggleAutoClose() {
    const newValue = !settings.autoCloseEnabled
    await saveSettings({ autoCloseEnabled: newValue })
    setSettings({ ...settings, autoCloseEnabled: newValue })
    showNotification(newValue ? "Auto-close enabled" : "Auto-close disabled")
  }

  async function handleGroupAll() {
    const tabs = await chrome.tabs.query({})
    const domainTabs = new Map<string, number[]>()

    for (const tab of tabs) {
      if (!tab.url || !tab.id) continue
      const domain = getLevel1Domain(tab.url)
      if (!domain) continue

      if (!domainTabs.has(domain)) {
        domainTabs.set(domain, [])
      }
      domainTabs.get(domain)!.push(tab.id)
    }

    let groupsCreated = 0
    for (const [domain, tabIds] of domainTabs) {
      const groupId = await chrome.tabs.group({ tabIds })
      await chrome.tabGroups.update(groupId, {
        title: domain,
        color: getGroupColor(domain)
      })
      groupsCreated++
    }

    await loadStats()
    showNotification(`Grouped into ${groupsCreated} groups`)
  }

  async function handleUngroupAll() {
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      if (tab.id && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        await chrome.tabs.ungroup(tab.id)
      }
    }
    await loadStats()
    showNotification("All tabs ungrouped")
  }

  async function handleCloseInactive() {
    const now = Date.now()
    const threshold = settings.inactiveMinutes * 60 * 1000
    const tabs = await chrome.tabs.query({})
    const toClose: number[] = []

    for (const tab of tabs) {
      if (tab.pinned || tab.audible || !tab.id) continue

      const domain = tab.url ? getLevel1Domain(tab.url) : null
      if (domain && settings.whitelistedDomains.includes(domain)) continue

      const lastAccessed = tab.lastAccessed || now
      if (now - lastAccessed >= threshold) {
        toClose.push(tab.id)
      }
    }

    if (toClose.length > 0) {
      await chrome.tabs.remove(toClose)
      const newCount = closedCount + toClose.length
      await chrome.storage.local.set({ closedCount: newCount })
      setClosedCount(newCount)
      await loadStats()
      showNotification(`Closed ${toClose.length} inactive tabs`)
    } else {
      showNotification("No inactive tabs found")
    }
  }

  function openSettings() {
    chrome.runtime.openOptionsPage()
    window.close()
  }

  return (
    <div style={styles.container}>
      {showToast && <div style={styles.toast}>{toastMessage}</div>}
      
      <div style={styles.header}>
        <div style={styles.logo}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
            <rect x="4" y="8" width="16" height="10" rx="1" fill="currentColor" opacity="0.2"/>
            <path d="M8 13L10 15L14 11" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={styles.title}>Tab Manager</h1>
      </div>

      <div style={styles.stats}>
        <div style={styles.stat}>
          <div style={styles.statValue}>{tabCount}</div>
          <div style={styles.statLabel}>Tabs</div>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.stat}>
          <div style={styles.statValue}>{groupCount}</div>
          <div style={styles.statLabel}>Groups</div>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.stat}>
          <div style={styles.statValue}>{closedCount}</div>
          <div style={styles.statLabel}>Closed</div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Features</div>
        <div style={styles.toggleRow}>
          <div>
            <div style={styles.toggleLabel}>Auto-group</div>
            <div style={styles.toggleDesc}>Group tabs by domain</div>
          </div>
          <button
            style={{
              ...styles.toggle,
              ...(settings.autoGroupEnabled ? styles.toggleActive : {})
            }}
            onClick={toggleAutoGroup}
          >
            <div style={{
              ...styles.toggleKnob,
              ...(settings.autoGroupEnabled ? styles.toggleKnobActive : {})
            }} />
          </button>
        </div>
        <div style={styles.toggleRow}>
          <div>
            <div style={styles.toggleLabel}>Auto-close</div>
            <div style={styles.toggleDesc}>Close inactive after {settings.inactiveMinutes}m</div>
          </div>
          <button
            style={{
              ...styles.toggle,
              ...(settings.autoCloseEnabled ? styles.toggleActive : {})
            }}
            onClick={toggleAutoClose}
          >
            <div style={{
              ...styles.toggleKnob,
              ...(settings.autoCloseEnabled ? styles.toggleKnobActive : {})
            }} />
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Actions</div>
        <button style={styles.actionBtn} onClick={handleGroupAll}>
          <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Group all tabs
        </button>

        <button style={styles.actionBtn} onClick={handleUngroupAll}>
          <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="8" y1="8" x2="16" y2="16"/>
            <line x1="16" y1="8" x2="8" y2="16"/>
          </svg>
          Ungroup all tabs
        </button>

        <button style={styles.actionBtn} onClick={handleCloseInactive}>
          <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          Close inactive tabs
        </button>

        <button style={styles.actionBtn} onClick={openSettings}>
          <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 300,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#fff',
    color: '#1a1a1a',
    position: 'relative' as const,
    borderRadius: 12,
    overflow: 'hidden' as const
  },
  toast: {
    position: 'absolute' as const,
    top: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1a1a1a',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    zIndex: 100
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 16px 12px',
    borderBottom: '1px solid #f0f0f0'
  },
  logo: {
    width: 36,
    height: 36,
    background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff'
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
    letterSpacing: '-0.3px'
  },
  stats: {
    display: 'flex',
    padding: '16px',
    borderBottom: '1px solid #f0f0f0',
    gap: 0
  },
  stat: {
    flex: 1,
    textAlign: 'center' as const
  },
  statDivider: {
    width: 1,
    background: '#f0f0f0'
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.5px'
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    marginTop: 2
  },
  section: {
    padding: '12px 0'
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    padding: '0 16px 8px'
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px'
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: 500
  },
  toggleDesc: {
    fontSize: 12,
    color: '#888',
    marginTop: 2
  },
  toggle: {
    width: 44,
    height: 24,
    background: '#e5e5e5',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    padding: 2,
    transition: 'background 0.2s',
    display: 'flex',
    alignItems: 'center'
  },
  toggleActive: {
    background: '#4F46E5'
  },
  toggleKnob: {
    width: 20,
    height: 20,
    background: '#fff',
    borderRadius: '50%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s'
  },
  toggleKnobActive: {
    transform: 'translateX(20px)'
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    background: 'none',
    fontSize: 14,
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: 'background 0.15s',
    color: '#1a1a1a'
  },
  icon: {
    width: 18,
    height: 18,
    marginRight: 12,
    opacity: 0.5,
    flexShrink: 0
  }
}

export default IndexPopup
