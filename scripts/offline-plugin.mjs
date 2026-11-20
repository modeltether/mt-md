// esbuild plugin for the Infographic library: replaces the code that downloads fonts and icons from the library's own
// servers (and fetches remote pictures) with versions that load nothing, so the extension makes no network request.
export const offlineInfographic = {
  name: "offline-infographic",
  setup(build) {
    build.onLoad({ filter: /@antv[\\/]infographic[\\/](esm|lib)[\\/]renderer[\\/]fonts[\\/]built-in\.js$/ }, () => ({ contents: "export const BUILT_IN_FONTS = []", loader: "js" }))
    build.onLoad({ filter: /@antv[\\/]infographic[\\/](esm|lib)[\\/]resource[\\/]loaders[\\/]search\.js$/ }, () => ({ contents: "export const loadSearchResource = async () => null", loader: "js" }))
    build.onLoad({ filter: /@antv[\\/]infographic[\\/](esm|lib)[\\/]resource[\\/]loaders[\\/]remote\.js$/ }, () => ({ contents: "export const loadRemoteResource = async () => null", loader: "js" }))
    build.onLoad({ filter: /@antv[\\/]infographic[\\/](esm|lib)[\\/]constants[\\/]service\.js$/ }, () => ({ contents: "export const ICON_SERVICE_URL = ''", loader: "js" }))
  }
}
