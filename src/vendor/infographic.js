// Built as its own content script (a large library). Its network features are removed at build time (see scripts/build.mjs):
// no fonts or icons are fetched from the library's servers.
import { Infographic, registerResourceLoader, setDefaultFont } from "@antv/infographic"
registerResourceLoader(async () => null)
setDefaultFont("system-ui, sans-serif")
;(globalThis.__mtVendor ||= {}).Infographic = Infographic
