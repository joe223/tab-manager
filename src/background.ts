import type { TabData } from "./types"
import { getGroupColor, getLevel1Domain } from "./utils"
import { getSettings } from "./storage"
import { addClosedPage, getVisitCount, recordVisit } from "./storage"

const ALARM_NAME = "checkInactiveTabs"
const TAB_DATA_KEY = "tabData"

const domainGroupMap = new Map<string, number>()
const windowDomainGroupMap = new Map<number, Map<string, number>>()
const tabLastAccessed = new Map<number, number>()

function now(): number {
  return Date.now()
}

async function getTabData(): Promise<TabData> {
  const result = await chrome.storage.local.get(TAB_DATA_KEY)
  return result[TAB_DATA_KEY] || { tabs: {} }
}

async function saveTabData(data: TabData): Promise<void> {
  await chrome.storage.local.set({ [TAB_DATA_KEY]: data })
}

export async function groupTab(tab: chrome.tabs.Tab): Promise<void> {
  const settings = await getSettings()
  if (!settings.autoGroupEnabled || !tab.url || !tab.id) return

  const domain = getLevel1Domain(tab.url)
  if (!domain) return

  const windowId = tab.windowId
  if (!windowId) return

  let existingGroupId: number | undefined

  if (settings.crossWindowGroupEnabled) {
    existingGroupId = domainGroupMap.get(domain)
  } else {
    if (!windowDomainGroupMap.has(windowId)) {
      windowDomainGroupMap.set(windowId, new Map())
    }
    existingGroupId = windowDomainGroupMap.get(windowId)?.get(domain)
  }

  if (existingGroupId) {
    try {
      await chrome.tabGroups.get(existingGroupId)
      await chrome.tabs.group({ tabIds: tab.id, groupId: existingGroupId })
      return
    } catch {
      if (settings.crossWindowGroupEnabled) {
        domainGroupMap.delete(domain)
      } else {
        windowDomainGroupMap.get(windowId)?.delete(domain)
      }
    }
  }

  const newGroupId = await chrome.tabs.group({ tabIds: tab.id })
  await chrome.tabGroups.update(newGroupId, {
    title: domain,
    color: getGroupColor(domain)
  })

  if (settings.crossWindowGroupEnabled) {
    domainGroupMap.set(domain, newGroupId)
  } else {
    if (!windowDomainGroupMap.has(windowId)) {
      windowDomainGroupMap.set(windowId, new Map())
    }
    windowDomainGroupMap.get(windowId)!.set(domain, newGroupId)
  }
}

export async function closeInactiveTabs(): Promise<void> {
  const settings = await getSettings()
  if (!settings.autoCloseEnabled) return

  const currentTime = now()
  const inactiveThresholdMs = settings.inactiveMinutes * 60 * 1000
  const allTabs = await chrome.tabs.query({})
  const tabData = await getTabData()
  const tabsToClose: number[] = []

  // Build window tabs map: windowId -> tabIds
  const windowTabsMap = new Map<number, number[]>()
  for (const tab of allTabs) {
    if (!tab.id || !tab.windowId) continue
    if (!windowTabsMap.has(tab.windowId)) {
      windowTabsMap.set(tab.windowId, [])
    }
    windowTabsMap.get(tab.windowId)!.push(tab.id)
  }

  for (const tab of allTabs) {
    if (tab.pinned || tab.audible || !tab.id) continue

    const domain = tab.url ? getLevel1Domain(tab.url) : null
    if (domain && settings.whitelistedDomains.includes(domain)) continue

    let threshold = inactiveThresholdMs
    
    if (settings.enableSmartClose) {
      const visitCount = await getVisitCount(domain || "")
      if (visitCount >= settings.frequentVisitThreshold) {
        threshold = threshold * settings.frequentVisitMultiplier
      }
    }

    const lastAccessed = tabData.tabs[tab.id]?.lastAccessed || tab.lastAccessed || currentTime

    if (currentTime - lastAccessed >= threshold) {
      // Check if this is the last tab in the window
      if (!settings.closeLastTabEnabled && tab.windowId) {
        const windowTabs = windowTabsMap.get(tab.windowId) || []
        const activeTabs = windowTabs.filter(tid => {
          const t = allTabs.find(tab => tab.id === tid)
          return t && !t.pinned && !t.audible
        })
        // Only close if there are other active tabs in the window
        const otherActiveTabs = activeTabs.filter(tid => tid !== tab.id)
        if (otherActiveTabs.length === 0) {
          continue // Skip closing the last tab
        }
      }
      tabsToClose.push(tab.id)
    }
  }

  if (tabsToClose.length > 0) {
    for (const tabId of tabsToClose) {
      const tab = allTabs.find(t => t.id === tabId)
      if (tab?.url && tab.title) {
        const domain = getLevel1Domain(tab.url)
        if (domain) {
          await addClosedPage(tab.url, tab.title, domain)
        }
      }
    }
    await chrome.tabs.remove(tabsToClose)
    
    const result = await chrome.storage.local.get("closedCount")
    const newCount = (result.closedCount || 0) + tabsToClose.length
    await chrome.storage.local.set({ closedCount: newCount })
  }
}

