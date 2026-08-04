import { AGENCY_NAME } from "@aiwebsite/config";

export default function BaseDomainPage() {
  return (
    <div className="holding-body">
      <main className="holding-card">
        <span className="brand-badge">A</span>
        <h1>{AGENCY_NAME}</h1>
        <p>Premium demo websites for local businesses.</p>
        <p>
          Looking for a demo? Open the link you received on WhatsApp — each business has its own
          subdomain.
        </p>
      </main>
    </div>
  );
}
