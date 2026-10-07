import { Router } from "express";
import { loadSpec } from "../openapi/spec";
import { sendInternalError } from "./http";

const router = Router();

/** The API contract (D-062), for tooling and the generated web client. Public. */
router.get("/", (_req, res) => {
  try {
    return res.json(loadSpec());
  } catch (err) {
    return sendInternalError(res, "Load OpenAPI spec error", err);
  }
});

export default router;
