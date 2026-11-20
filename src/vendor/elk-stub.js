// Mermaid's optional ELK layout engine (1.5 MB) is not bundled; the default dagre layout is.
export default class ELK {
  constructor() {
    throw new Error("The ELK layout engine is not bundled in mt-md; use the default layout")
  }
}
