import { Card, CardContent } from "@/components/ui/card.tsx";

interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  valueClass?: string;
}

export function SummaryCard({
  title,
  value,
  icon: Icon,
  valueClass = "",
}: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {title}
          </p>
          <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}