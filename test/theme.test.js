import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const styles = (name) => readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/styles", name), "utf8")

const SPEC_VARS = [
  "--mt-font-body",
  "--mt-font-code",
  "--mt-font-heading",
  "--mt-color-bg",
  "--mt-color-text",
  "--mt-color-accent",
  "--mt-color-border",
  "--mt-color-code-bg",
  "--mt-max-width",
  "--mt-note",
  "--mt-warning",
  "--mt-tip",
  "--mt-important",
  "--mt-caution"
]

for (const name of ["theme-light.css", "theme-dark.css"]) {
  test(`${name} defines all spec variables in one :root block`, () => {
    const css = styles(name)
    assert.match(css, /^:root \{/)
    for (const v of SPEC_VARS) assert.ok(css.includes(v), `${name} missing ${v}`)
  })
}

test("base.css reads its background, body font and width from the custom properties", () => {
  const css = styles("base.css")
  assert.ok(css.includes("var(--mt-color-bg)"))
  assert.ok(css.includes("var(--mt-font-body)"))
  assert.ok(css.includes("var(--mt-max-width)"))
})

test("print.css covers the spec print requirements", () => {
  const css = styles("print.css")
  for (const needle of ["@page", "A4", "break-inside: avoid", "target-counter", "#mt-md-toolbar", "display: none"]) {
    assert.ok(css.includes(needle), `print.css missing ${needle}`)
  }
})
