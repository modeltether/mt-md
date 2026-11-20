// Built as its own content script (a large library) so no single file exceeds AMO's 5 MB parse limit.
import * as vega from "vega"
import * as vegaLite from "vega-lite"
import { expressionInterpreter } from "vega-interpreter"
;(globalThis.__mtVendor ||= {}).vega = { vega, vegaLite, expressionInterpreter }
