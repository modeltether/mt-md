// prismjs only publishes itself via Node's `global`, absent in a browser; its language
// components look up the bare `Prism` global, so set it before they load.
import Prism from "prismjs"
globalThis.Prism = Prism
