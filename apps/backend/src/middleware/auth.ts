import type { Request, Response, NextFunction } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";

// Registers Clerk on every request.
export const clerk = clerkMiddleware();

// Extracts the authenticated organization ID.
export const getOrgId = (req: Request): string => {
  const { orgId } = getAuth(req);

  if (!orgId) {
    throw new Error(
      "No active organization found. Please select an organization.",
    );
  }

  return orgId;
};

// Extracts the authenticated user ID.
export const getUserId = (req: Request): string => {
  const { userId } = getAuth(req);

  if (!userId) {
    throw new Error("Unauthenticated");
  }

  return userId;
};

// API auth guard.
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({
      error: "Unauthenticated",
    });
    return;
  }

  next();
};

// Converts auth-related errors into HTTP 401 responses.
export const handleAuthError = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (
    err.message === "Unauthenticated" ||
    err.message.includes("No active organization")
  ) {
    res.status(401).json({
      error: err.message,
    });
    return;
  }

  next(err);
};
