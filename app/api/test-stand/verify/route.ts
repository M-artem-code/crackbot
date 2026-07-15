import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { testOtpChallenges } from "@/lib/db/schema"
import { disabledResponse, hashOtp } from "@/lib/test-stand-otp"

export async function POST(req: Request) {
  const disabled = disabledResponse()
  if (disabled) return disabled

  const body = (await req.json().catch(() => null)) as
    | { challengeId?: string; code?: string }
    | null
  const challengeId = body?.challengeId ?? ""
  const code = body?.code?.trim() ?? ""
  if (!challengeId || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "Введите шестизначный код" }, { status: 400 })
  }

  const [challenge] = await db
    .select()
    .from(testOtpChallenges)
    .where(and(eq(testOtpChallenges.id, challengeId), eq(testOtpChallenges.status, "delivered")))
    .limit(1)
  if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
    return Response.json({ error: "Код истёк или уже использован" }, { status: 410 })
  }
  if (hashOtp(challenge.mailboxToken, code) !== challenge.otpHash) {
    return Response.json({ error: "Неверный код подтверждения" }, { status: 422 })
  }

  await db
    .update(testOtpChallenges)
    .set({ status: "verified", verifiedAt: new Date() })
    .where(eq(testOtpChallenges.id, challenge.id))

  return Response.json({ verified: true })
}
