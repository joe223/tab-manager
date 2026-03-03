import { Storage } from "@plasmohq/storage"
import { DEFAULT_SETTINGS, type Settings, type ClosedPage, type DomainStats, type AppStats } from "./types"

const storage = new Storage({ area: "local" })

const SETTINGS_KEY = "settings"
const CLOSED_PAGES_KEY = "closedPages"
const DOMAIN_STATS_KEY = "domainStats"
const MAX_CLOSED_PAGES = 100
const MAX_HISTORY_DAYS = 30

export async function getSettings(): Promise<Settings> {
  const settings = await storage.get<Settings>(SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...settings }
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await storage.set(SETTINGS_KEY, { ...current, ...settings })
}

export async function addWhitelistedDomain(domain: string): Promise<void> {
  const settings = await getSettings()
  if (!settings.whitelistedDomains.includes(domain)) {
    settings.whitelistedDomains.push(domain)
    await saveSettings(settings)
  }
}

export async function removeWhitelistedDomain(domain: string): Promise<void> {
  const settings = await getSettings()
  settings.whitelistedDomains = settings.whitelistedDomains.filter(d => d !== domain)
  await saveSettings(settings)
}

export async function addClosedPage(url: string, title: string, domain: string): Promise<void> {
  const closedPages = await getClosedPages()
  const newPage: ClosedPage = {
    id: crypto.randomUUID(),
    url,
    title: title || url,
    domain,
    closedAt: Date.now()
  }
  closedPages.unshift(newPage)
  if (closedPages.length > MAX_CLOSED_PAGES) {
    closedPages.pop()
  }
  await storage.set(CLOSED_PAGES_KEY, closedPages)
  await updateDomainStats(domain, true)
}

export async function getClosedPages(): Promise<ClosedPage[]> {
  const result = await storage.get<ClosedPage[]>(CLOSED_PAGES_KEY)
  return result || []
}

export async function clearClosedPages(): Promise<void> {
  await storage.set(CLOSED_PAGES_KEY, [])
}

export async function removeClosedPage(id: string): Promise<void> {
  const closedPages = await getClosedPages()
  const filtered = closedPages.filter(p => p.id !== id)
  await storage.set(CLOSED_PAGES_KEY, filtered)
}

export async function getDomainStats(): Promise<Record<string, DomainStats>> {
  const result = await storage.get<Record<string, DomainStats>>(DOMAIN_STATS_KEY)
  return result || {}
}

export async function updateDomainStats(domain: string, wasClosed: boolean): Promise<void> {
  const stats = await getDomainStats()
  const now = Date.now()
  
  if (!stats[domain]) {
    stats[domain] = {
      domain,
      visitCount: 0,
      closedCount: 0,
      firstVisit: now,
      lastVisit: now
    }
  }
  
  if (wasClosed) {
    stats[domain].closedCount++
  }
  stats[domain].lastVisit = now
  
  await storage.set(DOMAIN_STATS_KEY, stats)
}

export async function recordVisit(domain: string): Promise<void> {
  const stats = await getDomainStats()
  const now = Date.now()
  
  if (!stats[domain]) {
    stats[domain] = {
      domain,
      visitCount: 0,
      closedCount: 0,
      firstVisit: now,
      lastVisit: now
    }
  }
  
  stats[domain].visitCount++
  stats[domain].lastVisit = now
  
  await storage.set(DOMAIN_STATS_KEY, stats)
}

export async function getVisitCount(domain: string): Promise<number> {
  const stats = await getDomainStats()
  return stats[domain]?.visitCount || 0
}

export async function getAppStats(): Promise<AppStats> {
  const [closedPages, domainStats] = await Promise.all([
    getClosedPages(),
    getDomainStats()
  ])
  
  const thirtyDaysAgo = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000)
  const recentClosed = closedPages.filter(p => p.closedAt > thirtyDaysAgo)
  
  let totalClosed = 0
  for (const domain of Object.values(domainStats)) {
    totalClosed += domain.closedCount
  }
  
  return {
    totalClosed,
    totalTimeSaved: totalClosed * 5 * 60 * 1000,
    domains: domainStats,
    recentClosed
  }
}