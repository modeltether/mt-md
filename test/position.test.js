import test from "node:test"
import assert from "node:assert/strict"
import { startPosition } from "../src/position.js"

function fakes({ hash = "", state = null, ids = {} } = {}) {
  const calls = { scrollTo: [], scrollIntoView: [], replaceState: [] }
  const listeners = {}
  const win = {
    location: { hash }, scrollY: 0,
    addEventListener: (t, f) => { (listeners[t] ||= []).push(f) },
    removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter((x) => x !== f) },
    scrollTo: (x, y) => calls.scrollTo.push(y)
  }
  const doc = { getElementById: (id) => (ids[id] ? { scrollIntoView: () => calls.scrollIntoView.push(id) } : null) }
  const hist = { state, scrollRestoration: "auto", replaceState: (s) => { calls.replaceState.push(s) } }
  const queue = []
  const setTimer = (f, ms) => { queue.push({ f, ms, live: true }); return queue.length - 1 }
  const clearTimer = (i) => { if (queue[i]) queue[i].live = false }
  const flush = () => { for (const t of queue) if (t.live) { t.live = false; t.f() } }
  return { win, doc, hist, setTimer, clearTimer, calls, listeners, flush }
}

test("a #section link scrolls to that section, decoded, and takes over scroll restoration", () => {
  const f = fakes({ hash: "#my%20part", ids: { "my part": true } })
  startPosition(f)
  assert.equal(f.hist.scrollRestoration, "manual")
  f.flush()
  assert.deepEqual(f.calls.scrollIntoView.slice(0, 1), ["my part"])
  assert.equal(f.calls.scrollTo.length, 0)
})

test("Back restores the saved position when there is no anchor", () => {
  const f = fakes({ state: { mtScrollY: 1800 } })
  startPosition(f)
  f.flush()
  assert.ok(f.calls.scrollTo.length >= 1 && f.calls.scrollTo.every((y) => y === 1800))
})

test("the reader scrolling themselves stops the restoring", () => {
  const f = fakes({ state: { mtScrollY: 900 } })
  startPosition(f)
  for (const fn of f.listeners.wheel) fn()
  f.flush()
  assert.equal(f.calls.scrollTo.length, 0)
})

test("nothing is done for a plain visit, and a missing anchor falls back to nothing", () => {
  const f = fakes()
  startPosition(f)
  f.flush()
  assert.equal(f.calls.scrollTo.length + f.calls.scrollIntoView.length, 0)
  const g = fakes({ hash: "#nope" })
  startPosition(g)
  g.flush()
  assert.equal(g.calls.scrollTo.length + g.calls.scrollIntoView.length, 0)
})

test("the position is saved in the history entry once the restore has settled, and on leaving", () => {
  const f = fakes({ state: { keep: 1 } })
  startPosition(f)
  f.flush() // restore window over
  f.win.scrollY = 640.4
  for (const fn of f.listeners.scroll) fn()
  f.flush()
  assert.deepEqual(f.calls.replaceState.at(-1), { keep: 1, mtScrollY: 640 })
  f.win.scrollY = 700
  for (const fn of f.listeners.pagehide) fn()
  assert.equal(f.calls.replaceState.at(-1).mtScrollY, 700)
})
