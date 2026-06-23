import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/api/client";
import {
  Supplier,
  SupplierScoreHistory,
  RiskEvent,
  Recommendation,
} from "@/types";
import { AlertBanner } from "@/components/alerts/AlertBanner";
import { useAnalysisStatus } from "@/hooks/useAnalysisStatus";
import { useAnalysis } from "@/hooks/useAnalysis";
import { RiskTrendChart } from "@/components/charts/RiskTrendChart";
import { RiskEventChart } from "@/components/charts/RiskEventChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, AlertOctagon, TrendingUp, Play } from "lucide-react";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { SummaryCard } from "@/components/cards/SummaryCard";

export default function DashboardPage() {
  const api = useApiClient();

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await api.get<Supplier[]>("/api/suppliers")).data,
  });

  // Select highest risk supplier by default if available
  const highestRiskSupplier = suppliers
    ?.slice()
    .sort((a, b) => b.riskScore - a.riskScore)[0];
  const [selectedSupplierId, setSelectedSupplierId] = useState<
    string | undefined
  >();

  const currentSupplierId = selectedSupplierId || highestRiskSupplier?.id;

  const { isAnalyzing, markStarted } = useAnalysisStatus();
  const supplierAnalyzing = isAnalyzing(currentSupplierId);

  const { mutate: runAnalysis, isPending: analysisPending } = useAnalysis();

  const handleRunAnalysis = () => {
    if (!currentSupplierId) return;
    markStarted(currentSupplierId);
    runAnalysis({ supplierId: currentSupplierId });
  };

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["history", currentSupplierId],
    queryFn: async () =>
      (
        await api.get<SupplierScoreHistory[]>(
          `/api/suppliers/${currentSupplierId}/history`,
        )
      ).data,
    enabled: !!currentSupplierId,
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["events", currentSupplierId],
    queryFn: async () =>
      (await api.get<RiskEvent[]>(`/api/suppliers/${currentSupplierId}/events`))
        .data,
    enabled: !!currentSupplierId,
  });

  const { data: recommendations } = useQuery({
    queryKey: ["recommendations"],
    queryFn: async () =>
      (
        await api.get<Recommendation[]>(
          "/api/recommendations?isDismissed=false",
        )
      ).data,
  });

  const criticalCount =
    suppliers?.filter((s) => s.riskLevel === "critical").length || 0;
  const highCount =
    suppliers?.filter((s) => s.riskLevel === "high").length || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Suppliers"
          value={suppliers?.length || 0}
          icon={Package}
        />
        <SummaryCard
          title="Critical Risk"
          value={criticalCount}
          icon={AlertOctagon}
          valueClass="text-red-600"
        />
        <SummaryCard
          title="High Risk"
          value={highCount}
          icon={AlertTriangle}
          valueClass="text-orange-600"
        />
        <SummaryCard
          title="Active Recommendations"
          value={recommendations?.length || 0}
          icon={TrendingUp}
          valueClass="text-green-600"
        />
      </div>

      <AlertBanner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Risk Trend & Forecast</CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={currentSupplierId}
                onValueChange={setSelectedSupplierId}
              >
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={!currentSupplierId || supplierAnalyzing || analysisPending}
                onClick={handleRunAnalysis}
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Run Analysis
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {suppliersLoading ? (
              <LoadingSpinner />
            ) : !suppliers || suppliers.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No supplier data available. Add suppliers to see risk trends.
              </div>
            ) : supplierAnalyzing ? (
              <div className="flex items-center justify-center h-[300px]">
                <LoadingSpinner text="Running risk analysis…" />
              </div>
            ) : historyLoading || !history ? (
              <LoadingSpinner />
            ) : (
              <RiskTrendChart data={history} />
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Risk Events</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {suppliersLoading ? (
              <LoadingSpinner />
            ) : !suppliers || suppliers.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No supplier data available. Add suppliers to see risk events.
              </div>
            ) : supplierAnalyzing ? (
              <div className="flex items-center justify-center h-[300px]">
                <LoadingSpinner text="Scanning risk events…" />
              </div>
            ) : eventsLoading || !events ? (
              <LoadingSpinner />
            ) : (
              <RiskEventChart events={events} />
            )}
          </CardContent>
        </Card>
      </div>

      {recommendations && recommendations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4">Recent Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.slice(0, 3).map((rec) => (
              <Card
                key={rec.id}
                className="border-green-200 bg-green-50/30 hover:bg-green-50 transition-colors cursor-pointer"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <RiskBadge level={rec.suggestedRiskLevel} />
                    <span className="text-xs text-muted-foreground uppercase">
                      Suggested
                    </span>
                  </div>
                  <p className="font-medium text-sm text-foreground line-clamp-3">
                    {rec.reason}
                  </p>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {new Date(rec.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

