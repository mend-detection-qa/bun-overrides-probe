// Minimal stub — exercises the overrides probe.
// express is imported so the direct dep is reachable.
// qs is the overridden transitive dep (forced to 6.5.3 via package.json overrides).
import express from "express";

const app = express();

app.get("/", (_req, res) => {
  res.json({ probe: "bun-overrides-probe", status: "ok" });
});

export default app;