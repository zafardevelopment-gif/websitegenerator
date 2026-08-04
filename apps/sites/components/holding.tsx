import { AGENCY_NAME } from "@aiwebsite/config";

export type HoldingKind = "not-found" | "unpublished" | "expired";

const COPY: Record<HoldingKind, { title: string; body: string }> = {
  "not-found": {
    title: "This website isn't live",
    body: "There is no active website at this address. Check the link you received, or contact us for a fresh demo.",
  },
  unpublished: {
    title: "This website is being prepared",
    body: "The site exists but hasn't been published yet. Check back soon!",
  },
  expired: {
    title: "This demo has expired",
    body: "This demo website is no longer active. Want it back — with your own domain? Get in touch and we'll make it permanent.",
  },
};

export function HoldingPage({
  kind,
  slug,
  businessName,
  agencyWhatsapp,
}: {
  kind: HoldingKind;
  slug?: string;
  businessName?: string;
  agencyWhatsapp?: string;
}) {
  const copy = COPY[kind];
  return (
    <div className="holding-body">
      <main className="holding-card">
        <span className="brand-badge">A</span>
        <h1>{businessName ?? copy.title}</h1>
        {businessName && <p style={{ fontWeight: 600 }}>{copy.title}</p>}
        <p>{copy.body}</p>
        {slug && (
          <p>
            Address: <span className="slug">{slug}</span>
          </p>
        )}
        {agencyWhatsapp && (
          <p>
            <a
              href={`https://wa.me/${agencyWhatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#8b5cf6", fontWeight: 600 }}
            >
              WhatsApp {AGENCY_NAME}
            </a>
          </p>
        )}
        <p>Powered by {AGENCY_NAME}</p>
      </main>
    </div>
  );
}
