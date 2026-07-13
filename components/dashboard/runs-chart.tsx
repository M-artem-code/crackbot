'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { dailyStats } from '@/lib/mock-data'

const chartConfig = {
  success: {
    label: 'Успешные',
    color: 'var(--chart-1)',
  },
  failed: {
    label: 'Ошибки',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

export function RunsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Прогоны за 14 дней</CardTitle>
        <CardDescription>
          Успешные и завершившиеся ошибкой проверки по всем ботам
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart data={dailyStats} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="fillSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillFailed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-failed)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-failed)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={4} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="success"
              type="monotone"
              fill="url(#fillSuccess)"
              stroke="var(--color-success)"
              strokeWidth={2}
            />
            <Area
              dataKey="failed"
              type="monotone"
              fill="url(#fillFailed)"
              stroke="var(--color-failed)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
