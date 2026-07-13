import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { testOtpChallenges } from "@/lib/db/schema"
import { disabledResponse } from "@/lib/test-stand-otp"

export async function POST(req: Request) {
  const disabled = disabledResponse()
  if (disabled) return disabled

  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null
  const email = body?.email?.trim().toLowerCase() ?? ""
  const password = body?.password ?? ""

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Введите корректный email" }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: "Пароль должен содержать не менее 8 символов" }, { status: 400 })
  }

  const [challenge] = await db
    .select()
    .from(testOtpChallenges)
    .where(eq(testOtpChallenges.email, email))
    .limit(1)
  if (!challenge || challenge.status !== "allocated" || challenge.expiresAt.getTime() <= Date.now()) {
    return Response.json(
      { error: "Сначала создайте тестовый mailbox через агент" },
      { status: 409 },
    )
  }

  await db
    .update(testOtpChallenges)
    .set({ status: "delivered" })
    .where(eq(testOtpChallenges.id, challenge.id))

  return Response.json({ challengeId: challenge.id })
}
