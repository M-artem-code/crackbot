import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { testOtpChallenges } from "@/lib/db/schema"
import {
  createMailboxIdentity,
  deriveOtp,
  disabledResponse,
} from "@/lib/test-stand-otp"

export const dynamic = "force-dynamic"

export async function POST() {
  const disabled = disabledResponse()
  if (disabled) return disabled

  const mailbox = createMailboxIdentity()
  await db.insert(testOtpChallenges).values({
    id: mailbox.id,
    mailboxToken: mailbox.token,
    email: mailbox.email,
    otpHash: mailbox.otpHash,
    status: "allocated",
    expiresAt: mailbox.expiresAt,
  })

  return Response.json({
    email: mailbox.email,
    mailboxToken: mailbox.token,
    expiresAt: mailbox.expiresAt.toISOString(),
  })
}

export async function GET(req: Request) {
  const disabled = disabledResponse()
  if (disabled) return disabled

  const token = new URL(req.url).searchParams.get("token") ?? ""
  if (!token) return Response.json({ error: "token обязателен" }, { status: 400 })

  const [challenge] = await db
    .select()
    .from(testOtpChallenges)
    .where(eq(testOtpChallenges.mailboxToken, token))
    .limit(1)

  if (!challenge) return Response.json({ error: "Mailbox не найден" }, { status: 404 })
  if (challenge.expiresAt.getTime() <= Date.now()) {
    return Response.json({ status: "expired" }, { status: 410 })
  }
  if (challenge.status === "allocated") {
    return Response.json({ status: "waiting" })
  }

  return Response.json({ status: challenge.status, code: deriveOtp(token) })
}
