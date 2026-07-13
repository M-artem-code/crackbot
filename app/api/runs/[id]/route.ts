import { getRunDetail } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const detail = await getRunDetail(id)
  if (!detail) return Response.json({ error: 'Прогон не найден' }, { status: 404 })
  return Response.json(detail, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
