import test from "node:test"
import assert from "node:assert/strict"
import "./setup-window.js"
import { setupLightbox } from "../src/lightbox.js"

function article() {
  document.body.innerHTML = `<div id="a">
    <img id="i1" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="first">
    <img id="i2" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="second">
    <a href="x.md"><img id="i3" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="linked"></a>
  </div>`
  const a = document.getElementById("a")
  setupLightbox(a)
  return a
}
const key = (k) => document.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true }))

test("clicking an image opens the viewer; linked images are left alone", () => {
  article()
  assert.ok(document.getElementById("i1").classList.contains("mt-md-zoomable"))
  assert.ok(!document.getElementById("i3").classList.contains("mt-md-zoomable"))
  document.getElementById("i3").click()
  assert.equal(document.getElementById("mt-md-lightbox"), null)
  document.getElementById("i1").click()
  const lb = document.getElementById("mt-md-lightbox")
  assert.ok(lb)
  assert.equal(lb.querySelector(".mt-md-lb-caption").textContent, "first")
  assert.equal(lb.querySelector(".mt-md-lb-count").textContent, "1 / 2")
})

test("arrows step through the images and wrap; Escape closes", () => {
  article()
  document.getElementById("i1").click()
  key("ArrowRight")
  assert.equal(document.querySelector(".mt-md-lb-caption").textContent, "second")
  key("ArrowRight")
  assert.equal(document.querySelector(".mt-md-lb-caption").textContent, "first")
  key("ArrowLeft")
  assert.equal(document.querySelector(".mt-md-lb-caption").textContent, "second")
  key("Escape")
  assert.equal(document.getElementById("mt-md-lightbox"), null)
})

test("clicking the picture toggles full size, clicking outside closes, opening twice leaves one viewer", () => {
  article()
  document.getElementById("i2").click()
  document.getElementById("i1").click()
  assert.equal(document.querySelectorAll("#mt-md-lightbox").length, 1)
  const pic = document.querySelector(".mt-md-lb-img")
  pic.click()
  assert.ok(pic.classList.contains("mt-md-lb-full"))
  pic.click()
  assert.ok(!pic.classList.contains("mt-md-lb-full"))
  document.getElementById("mt-md-lightbox").click()
  assert.equal(document.getElementById("mt-md-lightbox"), null)
})
