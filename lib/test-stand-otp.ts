import "server-only"

import { createHash, createHmac, randomBytes } from "node:crypto"

const TEST_OTP_TTL_MS = 5 * 60 * 1000

function signingKey(): string {
  return process.env.TEST_STAND_OTP_SECRET || "crackbot-local-test-stand-only"
}

export function isTestStandEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_TEST_STAND === "true"
}

export function createMailboxIdentity(): {
  id: string
  token: string
  email: string
  otp: string
  otpHash: string
  expiresAt: Date
} {
  const token = randomBytes(24).toString("base64url")
  const id = `otp_${randomBytes(12).toString("hex")}`
  const digest = createHmac("sha256", signingKey()).update(token).digest()
  const numeric = digest.readUInt32BE(0) % 1_000_000
  const otp = numeric.toString().padStart(6, "0")
  return {
    id,
    token,
    email: `automation+${token.slice(0, 12)}@crackbot.test`,
    otp,
    otpHash: hashOtp(token, otp),
    expiresAt: new Date(Date.now() + TEST_OTP_TTL_MS),
  }
}

export function deriveOtp(token: string): string {
  const digest = createHmac("sha256", signingKey()).update(token).digest()
  return (digest.readUInt32BE(0) % 1_000_000).toString().padStart(6, "0")
}

export function hashOtp(token: string, otp: string): string {
  return createHash("sha256").update(`${token}:${otp}:${signingKey()}`).digest("hex")
}

export function disabledResponse(): Response | null {
  return isTestStandEnabled()
    ? null
    : Response.json({ error: "Тестовый стенд отключён" }, { status: 404 })
}
