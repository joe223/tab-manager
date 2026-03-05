export interface Settings {
  autoGroupEnabled: boolean
  autoCloseEnabled: boolean
  inactiveMinutes: number
  checkIntervalMinutes: number
  whitelistedDomains: string[]
  enableSmartClose: boolean
  frequentVisitThreshold: number
  frequentVisitMultiplier: number
  closeLastTabEnabled: boolean
  crossWindowGroupEnabled: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  autoGroupEnabled: true,
  autoCloseEnabled: true,
  inactiveMinutes: 60,
  checkIntervalMinutes: 5,
  whitelistedDomains: [],
  enableSmartClose: true,
  frequentVisitThreshold: 10,
  frequentVisitMultiplier: 3,
  closeLastTabEnabled: false,
  crossWindowGroupEnabled: false
}

export interface TabData {
  tabs: Record<number, { lastAccessed: number }>
}

export interface ClosedPage {
  id: string
  url: string
  title: string
  domain: string
  closedAt: number
}

export interface DomainStats {
  domain: string
  visitCount: number
  closedCount: number
  firstVisit: number
  lastVisit: number
}

export interface AppStats {
  totalClosed: number
  totalTimeSaved: number
  domains: Record<string, DomainStats>
  recentClosed: ClosedPage[]
}