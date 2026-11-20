import test from "node:test"
import assert from "node:assert/strict"
import { storeRuleError } from "../scripts/store-rule.mjs"

test("the store gets only 0.X.0 releases", () => {
  for (const v of ["0.5.0", "0.10.0", "1.0.0"]) assert.equal(storeRuleError(v), null, v)
  for (const v of ["0.4.1", "0.4.4", "0.5.10"]) assert.match(storeRuleError(v), /patch release/, v)
})

test("MT_MD_STORE_PATCH_OK=1 overrides it, other values do not", () => {
  assert.equal(storeRuleError("0.4.4", { MT_MD_STORE_PATCH_OK: "1" }), null)
  assert.match(storeRuleError("0.4.4", { MT_MD_STORE_PATCH_OK: "yes" }), /patch release/)
})
