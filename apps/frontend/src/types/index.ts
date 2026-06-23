export type RiskLevel = "low" | "medium" | "high" | "critical"
export type DependencyLevel = "low" | "medium" | "high" | "sole_source"
export type RiskType = "financial" | "labor" | "geopolitical" | "logistics" | "esg"

export interface Port {
  id: string
  name: string
  country: string
  lat: number
  lng: number
}

export interface Warehouse {
  id: string
  organizationId: string
  name: string
  address: string
  lat: number
  lng: number
  country: string
  importPortId: string | null
  importPort?: Port
  createdAt: string
  updatedAt: string
}

export interface Supplier {
  id: string
  organizationId: string
  name: string
  aliases: string[]
  tier: number
  country: string
  category: string
  originLat: number
  originLng: number
  originAddress: string
  leadTimeDays: number
  dependency: DependencyLevel
  shippingRatePerKm: number
  riskScore: number
  riskLevel: RiskLevel
  eventScore: number
  operationalScore: number
  weatherScore: number
  exportPorts?: Port[]
  createdAt: string
  updatedAt: string
}

export interface SupplierScoreHistory {
  id: string
  supplierId: string
  date: string
  isForecast: boolean
  riskScore: number
  eventScore: number
  weatherScore: number
  operationalScore: number
  riskLevel: RiskLevel
}

export interface RiskEvent {
  id: string
  supplierId: string
  source: string
  headline: string
  riskType: RiskType
  severity: number
  summary: string
  createdAt: string
}

export interface ScoredRoute {
  exportPortId: string
  exportPortName: string
  exportPortCountry: string
  importPortId: string
  importPortName: string
  importPortCountry: string
  warehouseId: string
  warehouseName: string
  totalScore: number
  riskLevel: RiskLevel
  leg1Km: number
  leg2Km: number
  leg3Km: number
  totalDistanceKm: number
  transitDays: number
  totalDeliveryDays: number
  estimatedCostUsd: number
  eventScore: number
  weatherScore: number
  operationalScore: number
}

export interface Recommendation {
  id: string
  organizationId: string
  supplierId: string
  currentExportPortId: string | null
  currentImportPortId: string | null
  currentWarehouseId: string | null
  currentRiskLevel: RiskLevel
  suggestedExportPortId: string | null
  suggestedImportPortId: string | null
  suggestedWarehouseId: string | null
  suggestedRiskLevel: RiskLevel
  reason: string
  extraDistanceKm: number | null
  extraCostUsd: number | null
  extraDays: number | null
  exportPortRank: RankedOption[] | null
  importPortRank: RankedOption[] | null
  warehouseRank: RankedOption[] | null
  isAccepted: boolean
  isDismissed: boolean
  createdAt: string
}

export interface RankedOption {
  id: string
  name: string
  score: number
  riskLevel: RiskLevel
  reason: string
}

export interface Alert {
  id: string
  supplierId: string
  supplierName?: string
  message: string
  riskType: RiskType
  isDismissed: boolean
  createdAt: string
}

export interface AnalysisResult {
  routes: ScoredRoute[]
  recommendation: Recommendation | null
}
