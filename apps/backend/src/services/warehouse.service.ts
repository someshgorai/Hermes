import { db } from "../database/drizzle";
import { warehouses, recommendations } from "../database/schema";
import { eq, and, or, sql } from "drizzle-orm";
import axios from "axios";
import { logger } from "../lib/logger";

// hits OpenCage to geocode a warehouse address
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
      "Warehouse geocoding failed",
    );

    return null;
  }
}

// creates a warehouse and geocodes its address for coordinates
export async function createWarehouse(
  organizationId: string,
  data: {
    name: string;
    address: string;
    country: string;
    importPortId?: string;
  },
) {
  const coords = await geocodeAddress(data.address);

  if (!coords) {
    throw new Error(`Could not geocode address: ${data.address}`);
  }

  const [warehouse] = await db
    .insert(warehouses)
    .values({
      organizationId,

      name: data.name,
      address: data.address,
      country: data.country,

      lat: coords.lat,
      lng: coords.lng,

      importPortId: data.importPortId ?? null,
    })
    .returning();

  return warehouse;
}

// all warehouses are org-scoped
export async function getWarehousesByOrg(organizationId: string) {
  return db
    .select()
    .from(warehouses)
    .where(eq(warehouses.organizationId, organizationId));
}

export async function getWarehouseById(id: string, organizationId: string) {
  const rows = await db
    .select()
    .from(warehouses)
    .where(
      and(eq(warehouses.id, id), eq(warehouses.organizationId, organizationId)),
    );

  return rows[0] ?? null;
}

// updates warehouse info — re-geocodes if the address changed
export async function updateWarehouse(
  id: string,
  organizationId: string,
  data: Partial<{
    name: string;
    address: string;
    country: string;
    importPortId: string | null;
  }>,
) {
  const updates: {
    name?: string;
    address?: string;
    country?: string;
    importPortId?: string | null;
    lat?: number;
    lng?: number;
    updatedAt?: Date;
  } = {};

  if (data.name) {
    updates.name = data.name;
  }

  if (data.country) {
    updates.country = data.country;
  }

  if (data.importPortId !== undefined) {
    updates.importPortId = data.importPortId;
  }

  if (data.address) {
    const coords = await geocodeAddress(data.address);

    if (!coords) {
      throw new Error(`Could not geocode address: ${data.address}`);
    }

    updates.address = data.address;

    updates.lat = coords.lat;
    updates.lng = coords.lng;
  }

  updates.updatedAt = new Date();

  const [warehouse] = await db
    .update(warehouses)
    .set(updates)
    .where(
      and(eq(warehouses.id, id), eq(warehouses.organizationId, organizationId)),
    )
    .returning();

  return warehouse;
}

/** Deletes a warehouse after verifying it's not referenced by active recommendations. */
export async function deleteWarehouse(id: string, organizationId: string) {
  // Check if this warehouse is referenced by recommendations
  const refs = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recommendations)
    .where(
      or(
        eq(recommendations.currentWarehouseId, id),
        eq(recommendations.suggestedWarehouseId, id),
      ),
    );

  const refCount = refs[0]?.count ?? 0;

  if (refCount > 0) {
    throw new Error(
      `Cannot delete warehouse — it is referenced by ${refCount} recommendation(s). Dismiss or remove them first.`,
    );
  }

  await db
    .delete(warehouses)
    .where(
      and(eq(warehouses.id, id), eq(warehouses.organizationId, organizationId)),
    );
}
