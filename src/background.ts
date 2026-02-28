import type { TabData } from "./types"
import { getGroupColor, getLevel1Domain } from "./utils"
import { getSettings } from "./storage"

const ALARM_NAME = "checkInactiveTabs"
const TAB_DATA_KEY = "tabData"

const domainGroupMap = new Map<string, number>()
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

  const existingGroupId = domainGroupMap.get(domain)

  if (existingGroupId) {
    try {
      await chrome.tabGroups.get(existingGroupId)
      await chrome.tabs.group({ tabIds: tab.id, groupId: existingGroupId })
      return
    } catch {
      domainGroupMap.delete(domain)
    }
  }

  const newGroupId = await chrome.tabs.group({ tabIds: tab.id })
  await chrome.tabGroups.update(newGroupId, {
    title: domain,
    color: getGroupColor(domain)
  })
  domainGroupMap.set(domain, newGroupId)
}

export async function closeInactiveTabs(): Promise<void> {
  const settings = await getSettings()
  if (!settings.autoCloseEnabled) return

  const currentTime = now()
  const inactiveThresholdMs = settings.inactiveMinutes * 60 * 1000
  const allTabs = await chrome.tabs.query({})
  const tabData = await getTabData()
  const tabsToClose: number[] = []

  for (const tab of allTabs) {
    if (tab.pinned || tab.audible || !tab.id) continue

    const domain = tab.url ? getLevel1Domain(tab.url) : null
    if (domain && settings.whitelistedDomains.includes(domain)) continue

    const lastAccessed = tabData.tabs[tab.id]?.lastAccessed || tab.lastAccessed || currentTime

    if (currentTime - lastAccessed >= inactiveThresholdMs) {
      tabsToClose.push(tab.id)
    }
  }

  if (tabsToClose.length > 0) {
    await chrome.tabs.remove(tabsToClose)
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
  for (const group of groups) {
    const tabs = await chrome.tabs.query({ groupId: group.id })
    if (tabs.length > 0 && tabs[0].url) {
      const domain = getLevel1Domain(tabs[0].url)
      if (domain) {
        domainGroupMap.set(domain, group.id)
      }
    }
  }
}

export async function groupAllTabs(): Promise<void> {
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

  for (const [domain, tabIds] of domainTabs) {
    const groupId = await chrome.tabs.group({ tabIds })
    await chrome.tabGroups.update(groupId, {
      title: domain,
      color: getGroupColor(domain)
    })
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