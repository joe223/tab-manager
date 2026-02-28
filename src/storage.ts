import { Storage } from "@plasmohq/storage"
import { DEFAULT_SETTINGS, type Settings } from "./types"

const storage = new Storage({ area: "local" })

const SETTINGS_KEY = "settings"

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