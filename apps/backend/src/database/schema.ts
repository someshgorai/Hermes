import {
  pgTable,
  pgEnum,
  uuid,
  text,
  real,
  boolean,
  timestamp,
  integer,
  jsonb,
  date,
  index,
  unique,
} from "drizzle-orm/pg-core";

// Enums
export const riskLevelEnum = pgEnum("risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const dependencyEnum = pgEnum("dependency", [
  "low",
  "medium",
  "high",
  "sole_source",
]);

export const riskTypeEnum = pgEnum("risk_type", [
  "financial",
  "labor",
  "geopolitical",
  "logistics",
  "esg",
]);
// Ports
export const ports = pgTable(
  "ports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
  },
  (t) => [unique("ports_name_country_unique").on(t.name, t.country)],
);

// Warehouses
export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    country: text("country").notNull(),
    importPortId: uuid("import_port_id").references(() => ports.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("warehouses_organization_id_idx").on(t.organizationId),
    index("warehouses_import_port_id_idx").on(t.importPortId),
  ],
);

// Suppliers
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default([]),
    tier: integer("tier").notNull(),
    country: text("country").notNull(),
    category: text("category").notNull(),
    originLat: real("origin_lat").notNull(),
    originLng: real("origin_lng").notNull(),
    originAddress: text("origin_address").notNull(),
    leadTimeDays: integer("lead_time_days").notNull(),
    dependency: dependencyEnum("dependency").notNull().default("low"),
    shippingRatePerKm: real("shipping_rate_per_km").notNull().default(0),
    riskScore: real("risk_score").notNull().default(0),
    riskLevel: riskLevelEnum("risk_level").notNull().default("low"),
    eventScore: real("event_score").notNull().default(0),
    operationalScore: real("operational_score").notNull().default(0),
    weatherScore: real("weather_score").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("suppliers_organization_id_idx").on(t.organizationId),
    index("suppliers_organization_id_risk_level_idx").on(
      t.organizationId,
      t.riskLevel,
    ),
  ],
);

// Supplier Export Ports (many-to-many)
export const supplierExportPorts = pgTable(
  "supplier_export_ports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    portId: uuid("port_id")
      .notNull()
      .references(() => ports.id),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("supplier_export_ports_supplier_id_idx").on(t.supplierId),
    index("supplier_export_ports_port_id_idx").on(t.portId),
  ],
);

// Route Scores
export const routeScores = pgTable(
  "route_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, {
        onDelete: "cascade",
      }),
    exportPortId: uuid("export_port_id")
      .notNull()
      .references(() => ports.id),
    importPortId: uuid("import_port_id")
      .notNull()
      .references(() => ports.id),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, {
        onDelete: "cascade",
      }),
    totalScore: real("total_score").notNull(),
    riskLevel: riskLevelEnum("risk_level").notNull(),
    leg1Km: real("leg1_km").notNull(),
    leg2Km: real("leg2_km").notNull(),
    leg3Km: real("leg3_km").notNull(),
    totalDistanceKm: real("total_distance_km").notNull(),
    transitDays: integer("transit_days").notNull(),
    totalDeliveryDays: integer("total_delivery_days").notNull(),
    estimatedCostUsd: real("estimated_cost_usd").notNull(),
    eventScore: real("event_score").notNull(),
    weatherScore: real("weather_score").notNull(),
    operationalScore: real("operational_score").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("route_scores_organization_id_idx").on(t.organizationId),
    index("route_scores_supplier_id_idx").on(t.supplierId),
    index("route_scores_organization_id_supplier_id_idx").on(
      t.organizationId,
      t.supplierId,
    ),
    index("route_scores_warehouse_id_idx").on(t.warehouseId),
    unique("route_scores_unique").on(
      t.supplierId,
      t.exportPortId,
      t.importPortId,
      t.warehouseId,
    ),
  ],
);

// Recommendations
export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    currentExportPortId: uuid("current_export_port_id").references(
      () => ports.id,
    ),
    currentImportPortId: uuid("current_import_port_id").references(
      () => ports.id,
    ),
    currentWarehouseId: uuid("current_warehouse_id").references(
      () => warehouses.id,
    ),
    currentRiskLevel: riskLevelEnum("current_risk_level").notNull(),
    suggestedExportPortId: uuid("suggested_export_port_id").references(
      () => ports.id,
    ),
    suggestedImportPortId: uuid("suggested_import_port_id").references(
      () => ports.id,
    ),
    suggestedWarehouseId: uuid("suggested_warehouse_id").references(
      () => warehouses.id,
    ),
    suggestedRiskLevel: riskLevelEnum("suggested_risk_level").notNull(),
    reason: text("reason").notNull(),
    extraDistanceKm: real("extra_distance_km"),
    extraCostUsd: real("extra_cost_usd"),
    extraDays: integer("extra_days"),
    // Semi-structured ranked lists — use a junction table if querying into ranks is needed.
    exportPortRank: jsonb("export_port_rank"),
    importPortRank: jsonb("import_port_rank"),
    warehouseRank: jsonb("warehouse_rank"),
    isAccepted: boolean("is_accepted").notNull().default(false),
    isDismissed: boolean("is_dismissed").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("recommendations_organization_id_idx").on(t.organizationId),
    index("recommendations_supplier_id_idx").on(t.supplierId),
    index("recommendations_organization_id_supplier_id_idx").on(
      t.organizationId,
      t.supplierId,
    ),
  ],
);

// Risk Events
export const riskEvents = pgTable(
  "risk_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    headline: text("headline").notNull(),
    riskType: riskTypeEnum("risk_type").notNull(),
    severity: real("severity").notNull(),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("risk_events_organization_id_idx").on(t.organizationId),
    index("risk_events_supplier_id_idx").on(t.supplierId),
    index("risk_events_organization_id_supplier_id_idx").on(
      t.organizationId,
      t.supplierId,
    ),
  ],
);

// Supplier Score History
export const supplierScoreHistory = pgTable(
  "supplier_score_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    isForecast: boolean("is_forecast").notNull().default(false),
    riskScore: real("risk_score").notNull(),
    eventScore: real("event_score").notNull(),
    weatherScore: real("weather_score").notNull(),
    operationalScore: real("operational_score").notNull(),
    riskLevel: riskLevelEnum("risk_level").notNull(),
  },
  (t) => [
    index("supplier_score_history_supplier_id_idx").on(t.supplierId),
    index("supplier_score_history_date_idx").on(t.date),
    index("supplier_score_history_organization_id_supplier_id_idx").on(
      t.organizationId,
      t.supplierId,
    ),
    index("supplier_score_history_organization_id_supplier_id_date_idx").on(
      t.organizationId,
      t.supplierId,
      t.date,
    ),
    unique("supplier_score_history_unique").on(
      t.supplierId,
      t.date,
      t.isForecast,
    ),
  ],
);

// Alerts
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    riskType: riskTypeEnum("risk_type").notNull(),
    isDismissed: boolean("is_dismissed").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("alerts_organization_id_idx").on(t.organizationId),
    index("alerts_supplier_id_idx").on(t.supplierId),
    index("alerts_organization_id_is_dismissed_idx").on(
      t.organizationId,
      t.isDismissed,
    ),
  ],
);
