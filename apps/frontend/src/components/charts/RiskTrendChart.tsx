import { SupplierScoreHistory } from "@/types"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, CartesianGrid } from "recharts"
import { EmptyState } from "@/components/shared/EmptyState"
import { BarChart3 } from "lucide-react"

interface RiskTrendChartProps {
  data: SupplierScoreHistory[]
}

/**
 * Line chart showing risk score over past 30 days + 5 day forecast.
 */
export function RiskTrendChart({ data }: RiskTrendChartProps) {
  if (!data || data.length === 0) {
    return <EmptyState icon={BarChart3} title="No trend data" description="Score history is unavailable." />
  }

  // figure out where actual data ends and forecast begins
  const today = data.find(d => !d.isForecast && data[data.indexOf(d) + 1]?.isForecast)?.date

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} 
            stroke="#9ca3af"
            fontSize={12}
            tickMargin={10}
          />
          <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={12} tickMargin={10} />
          <Tooltip 
            labelFormatter={(label) => new Date(label).toLocaleDateString()}
            contentStyle={{ borderRadius: '8px', border: '1px solid #dcfce7' }}
          />

          {today && (
            <>
              <ReferenceLine x={today} stroke="#9ca3af" strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: '#6b7280', fontSize: 12 }} />
              <ReferenceArea x1={today} x2={data[data.length - 1].date} fill="#f3f4f6" fillOpacity={0.5} />
            </>
          )}

          <Line type="monotone" dataKey="riskScore" stroke="#3b82f6" strokeWidth={2} dot={false} name="Overall" connectNulls />
          <Line type="monotone" dataKey="eventScore" stroke="#ef4444" strokeWidth={2} dot={false} name="Event" connectNulls />
          <Line type="monotone" dataKey="weatherScore" stroke="#f59e0b" strokeWidth={2} dot={false} name="Weather" connectNulls />
          <Line type="monotone" dataKey="operationalScore" stroke="#10b981" strokeWidth={2} dot={false} name="Operational" connectNulls />
          

        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
