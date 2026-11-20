// Built as its own content script so no single file exceeds AMO's 5 MB parse limit.
import mermaid from "mermaid"
;(globalThis.__mtVendor ||= {}).mermaid = mermaid
