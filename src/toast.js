// A one-line status message at the bottom of the page.
let timer = null
export function toast(message, ms = 4000) {
  let el = document.getElementById("mt-md-toast")
  if (!el) {
    el = document.createElement("div")
    el.id = "mt-md-toast"
    el.setAttribute("role", "status")
    document.body.appendChild(el)
  }
  el.textContent = message
  el.classList.add("mt-md-toast-on")
  clearTimeout(timer)
  timer = setTimeout(() => el.classList.remove("mt-md-toast-on"), ms)
}
