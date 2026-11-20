// Can mt-md read local files? Chrome has an "Allow access to file URLs" switch per extension, and recent Firefox (the
// extensions.webextensions.fileSchemeAccess.requireOptIn preference, on by default) asks for an opt-in too: until it is given the
// browser runs no content script on a file: page, so mt-md can only explain, never draw. Both browsers answer the same question.
export async function fileAccess(api = globalThis.browser ?? globalThis.chrome) {
  try {
    const fn = api?.extension?.isAllowedFileSchemeAccess
    if (typeof fn === "function") return (await fn.call(api.extension)) ? "yes" : "no"
  } catch { /* fall through */ }
  return "unknown"
}

export const isFirefox = () => typeof globalThis.browser?.runtime?.getBrowserInfo === "function"

// What to tell the person, per browser. Firefox cannot open its add-ons page for us, so those steps are written out.
export function fixSteps(firefox) {
  return firefox
    ? ["Open the Firefox menu (☰), then Extensions and Themes.", "Click mt-md, then the Permissions tab.", "Turn on “Allow access to file URLs”."]
    : ["Open the extension's details page (the button below does it).", "Turn on “Allow access to file URLs”."]
}

// chrome://extensions/?id=<id> in Chrome-family browsers (Edge uses its own scheme); Firefox pages cannot be opened by an extension.
export function extensionSettingsUrl(runtimeId, userAgent = globalThis.navigator?.userAgent || "") {
  if (/Edg\//.test(userAgent)) return `edge://extensions/?id=${runtimeId}`
  return `chrome://extensions/?id=${runtimeId}`
}
