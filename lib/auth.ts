import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

const projectUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined
const deploymentUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
const baseURL = process.env.BETTER_AUTH_URL ?? projectUrl ?? deploymentUrl ?? process.env.V0_RUNTIME_URL
const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.V0_RUNTIME_URL,
  projectUrl,
  deploymentUrl,
  'https://*.vusercontent.net',
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://127.0.0.1:3000']
    : []),
].filter((value): value is string => Boolean(value))

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is required')
}

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins,
  emailAndPassword: { enabled: true },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  advanced:
    process.env.NODE_ENV === 'development'
      ? { defaultCookieAttributes: { sameSite: 'none', secure: true } }
      : undefined,
})
