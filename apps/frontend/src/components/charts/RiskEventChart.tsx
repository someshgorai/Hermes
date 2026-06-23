import { RiskEvent } from "@/types"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from "recharts"
import { EmptyState } from "@/components/shared/EmptyState"
import { AlertTriangle, ExternalLink } from "lucide-react"

interface RiskEventChartProps {
  events: RiskEvent[]
}

interface RiskEventBarData extends RiskEvent {
  shortHeadline: string
}

interface RiskEventBarClickData {
  source?: string
  payload?: RiskEventBarData
}

const TYPE_COLORS = {
  financial: "#ef4444", // red
  geopolitical: "#a855f7", // purple
  labor: "#f97316", // orange
  logistics: "#3b82f6", // blue
  esg: "#10b981", // green
}

// Bar chart showing detected risk events by severity with an interactive detail list.
export function RiskEventChart({ events }: RiskEventChartProps) {
  if (!events || events.length === 0) {
    return <EmptyState icon={AlertTriangle} title="No recent events" description="No risk events detected for this supplier." />
  }

  // chop headlines so the x-axis doesn't get crazy
  const data: RiskEventBarData[] = events.map(e => ({
    ...e,
    shortHeadline: e.headline.length > 20 ? e.headline.substring(0, 20) + "..." : e.headline
  }))

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 20, bottom: 40, left: 0 }}>
            <XAxis 
              dataKey="shortHeadline" 
              angle={-45} 
              textAnchor="end" 
              height={60} 
              stroke="#9ca3af"
              fontSize={12}
              tickMargin={5}
            />
            <YAxis domain={[0, 1.0]} stroke="#9ca3af" fontSize={12} tickMargin={10} />
            
            <Tooltip 
              wrapperStyle={{ pointerEvents: 'auto' }}
              cursor={{ fill: '#f3f4f6' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const event = payload[0].payload as RiskEvent
                  return (
                    <div className="bg-popover border border-border p-3 rounded-md shadow-md max-w-[250px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{event.riskType}</span>
                        <span className="text-xs font-bold">Severity: {event.severity.toFixed(2)}</span>
                      </div>
                      <h4 className="font-medium text-sm mb-1">{event.headline}</h4>
                      <p className="text-xs text-muted-foreground mb-2">{event.summary}</p>
                      {event.source && (
                        <a 
                          href={event.source} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Source link
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />

            <ReferenceLine y={0.5} stroke="#f59e0b" strokeDasharray="3 3" />
            <ReferenceLine y={0.75} stroke="#ef4444" strokeDasharray="3 3" />

            <Bar 
              dataKey="severity" 
              radius={[4, 4, 0, 0]}
              onClick={(data: RiskEventBarClickData) => {
                const source = data.source ?? data.payload?.source;
                if (source) {
                  window.open(source, "_blank", "noopener,noreferrer");
                }
              }}
              className="cursor-pointer"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.riskType] || "#9ca3af"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="border-t border-border pt-4 mt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
          <span>Sources & Headlines</span>
          <span className="text-[10px] font-normal text-muted-foreground/80 lowercase italic">
            click bar or link to open
          </span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-1">
          {events.map((event) => {
            const badgeColor = TYPE_COLORS[event.riskType] || "#9ca3af";
            return (
              <div 
                key={event.id || event.headline}
                className="flex flex-col justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/40 transition-all duration-200 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: badgeColor }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                      {event.riskType}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      • {new Date(event.createdAt || Date.now()).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                      Sev: {event.severity.toFixed(2)}
                    </span>
                  </div>
                  <h5 className="font-semibold text-xs text-foreground mb-1 leading-snug line-clamp-2">
                    {event.headline}
                  </h5>
                  <p className="text-[11px] text-muted-foreground leading-normal line-clamp-2 mb-3">
                    {event.summary}
                  </p>
                </div>
                
                {event.source ? (
                  <a
                    href={event.source}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full text-center text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground hover:text-foreground px-3 py-1.5 rounded transition-all"
                  >
                    <span>View Source Article</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">No source link available</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}
