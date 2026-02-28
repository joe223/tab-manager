export interface Settings {
  autoGroupEnabled: boolean
  autoCloseEnabled: boolean
  inactiveMinutes: number
  checkIntervalMinutes: number
  whitelistedDomains: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  autoGroupEnabled: true,
  autoCloseEnabled: true,
  inactiveMinutes: 60,
  checkIntervalMinutes: 5,
  whitelistedDomains: []
}

export interface TabData {
  tabs: Record<number, { lastAccessed: number }>
}