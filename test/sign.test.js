import test from "node:test"
import assert from "node:assert/strict"
import { parseEnvFile, signEnv, signArgs, redactor } from "../scripts/sign-lib.mjs"

const creds = { AMO_JWT_ISSUER: "user:12345678:901", AMO_JWT_SECRET: "s3cr3tvaluevaluevalue0123456789" }

test("the signing command line carries no credentials; they travel in the environment", () => {
  const args = signArgs({ sourceDir: "build/firefox", artifactsDir: "/tmp/x" })
  const joined = args.join(" ")
  assert.ok(!joined.includes(creds.AMO_JWT_SECRET) && !joined.includes(creds.AMO_JWT_ISSUER))
  assert.ok(!/api-key|api-secret/.test(joined))
  const env = signEnv(creds, { PATH: "/bin" })
  assert.equal(env.WEB_EXT_API_KEY, creds.AMO_JWT_ISSUER)
  assert.equal(env.WEB_EXT_API_SECRET, creds.AMO_JWT_SECRET)
  assert.throws(() => signEnv({}, {}), /AMO_JWT_ISSUER/)
})

test("the env file is read for the two keys only", () => {
  const got = parseEnvFile(`# c\nAMO_JWT_ISSUER=user:1:2\nexport AMO_JWT_SECRET="abc def"\nOTHER=nope\n`)
  assert.deepEqual(got, { AMO_JWT_ISSUER: "user:1:2", AMO_JWT_SECRET: "abc def" })
})

test("anything the child prints is scrubbed of the secret and of issuer-shaped ids", () => {
  const redact = redactor([creds.AMO_JWT_ISSUER, creds.AMO_JWT_SECRET])
  const line = `run 'web-ext' sign --api-key ${creds.AMO_JWT_ISSUER} --api-secret ${creds.AMO_JWT_SECRET} and user:99999999:123`
  const out = redact(line)
  assert.ok(!out.includes(creds.AMO_JWT_SECRET) && !out.includes(creds.AMO_JWT_ISSUER) && !/user:\d+:\d+/.test(out))
  assert.match(out, /\*\*\*/)
})
