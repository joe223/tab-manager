const TWO_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'co.nz', 'net.nz', 'org.nz', 'ac.nz', 'govt.nz',
  'com.br', 'net.br', 'org.br', 'edu.br', 'gov.br',
  'co.in', 'net.in', 'org.in', 'ac.in', 'gov.in',
  'co.za', 'com.sg', 'com.tw', 'com.hk', 'com.cn',
  'com.mx', 'com.ar', 'com.pe', 'com.cl', 'com.co'
])

export function getLevel1Domain(url: string): string | null {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname
    
    if (!hostname || 
        hostname.startsWith('chrome-') || 
        hostname === 'chrome://' ||
        hostname === 'localhost' ||
        !hostname.includes('.')) {
      return null
    }

    const parts = hostname.split('.')
    
    if (parts.length <= 2) {
      return hostname
    }

    const lastTwoParts = parts.slice(-2).join('.')
    if (TWO_PART_TLDS.has(lastTwoParts)) {
      return parts.slice(-3).join('.')
    }

    return parts.slice(-2).join('.')
  } catch {
    return null
  }
}

const GROUP_COLORS: chrome.tabGroups.ColorEnum[] = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'
]

export function getGroupColor(domain: string): chrome.tabGroups.ColorEnum {
  let hash = 0
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash)
  }
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length]
}

export function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}