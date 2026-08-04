/** Deployment configuration stored in aiwebsite_settings under `deploy_config`. */
export interface DeployConfig {
  demoExpiryDays: number;
}

export const DEFAULT_DEPLOY_CONFIG: DeployConfig = {
  demoExpiryDays: 14,
};

export function normalizeDeployConfig(raw: unknown): DeployConfig {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_DEPLOY_CONFIG };
  const r = raw as { demoExpiryDays?: unknown };
  const days =
    typeof r.demoExpiryDays === "number" && Number.isFinite(r.demoExpiryDays)
      ? Math.min(365, Math.max(1, Math.round(r.demoExpiryDays)))
      : DEFAULT_DEPLOY_CONFIG.demoExpiryDays;
  return { demoExpiryDays: days };
}
