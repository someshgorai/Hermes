import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/api/client";
import { useAnalysis } from "@/hooks/useAnalysis";
import { PageHeader } from "@/components/shared/PageHeader";
import { AnalysisTrigger } from "@/components/analysis/AnalysisTrigger";
import { PriorityPanel } from "@/components/analysis/PriorityPanel";
import { RouteScoreTable } from "@/components/analysis/RouteScoreTable";
import { ScoredRoute, Recommendation, RiskLevel } from "@/types";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface RankedRoute {
  id: string;
  name: string;
  score: number;
  riskLevel: RiskLevel;
  reason: string;
}

export default function AnalysisPage() {
  const api = useApiClient();
  const [searchParams] = useSearchParams();
  const initialSupplierId = searchParams.get("supplierId") || undefined;
  const initialWarehouseId = searchParams.get("warehouseId") || undefined;

  const [activeSupplierId, setActiveSupplierId] = useState<string | undefined>(
    initialSupplierId,
  );
  const [activeWarehouseId, setActiveWarehouseId] = useState<
    string | undefined
  >(initialWarehouseId);
  const [jobRunning, setJobRunning] = useState(false);

  const { mutate: runAnalysis, isPending: submitPending } = useAnalysis();

  // Query routes for the active supplier, polling while the job runs
  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ["routes", activeSupplierId, activeWarehouseId],
    queryFn: async () => {
      const url = activeWarehouseId
        ? `/api/analysis/routes/${activeSupplierId}?warehouseId=${activeWarehouseId}`
        : `/api/analysis/routes/${activeSupplierId}`;
      const res = await api.get<ScoredRoute[]>(url);
      return res.data;
    },
    enabled: !!activeSupplierId,
    refetchInterval: jobRunning ? 3000 : false,
  });

  // Query active recommendations for the organization
  const { data: recommendations } = useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => {
      const res = await api.get<Recommendation[]>(
        "/api/recommendations?isDismissed=false",
      );
      return res.data;
    },
    enabled: !!activeSupplierId,
    refetchInterval: jobRunning ? 3000 : false,
  });

  // Trigger analysis execution (queues a new BullMQ job)
  const handleRun = (supplierId: string, warehouseId?: string) => {
    setActiveSupplierId(supplierId);
    setActiveWarehouseId(warehouseId);
    setJobRunning(true);
    runAnalysis({ supplierId, warehouseId });
  };

  // Show existing analysis results from DB without re-running
  const handleShow = (supplierId: string, warehouseId?: string) => {
    setActiveSupplierId(supplierId);
    setActiveWarehouseId(warehouseId);
    setJobRunning(false);
  };

  // Auto-show existing results if supplierId is passed in URL
  useEffect(() => {
    if (initialSupplierId) {
      handleShow(initialSupplierId, initialWarehouseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatically turn off jobRunning indicator when data resolves
  useEffect(() => {
    if (jobRunning && routes && routes.length > 0) {
      setJobRunning(false);
    }
  }, [routes, jobRunning]);

  // Stop polling after 20 seconds maximum to prevent infinite polling loops on failure
  useEffect(() => {
    if (jobRunning) {
      const timer = setTimeout(() => {
        setJobRunning(false);
      }, 20000);
      return () => clearTimeout(timer);
    }
  }, [jobRunning]);

  // Find the recommendation associated with this supplier
  const supplierRecommendation = recommendations?.find(
    (r) => r.supplierId === activeSupplierId,
  );

  // Fallback recommendation if none is stored in the database
  const getFallbackRecommendation = () => {
    if (!routes || routes.length === 0) return null;

    const bestRoute = routes[0];

    // Compute ranks
    const exportPortRank = routes
      .reduce<RankedRoute[]>((acc, r) => {
        if (!acc.find((a) => a.id === r.exportPortId)) {
          acc.push({
            id: r.exportPortId,
            name: r.exportPortName,
            score: r.totalScore,
            riskLevel: r.riskLevel,
            reason: `Score: ${r.totalScore}`,
          });
        }
        return acc;
      }, [])
      .sort((a, b) => a.score - b.score);

    const warehouseRank = routes
      .reduce<RankedRoute[]>((acc, r) => {
        if (!acc.find((a) => a.id === r.warehouseId)) {
          acc.push({
            id: r.warehouseId,
            name: r.warehouseName,
            score: r.totalScore,
            riskLevel: r.riskLevel,
            reason: `Score: ${r.totalScore}`,
          });
        }
        return acc;
      }, [])
      .sort((a, b) => a.score - b.score);

    return {
      id: "fallback",
      organizationId: "",
      supplierId: activeSupplierId || "",
      currentExportPortId: null,
      currentImportPortId: null,
      currentWarehouseId: null,
      currentRiskLevel: "low" as const,
      suggestedExportPortId: bestRoute.exportPortId,
      suggestedImportPortId: bestRoute.importPortId,
      suggestedWarehouseId: bestRoute.warehouseId,
      suggestedRiskLevel: bestRoute.riskLevel,
      reason:
        "This is the optimal route configuration under current conditions.",
      extraDistanceKm: null,
      extraCostUsd: null,
      extraDays: null,
      exportPortRank,
      importPortRank: [],
      warehouseRank,
      isAccepted: false,
      isDismissed: false,
      createdAt: new Date().toISOString(),
    };
  };

  // Construct standard AnalysisResult structure expected by PriorityPanel
  const analysisResult =
    routes && routes.length > 0
      ? {
          routes,
          recommendation: supplierRecommendation || getFallbackRecommendation(),
        }
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Route Analysis"
        subtitle="Evaluate and optimize your supply chain routing combinations based on current risk factors."
      />

      <AnalysisTrigger
        initialSupplierId={initialSupplierId}
        initialWarehouseId={initialWarehouseId}
        onRun={handleRun}
        onShow={handleShow}
        isPending={submitPending || jobRunning}
      />

      {jobRunning && (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-md border border-border">
          <LoadingSpinner text="Running risk analysis, scoring routing combinations..." />
        </div>
      )}

      {!jobRunning && activeSupplierId && routesLoading && (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-md border border-border">
          <LoadingSpinner text="Loading route scores..." />
        </div>
      )}

      {!jobRunning && analysisResult && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <PriorityPanel result={analysisResult} />
          {analysisResult.routes.length > 0 && (
            <RouteScoreTable routes={analysisResult.routes} />
          )}
        </div>
      )}

      {!jobRunning &&
        activeSupplierId &&
        (!routes || routes.length === 0) &&
        !routesLoading && (
          <div className="text-center p-12 bg-card rounded-md border border-border text-muted-foreground">
            No routing combinations scored for this supplier. Make sure you have
            added warehouses and linked export ports to the supplier.
          </div>
        )}
    </div>
  );
}
