/**
 * Service worker của extension: tự làm mới 20 phút / lần (chrome.alarms), khi Chrome mở, và khi trang
 * bản tin nhờ. Extension được quyền gọi thẳng các trang báo (host_permissions) nên không cần server —
 * dùng chung lõi core/ với server trên Mac.
 */
import { buildBrief } from '@core/brief'
import { REFRESH_INTERVAL_MS, refreshState, type FetchText } from '@core/refresh'
import { reviveState } from '@core/state'
import type { Brief } from '@shared/types'

import { EXT_BRIEF_KEY, EXT_OPENED_KEY, EXT_STATE_KEY, type ExtRefreshMessage } from './protocol'

const ALARM = 'refresh'
/** Bấm "Làm mới" liên tục cũng không tải lại nguồn dày hơn thế này */
const MANUAL_MIN_GAP_MS = 60_000
const PAGE = 'index.html'

const fetchText: FetchText = async (url) => {
  // Không gửi cookie của người dùng sang các trang báo / Google
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), credentials: 'omit', cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}

async function storedBrief(): Promise<Brief | null> {
  const got = await chrome.storage.local.get(EXT_BRIEF_KEY)
  return (got[EXT_BRIEF_KEY] as Brief | undefined) ?? null
}

/** Số tin đăng sau lần mở trang gần nhất, hiện trên biểu tượng */
async function updateBadge(brief: Brief) {
  const got = await chrome.storage.local.get(EXT_OPENED_KEY)
  const openedAt = got[EXT_OPENED_KEY] as number | undefined
  if (!openedAt) return
  const n = brief.sections.reduce((sum, s) => sum + s.stories.filter((x) => Date.parse(x.publishedAt) > openedAt).length, 0)
  await chrome.action.setBadgeBackgroundColor({ color: '#e8742a' })
  await chrome.action.setBadgeTextColor({ color: '#ffffff' })
  await chrome.action.setBadgeText({ text: n === 0 ? '' : n > 99 ? '99+' : String(n) })
}

let running: Promise<Brief> | null = null
let startedAt = 0

/** Chạy một lượt làm mới; đang có lượt chạy thì dùng chung lượt đó */
function refresh(manual = false): Promise<Brief | null> {
  if (running) return running
  if (manual && Date.now() - startedAt < MANUAL_MIN_GAP_MS) return storedBrief()
  startedAt = Date.now()
  running = (async () => {
    try {
      const got = await chrome.storage.local.get(EXT_STATE_KEY)
      const state = reviveState(got[EXT_STATE_KEY])
      await refreshState(state, fetchText)
      const brief = buildBrief(state)
      await chrome.storage.local.set({ [EXT_STATE_KEY]: state, [EXT_BRIEF_KEY]: brief })
      await updateBadge(brief)
      return brief
    } finally {
      running = null
    }
  })()
  return running
}

async function ensureAlarm() {
  if (!(await chrome.alarms.get(ALARM))) {
    await chrome.alarms.create(ALARM, { periodInMinutes: REFRESH_INTERVAL_MS / 60_000, delayInMinutes: 1 })
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureAlarm()
  void refresh()
})

chrome.runtime.onStartup.addListener(() => {
  void ensureAlarm()
  void refresh()
})

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) void refresh()
})

chrome.runtime.onMessage.addListener((msg: ExtRefreshMessage, _sender, sendResponse) => {
  if (msg?.type !== 'refresh') return false
  refresh(true).then(sendResponse, () => sendResponse(null))
  return true // trả lời bất đồng bộ
})

/** Bấm biểu tượng: đã có tab bản tin thì chuyển tới, chưa có thì mở tab mới */
chrome.action.onClicked.addListener(async () => {
  const { tabId } = (await chrome.storage.session.get('tabId')) as { tabId?: number }
  if (tabId !== undefined) {
    try {
      const tab = await chrome.tabs.get(tabId)
      await chrome.tabs.update(tabId, { active: true })
      if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true })
      return
    } catch {
      /* tab đã đóng */
    }
  }
  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL(PAGE) })
  await chrome.storage.session.set({ tabId: tab.id })
})
