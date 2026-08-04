import "server-only";

import type { WebsiteAudit } from "@aiwebsite/ai";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface AuditPdfData {
  agency: { name: string; whatsapp: string; email: string; address: string; gstNo: string };
  businessName: string;
  demoUrl: string;
  scores: {
    overall: number | null;
    seo: number | null;
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    mobile: number | null;
    desktop: number | null;
  };
  audit: WebsiteAudit;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#1c1917" },
  brandBar: { height: 6, backgroundColor: "#4f46e5", marginBottom: 32, borderRadius: 3 },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 13, color: "#57534e", marginBottom: 24 },
  h2: { fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#4f46e5" },
  p: { marginBottom: 6, lineHeight: 1.5 },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 14 },
  bulletText: { flex: 1, lineHeight: 1.4 },
  scoreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  scoreTile: {
    width: 100,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  scoreValue: { fontSize: 22, fontWeight: 700 },
  scoreLabel: { fontSize: 9, color: "#78716c", marginTop: 2, textAlign: "center" },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, fontSize: 9, color: "#a8a29e" },
});

function scoreColor(score: number | null): string {
  if (score === null) return "#a8a29e";
  if (score >= 90) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

function ScoreTile({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.scoreTile}>
      <Text style={[styles.scoreValue, { color: scoreColor(value) }]}>{value ?? "—"}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={styles.bullet}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

export function AuditDocument({ data }: { data: AuditPdfData }) {
  const { audit, scores } = data;
  const recommendationGroups = [
    { title: "SEO", items: audit.seoRecommendations },
    { title: "Conversion", items: audit.conversionRecommendations },
    { title: "Trust & credibility", items: audit.trustRecommendations },
    { title: "Speed", items: audit.speedRecommendations },
    { title: "Accessibility", items: audit.accessibilityRecommendations },
  ].filter((g) => g.items.length > 0);

  return (
    <Document title={`Website Health Audit — ${data.businessName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} />
        <Text style={styles.title}>Website Health Audit</Text>
        <Text style={styles.sub}>{data.businessName}</Text>

        <View style={styles.scoreGrid}>
          <ScoreTile label="Overall" value={scores.overall} />
          <ScoreTile label="SEO" value={scores.seo} />
          <ScoreTile label="Performance" value={scores.performance} />
          <ScoreTile label="Accessibility" value={scores.accessibility} />
          <ScoreTile label="Best Practices" value={scores.bestPractices} />
          <ScoreTile label="Mobile" value={scores.mobile} />
          <ScoreTile label="Desktop" value={scores.desktop} />
        </View>

        {audit.summary && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.p}>{audit.summary}</Text>
          </View>
        )}

        {audit.strengths.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.h2}>What&apos;s working</Text>
            <Bullets items={audit.strengths} />
          </View>
        )}

        {audit.weaknesses.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.h2}>Issues found</Text>
            <Bullets items={audit.weaknesses} />
          </View>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber }) => `Page ${pageNumber} — ${data.businessName}`}
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Recommendations</Text>
        {recommendationGroups.map((group) => (
          <View key={group.title} style={{ marginBottom: 14 }}>
            <Text style={[styles.p, { fontWeight: 700 }]}>{group.title}</Text>
            <Bullets items={group.items} />
          </View>
        ))}

        <View style={{ marginTop: 20 }}>
          <Text style={styles.h2}>Want us to fix these?</Text>
          <Text style={styles.p}>
            {data.agency.name} can implement every recommendation above as part of your website
            build. Message us on WhatsApp {data.agency.whatsapp} to get started.
          </Text>
          <Text style={styles.p}>Live demo: {data.demoUrl}</Text>
        </View>

        <Text style={styles.footer}>
          {data.agency.name}
          {data.agency.gstNo ? ` · GSTIN ${data.agency.gstNo}` : ""} · {data.agency.address}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderAuditPdf(data: AuditPdfData): Promise<Buffer> {
  return renderToBuffer(<AuditDocument data={data} />);
}
