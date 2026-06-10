import { db } from "../database/drizzle";
import { ports, supplierExportPorts, warehouses } from "../database/schema";
import { eq, asc } from "drizzle-orm";
import axios from "axios";
import { logger } from "../lib/logger";

// Geocodes a port location using OpenCage and returns coordinates.
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
      "Port geocoding failed",
    );

    return null;
  }
}

interface CreatePortInput {
  name: string;
  country: string;
  address: string;
}

interface UpdatePortInput {
  name?: string;
  country?: string;
  address?: string;
}

// Ports are global entities shared across organizations.
export async function getAllPorts() {
  return db.select().from(ports).orderBy(asc(ports.name));
}

export async function getPortById(id: string) {
  const rows = await db.select().from(ports).where(eq(ports.id, id));

  return rows[0] ?? null;
}

export async function createPort(data: CreatePortInput) {
  const coords = await geocodeAddress(data.address);

  if (!coords) {
    throw new Error(`Could not geocode address: ${data.address}`);
  }

  const rows = await db
    .insert(ports)
    .values({
      name: data.name,
      country: data.country,
      lat: coords.lat,
      lng: coords.lng,
    })
    .returning();

  return rows[0];
}

export async function updatePort(id: string, data: UpdatePortInput) {
  const updates: {
    name?: string;
    country?: string;
    lat?: number;
    lng?: number;
  } = {};

  if (data.name) {
    updates.name = data.name;
  }

  if (data.country) {
    updates.country = data.country;
  }

  if (data.address) {
    const coords = await geocodeAddress(data.address);

    if (!coords) {
      throw new Error(`Could not geocode address: ${data.address}`);
    }

    updates.lat = coords.lat;
    updates.lng = coords.lng;
  }

  const rows = await db
    .update(ports)
    .set(updates)
    .where(eq(ports.id, id))
    .returning();

  return rows[0] ?? null;
}

// Prevent deletion while referenced by suppliers or warehouses.
export async function deletePort(id: string) {
  const refs = await isPortReferenced(id);

  if (refs.suppliers > 0 || refs.warehouses > 0) {
    throw new Error("Port is still referenced by suppliers or warehouses");
  }

  await db.delete(ports).where(eq(ports.id, id));
}

export async function isPortReferenced(id: string): Promise<{
  suppliers: number;
  warehouses: number;
}> {
  const supplierRefs = await db
    .select({
      id: supplierExportPorts.id,
    })
    .from(supplierExportPorts)
    .where(eq(supplierExportPorts.portId, id));

  const warehouseRefs = await db
    .select({
      id: warehouses.id,
    })
    .from(warehouses)
    .where(eq(warehouses.importPortId, id));

  return {
    suppliers: supplierRefs.length,
    warehouses: warehouseRefs.length,
  };
}
