import type { TabData } from "./types"
import { getGroupColor, getLevel1Domain } from "./utils"
import { getSettings } from "./storage"
import { addClosedPage, getVisitCount, recordVisit } from "./storage"

const ALARM_NAME = "checkInactiveTabs"
const TAB_DATA_KEY = "tabData"
const GROUP_TITLE_MAX_LENGTH = 48

const domainWindowGroupMap = new Map<string, Map<number, number>>()
const windowDomainGroupMap = new Map<number, Map<string, number>>()
const tabLastAccessed = new Map<number, number>()

function now(): number {
  return Date.now()
}

function isGroupableWindowId(windowId: number | undefined): windowId is number {
  return windowId !== undefined && windowId !== chrome.windows.WINDOW_ID_NONE
}

function getWindowDomainGroups(windowId: number): Map<string, number> {
  if (!windowDomainGroupMap.has(windowId)) {
    windowDomainGroupMap.set(windowId, new Map())
  }
  return windowDomainGroupMap.get(windowId)!
}

function getDomainWindowGroups(domain: string): Map<number, number> {
  if (!domainWindowGroupMap.has(domain)) {
    domainWindowGroupMap.set(domain, new Map())
  }
  return domainWindowGroupMap.get(domain)!
}

function setTrackedGroup(domain: string, windowId: number, groupId: number): void {
  getWindowDomainGroups(windowId).set(domain, groupId)
  getDomainWindowGroups(domain).set(windowId, groupId)
}

function deleteTrackedGroup(domain: string, windowId: number): void {
  const windowGroups = windowDomainGroupMap.get(windowId)
  if (windowGroups) {
    windowGroups.delete(domain)
    if (windowGroups.size === 0) {
      windowDomainGroupMap.delete(windowId)
    }
  }

  const domainGroups = domainWindowGroupMap.get(domain)
  if (domainGroups) {
    domainGroups.delete(windowId)
    if (domainGroups.size === 0) {
      domainWindowGroupMap.delete(domain)
    }
  }
}

function clearTrackedGroups(): void {
  domainWindowGroupMap.clear()
  windowDomainGroupMap.clear()
}

function getTrackedGroupId(domain: string, windowId: number, matchDomainGroupsAcrossWindows: boolean): number | undefined {
  if (matchDomainGroupsAcrossWindows) {
    return domainWindowGroupMap.get(domain)?.get(windowId)
  }

  return windowDomainGroupMap.get(windowId)?.get(domain)
}

function normalizeTitleToken(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "")
}

function getDomainBrand(domain: string): string {
  return domain.split(".")[0] || domain
}

function truncateGroupTitle(title: string): string {
  if (title.length <= GROUP_TITLE_MAX_LENGTH) {
    return title
  }

  return `${title.slice(0, GROUP_TITLE_MAX_LENGTH - 3).trimEnd()}...`
}

function cleanGroupTitle(title: string, domain: string): string {
  let cleaned = title.replace(/\s+/g, " ").trim()
  const redundantTokens = new Set([
    normalizeTitleToken(domain),
    normalizeTitleToken(getDomainBrand(domain))
  ])

  for (const separator of [" | ", " - ", " — ", " · "]) {
    const parts = cleaned.split(separator).map((part) => part.trim()).filter(Boolean)
    if (parts.length < 2) {
      continue
    }

    const lastPart = parts[parts.length - 1]
    if (!redundantTokens.has(normalizeTitleToken(lastPart))) {
      continue
    }

    const nextTitle = parts.slice(0, -1).join(separator).trim()
    if (nextTitle.length > 0) {
      cleaned = nextTitle
    }
    break
  }

  return truncateGroupTitle(cleaned)
}

function getCandidateGroupTitle(tab: chrome.tabs.Tab | undefined, domain: string): string | null {
  const rawTitle = tab?.title?.trim()
  if (!rawTitle) {
    return null
  }

  const normalizedTitle = normalizeTitleToken(rawTitle)
  if (normalizedTitle === "new tab" || normalizedTitle === "new tab page" || normalizedTitle === "about:blank") {
    return null
  }

  if (tab?.url === "about:blank" || tab?.url?.startsWith("chrome://newtab")) {
    return null
  }

  return cleanGroupTitle(rawTitle, domain)
}

