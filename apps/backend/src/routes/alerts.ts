import { Router } from "express";
import { requireAuth, getOrgId } from "../middleware/auth";
import {
  getAlertsByOrg,
  getAllAlertsByOrg,
  dismissAlert,
  dismissAllAlerts,
} from "../services/alert.service";

const router = Router();

// get active alerts for the org
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    const includeAll = req.query.all === "true";
    const isDismissed = req.query.isDismissed;

    if (isDismissed !== undefined) {
      const dismissed = isDismissed === "true";
      const data = dismissed
        ? await getAllAlertsByOrg(orgId) // get all then filter
        : await getAlertsByOrg(orgId);
      res.json(data);
      return;
    }

    const data = includeAll
      ? await getAllAlertsByOrg(orgId)
      : await getAlertsByOrg(orgId);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// dismiss a single alert by id
router.patch<{ id: string }>("/:id/dismiss", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const id = req.params.id;

    const alert = await dismissAlert(id, orgId);

    if (!alert) {
      res.status(404).json({
        error: "Alert not found",
      });
      return;
    }

    res.json({
      success: true,
    });
  } catch (err) {
    next(err);
  }
});

// Dismisses all active alerts for the organization
router.post("/dismiss-all", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    await dismissAllAlerts(orgId);

    res.json({
      success: true,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
