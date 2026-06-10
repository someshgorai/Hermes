import { Router } from "express";
import { requireAuth, getOrgId } from "../middleware/auth";
import {
  getRecommendationsByOrg,
  acceptRecommendation,
  dismissRecommendation,
} from "../services/recommendation.service";

const router = Router();

// Returns active recommendations for the organization.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    const recommendations = await getRecommendationsByOrg(orgId);

    res.json(recommendations);
  } catch (err) {
    next(err);
  }
});

// Accepts a recommendation.
router.patch<{ id: string }>(
  "/:id/accept",
  requireAuth,
  async (req, res, next) => {
    try {
      const orgId = getOrgId(req);

      const recommendation = await acceptRecommendation(req.params.id, orgId);

      if (!recommendation) {
        res.status(404).json({
          error: "Recommendation not found",
        });
        return;
      }

      res.json({
        success: true,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Dismisses a recommendation.
router.patch<{ id: string }>(
  "/:id/dismiss",
  requireAuth,
  async (req, res, next) => {
    try {
      const orgId = getOrgId(req);

      const recommendation = await dismissRecommendation(req.params.id, orgId);

      if (!recommendation) {
        res.status(404).json({
          error: "Recommendation not found",
        });
        return;
      }

      res.json({
        success: true,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