function getGroupTitle(tabs: chrome.tabs.Tab[], domain: string, fallbackTab?: chrome.tabs.Tab): string {
  const sortedTabs = [...tabs]
    .filter((tab) => tab.id !== undefined)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

  for (const tab of sortedTabs) {
    const title = getCandidateGroupTitle(tab, domain)
    if (title) {
      return title
    }
  }

  const fallbackTitle = getCandidateGroupTitle(fallbackTab, domain)
  if (fallbackTitle) {
    return fallbackTitle
  }

  return truncateGroupTitle(domain)
}

async function syncGroupPresentation(groupId: number, domain: string, fallbackTab?: chrome.tabs.Tab): Promise<void> {
  const tabs = await chrome.tabs.query({ groupId })

  await chrome.tabGroups.update(groupId, {
    title: getGroupTitle(tabs, domain, fallbackTab),
    color: getGroupColor(domain)
  })
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
  if (!isGroupableWindowId(windowId)) return

  const existingGroupId = getTrackedGroupId(domain, windowId, settings.matchDomainGroupsAcrossWindows)

  if (existingGroupId !== undefined) {
    try {
      const existingGroup = await chrome.tabGroups.get(existingGroupId)
      if (existingGroup.windowId !== windowId) {
        deleteTrackedGroup(domain, windowId)
      } else {
        await chrome.tabs.group({ tabIds: tab.id, groupId: existingGroupId })
        await syncGroupPresentation(existingGroupId, domain, tab)
        return
      }
    } catch {
      deleteTrackedGroup(domain, windowId)
    }
  }

  const newGroupId = await chrome.tabs.group({ tabIds: tab.id })
  await syncGroupPresentation(newGroupId, domain, tab)

  setTrackedGroup(domain, windowId, newGroupId)
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
  const groups = await chrome.tabGroups.query({})

  clearTrackedGroups()

  for (const group of groups) {
    const tabs = await chrome.tabs.query({ groupId: group.id })
    if (tabs.length > 0 && tabs[0].url) {
      const domain = getLevel1Domain(tabs[0].url)
      const windowId = tabs[0].windowId
      if (domain && isGroupableWindowId(windowId)) {
        await syncGroupPresentation(group.id, domain, tabs[0])
        setTrackedGroup(domain, windowId, group.id)
      }
    }
  }
}

export async function groupAllTabs(): Promise<number> {
  const tabs = await chrome.tabs.query({})
  const windowTabsMap = new Map<number, Map<string, chrome.tabs.Tab[]>>()

  for (const tab of tabs) {
    if (!tab.url || !tab.id || !isGroupableWindowId(tab.windowId)) continue

    const domain = getLevel1Domain(tab.url)
    if (!domain) continue

    if (!windowTabsMap.has(tab.windowId)) {
      windowTabsMap.set(tab.windowId, new Map())
    }

    const domainTabs = windowTabsMap.get(tab.windowId)!
    if (!domainTabs.has(domain)) {
      domainTabs.set(domain, [])
    }

    domainTabs.get(domain)!.push(tab)
  }

  let groupsCreated = 0

  for (const [, domainTabs] of windowTabsMap) {
    for (const [domain, groupedTabs] of domainTabs) {
      const sortedTabs = [...groupedTabs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      const tabIds = sortedTabs.map((tab) => tab.id!).filter((tabId) => tabId !== undefined)
      const groupId = await chrome.tabs.group({ tabIds })
      await syncGroupPresentation(groupId, domain, sortedTabs[0])
      groupsCreated++
    }
  }

  await loadExistingGroups()

  return groupsCreated
}

export async function ungroupAllTabs(): Promise<number> {
  const tabs = await chrome.tabs.query({})
  const groupedTabIds = tabs
    .filter((tab) => tab.id !== undefined && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)
    .map((tab) => tab.id!)

  if (groupedTabIds.length === 0) {
    clearTrackedGroups()
    return 0
  }

  await chrome.tabs.ungroup(groupedTabIds)
  clearTrackedGroups()

  return groupedTabIds.length
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

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.settings) return

  void (async () => {
    await loadExistingGroups()
    await setupAlarm()
  })()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await closeInactiveTabs()
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return undefined
  }

  void (async () => {
    try {
      switch (message.type) {
        case "group-all-tabs": {
          const groupsCreated = await groupAllTabs()
          sendResponse({ ok: true, groupsCreated })
          return
        }
        case "ungroup-all-tabs": {
          const ungroupedCount = await ungroupAllTabs()
          sendResponse({ ok: true, ungroupedCount })
          return
        }
        case "reload-group-maps": {
          await loadExistingGroups()
          sendResponse({ ok: true })
          return
        }
        default:
          sendResponse({ ok: false, error: `Unsupported message type: ${message.type}` })
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  })()

  return true
})

export {}
