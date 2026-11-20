const sources = new Map()
let n = 0

export function registerDiagramSource(source) {
  const id = `d${++n}`
  sources.set(id, source)
  return id
}

export function getDiagramSource(id) {
  return sources.get(id) ?? ""
}