export function recordTabAccess(tabId: number): void {
  tabLastAccessed.set(tabId, now())
}

export async function persistAccessTimes(): Promise<void> {
  const tabData = await getTabData()
  for (const [tabId, time] of tabLastAccessed) {
    tabData.tabs[tabId] = { ...tabData.tabs[tabId], lastAccessed: time }
  }
  await saveTabData(tabData)
}

export function removeTabRecord(tabId: number): void {
  tabLastAccessed.delete(tabId)
}

export async function loadExistingGroups(): Promise<void> {
  const settings = await getSettings()
  const groups = await chrome.tabGroups.query({})
  
  windowDomainGroupMap.clear()
  domainGroupMap.clear()

  for (const group of groups) {
    const tabs = await chrome.tabs.query({ groupId: group.id })
    if (tabs.length > 0 && tabs[0].url) {
      const domain = getLevel1Domain(tabs[0].url)
      if (domain) {
        if (settings.crossWindowGroupEnabled) {
          domainGroupMap.set(domain, group.id)
        } else {
          const windowId = tabs[0].windowId
          if (windowId) {
            if (!windowDomainGroupMap.has(windowId)) {
              windowDomainGroupMap.set(windowId, new Map())
            }
            windowDomainGroupMap.get(windowId)!.set(domain, group.id)
          }
        }
      }
    }
  }
}

export async function groupAllTabs(): Promise<void> {
  const settings = await getSettings()
  const tabs = await chrome.tabs.query({})

  if (settings.crossWindowGroupEnabled) {
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

    for (const [domain, tabIds] of domainTabs) {
      const groupId = await chrome.tabs.group({ tabIds })
      await chrome.tabGroups.update(groupId, {
        title: domain,
        color: getGroupColor(domain)
      })
    }
  } else {
    const windowTabsMap = new Map<number, chrome.tabs.Tab[]>()
    
    for (const tab of tabs) {
      if (!tab.url || !tab.id || !tab.windowId) continue
      if (!windowTabsMap.has(tab.windowId)) {
        windowTabsMap.set(tab.windowId, [])
      }
      windowTabsMap.get(tab.windowId)!.push(tab)
    }

    for (const [, windowTabs] of windowTabsMap) {
      const domainTabs = new Map<string, number[]>()

      for (const tab of windowTabs) {
        if (!tab.url || !tab.id) continue
        const domain = getLevel1Domain(tab.url)
        if (!domain) continue

        if (!domainTabs.has(domain)) {
          domainTabs.set(domain, [])
        }
        domainTabs.get(domain)!.push(tab.id)
      }

      for (const [domain, tabIds] of domainTabs) {
        const groupId = await chrome.tabs.group({ tabIds })
        await chrome.tabGroups.update(groupId, {
          title: domain,
          color: getGroupColor(domain)
        })
      }
    }
  }
}

async function setupAlarm(): Promise<void> {
  const settings = await getSettings()
  const existing = await chrome.alarms.get(ALARM_NAME)

  if (existing) {
    await chrome.alarms.clear(ALARM_NAME)
  }

  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: settings.checkIntervalMinutes
  })
}

chrome.runtime.onInstalled.addListener(async () => {
  await loadExistingGroups()
  await setupAlarm()

  const existingTabs = await chrome.tabs.query({})
  for (const tab of existingTabs) {
    if (tab.url && !tab.url.startsWith('chrome://')) {
      await groupTab(tab)
    }
  }
})

chrome.runtime.onStartup.addListener(async () => {
  await loadExistingGroups()
  await setupAlarm()
})

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.url && !tab.url.startsWith('chrome://')) {
    await groupTab(tab)
  }
})

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.url && !changeInfo.url.startsWith('chrome://')) {
    await groupTab(tab)
  }
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  recordTabAccess(activeInfo.tabId)
  await persistAccessTimes()
  
  const tab = await chrome.tabs.get(activeInfo.tabId)
  if (tab?.url) {
    const domain = getLevel1Domain(tab.url)
    if (domain) {
      await recordVisit(domain)
    }
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  removeTabRecord(tabId)
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await closeInactiveTabs()
  }
})

export {}