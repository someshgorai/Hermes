import { db } from "../database/drizzle";
import { suppliers, supplierExportPorts } from "../database/schema";
import { eq, and } from "drizzle-orm";
import axios from "axios";
import { logger } from "../lib/logger";
import type { DependencyLevel } from "../risk/operationalRisk";

// Geocodes an address using OpenCage.
async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.OPENCAGE_API_KEY;

  if (!apiKey) {
    throw new Error("OPENCAGE_API_KEY is required");
  }

  try {
    const response = await axios.get(
      "https://api.opencagedata.com/geocode/v1/json",
      {
        params: {
          q: address,
          key: apiKey,
          limit: 1,
        },
        timeout: 30_000,
      },
    );

    const result = response.data.results?.[0]?.geometry;

    if (!result) {
      return null;
    }

    return {
      lat: result.lat,
      lng: result.lng,
    };
  } catch (err) {
    logger.warn(
      {
        err,
        address,
      },
      "Geocoding failed",
    );

    return null;
  }
}

// Creates a supplier and links export ports.
export async function createSupplier(
  organizationId: string,
  data: {
    name: string;
    aliases: string[];
    tier: number;
    country: string;
    category: string;
    originAddress: string;
    leadTimeDays: number;
    dependency: DependencyLevel;
    shippingRatePerKm: number;
    exportPortIds: string[];
    primaryPortId?: string;
  },
) {
  const coords = await geocodeAddress(data.originAddress);

  if (!coords) {
    throw new Error(`Could not geocode address: ${data.originAddress}`);
  }

  const [supplier] = await db
    .insert(suppliers)
    .values({
      organizationId,

      name: data.name,
      aliases: data.aliases,
      tier: data.tier,
      country: data.country,
      category: data.category,

      originAddress: data.originAddress,

      originLat: coords.lat,
      originLng: coords.lng,

      leadTimeDays: data.leadTimeDays,

      dependency: data.dependency,

      shippingRatePerKm: data.shippingRatePerKm,
    })
    .returning();

  if (data.exportPortIds.length > 0) {
    await db.insert(supplierExportPorts).values(
      data.exportPortIds.map((portId) => ({
        supplierId: supplier.id,
        portId,
        isPrimary: portId === (data.primaryPortId ?? data.exportPortIds[0]),
      })),
    );
  }

  return supplier;
}

export async function getSuppliersByOrg(organizationId: string) {
  return db
    .select()
    .from(suppliers)
    .where(eq(suppliers.organizationId, organizationId));
}

export async function getSupplierById(id: string, organizationId: string) {
  const rows = await db
    .select()
    .from(suppliers)
    .where(
      and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)),
    );

  return rows[0] ?? null;
}

// Updates supplier information and re-geocodes if the address changes.
export async function updateSupplier(
  id: string,
  organizationId: string,
  data: Partial<{
    name: string;
    aliases: string[];
    tier: number;
    country: string;
    category: string;
    originAddress: string;
    leadTimeDays: number;
    dependency: DependencyLevel;
    shippingRatePerKm: number;
    exportPortIds: string[];
    primaryPortId: string;
  }>,
) {
  const updates: {
    name?: string;
    aliases?: string[];
    tier?: number;
    country?: string;
    category?: string;
    originAddress?: string;
    originLat?: number;
    originLng?: number;
    leadTimeDays?: number;
    dependency?: DependencyLevel;
    shippingRatePerKm?: number;
    updatedAt?: Date;
  } = {};

  if (data.name) {
    updates.name = data.name;
  }

  if (data.aliases) {
    updates.aliases = data.aliases;
  }

  if (data.tier !== undefined) {
    updates.tier = data.tier;
  }

  if (data.country) {
    updates.country = data.country;
  }

  if (data.category) {
    updates.category = data.category;
  }

  if (data.leadTimeDays !== undefined) {
    updates.leadTimeDays = data.leadTimeDays;
  }

  if (data.dependency !== undefined) {
    updates.dependency = data.dependency;
  }

  if (data.shippingRatePerKm !== undefined) {
    updates.shippingRatePerKm = data.shippingRatePerKm;
  }

  if (data.originAddress) {
    const coords = await geocodeAddress(data.originAddress);

    if (!coords) {
      throw new Error(`Could not geocode address: ${data.originAddress}`);
    }

    updates.originAddress = data.originAddress;

    updates.originLat = coords.lat;

    updates.originLng = coords.lng;
  }

  updates.updatedAt = new Date();

  const [supplier] = await db
    .update(suppliers)
    .set(updates)
    .where(
      and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)),
    )
    .returning();

  // Replaces supplier export port assignments.
  if (data.exportPortIds) {
    await db
      .delete(supplierExportPorts)
      .where(eq(supplierExportPorts.supplierId, id));

    if (data.exportPortIds.length > 0) {
      await db.insert(supplierExportPorts).values(
        data.exportPortIds.map((portId) => ({
          supplierId: id,
          portId,
          isPrimary: portId === (data.primaryPortId ?? data.exportPortIds?.[0]),
        })),
      );
    }
  }

  return supplier;
}

export async function deleteSupplier(id: string, organizationId: string) {
  await db
    .delete(suppliers)
    .where(
      and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)),
    );
}

// Used by the nightly risk analysis worker.
export async function getAllSuppliersAcrossOrgs() {
  return db.select().from(suppliers);
}
