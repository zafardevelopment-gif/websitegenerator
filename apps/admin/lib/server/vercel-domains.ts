import "server-only";

/**
 * Vercel Domains API — attaches a client's custom domain to the apps/sites
 * Vercel project. Auto-SSL is handled by Vercel once DNS verifies; we only
 * need to add, check, and remove the domain-project link.
 * https://vercel.com/docs/rest-api/reference/endpoints/domains
 */

interface VercelConfig {
  token: string;
  projectId: string;
  teamId: string | null;
}

function getConfig(): VercelConfig | null {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID_SITES?.trim();
  if (!token || !projectId) return null;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID?.trim() || null };
}

function withTeam(path: string, teamId: string | null): string {
  return teamId ? `${path}${path.includes("?") ? "&" : "?"}teamId=${teamId}` : path;
}

async function vercelFetch(config: VercelConfig, path: string, init?: RequestInit) {
  const response = await fetch(`https://api.vercel.com${withTeam(path, config.teamId)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

export interface DnsInstruction {
  type: string;
  name: string;
  value: string;
}

export interface AddDomainResult {
  verified: boolean;
  instructions: DnsInstruction[];
}

/** true when `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID_SITES` are both configured. */
export function isVercelDomainsConfigured(): boolean {
  return getConfig() !== null;
}

/** Attaches `domain` to the sites project. Returns DNS instructions if not yet verified. */
export async function addDomainToProject(domain: string): Promise<AddDomainResult> {
  const config = getConfig();
  if (!config) {
    throw new Error("Vercel Domains isn't configured — set VERCEL_API_TOKEN and VERCEL_PROJECT_ID_SITES.");
  }

  const { ok, payload } = await vercelFetch(config, `/v10/projects/${config.projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
  const body = payload as {
    error?: { message?: string; code?: string };
    verified?: boolean;
  };
  if (!ok && body.error?.code !== "domain_already_in_use") {
    throw new Error(body.error?.message ?? "Failed to add domain in Vercel.");
  }

  return checkDomainVerification(domain);
}

/** Polls Vercel's verification state for a domain already attached to the project. */
export async function checkDomainVerification(domain: string): Promise<AddDomainResult> {
  const config = getConfig();
  if (!config) {
    throw new Error("Vercel Domains isn't configured — set VERCEL_API_TOKEN and VERCEL_PROJECT_ID_SITES.");
  }

  const { payload } = await vercelFetch(
    config,
    `/v9/projects/${config.projectId}/domains/${domain}/config`
  );
  const config2 = payload as { misconfigured?: boolean };

  const { payload: verifyPayload } = await vercelFetch(
    config,
    `/v9/projects/${config.projectId}/domains/${domain}/verify`,
    { method: "POST" }
  );
  const verify = verifyPayload as {
    verified?: boolean;
    domain?: { verification?: { type: string; domain: string; value: string; reason: string }[] };
  };

  const verified = verify.verified === true && config2.misconfigured !== true;
  const instructions: DnsInstruction[] = (verify.domain?.verification ?? []).map((v) => ({
    type: v.type,
    name: v.domain,
    value: v.value,
  }));

  if (instructions.length === 0 && !verified) {
    instructions.push({ type: "CNAME", name: domain, value: "cname.vercel-dns.com" });
  }

  return { verified, instructions };
}

export async function removeDomainFromProject(domain: string): Promise<void> {
  const config = getConfig();
  if (!config) return;
  await vercelFetch(config, `/v9/projects/${config.projectId}/domains/${domain}`, {
    method: "DELETE",
  });
}
