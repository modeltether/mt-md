// The Chrome Web Store gets only 0.X.0 releases; patch releases (0.X.Y) stay on the self-hosted channel.
// MT_MD_STORE_PATCH_OK=1 overrides it for one run, when the maintainer has said so for that release.
export function storeRuleError(version, env = {}) {
  if (/^\d+\.\d+\.0$/.test(version) || env.MT_MD_STORE_PATCH_OK === "1") return null
  return `${version} is a patch release: the Chrome Web Store only gets 0.X.0 releases (self-hosted only otherwise; MT_MD_STORE_PATCH_OK=1 overrides it for one run)`
}
