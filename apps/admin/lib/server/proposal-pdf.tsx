import "server-only";

import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export interface ProposalPricingLine {
  description: string;
  amount: number;
}

export interface ProposalData {
  agency: {
    name: string;
    logoUrl: string;
    whatsapp: string;
    email: string;
    address: string;
    gstNo: string;
  };
  lead: {
    businessName: string;
    ownerName: string | null;
    category: string | null;
    website: string | null;
    googleRating: number | null;
    reviewCount: number | null;
  };
  demoUrl: string;
  weaknesses: string[];
  features: string[];
  pricing: ProposalPricingLine[];
  gstEnabled: boolean;
  gstRate: number;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#1c1917" },
  coverTitle: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  coverSub: { fontSize: 14, color: "#57534e", marginBottom: 32 },
  brandBar: { height: 6, backgroundColor: "#4f46e5", marginBottom: 32, borderRadius: 3 },
  section: { marginBottom: 20 },
  h2: { fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#4f46e5" },
  p: { marginBottom: 4, lineHeight: 1.5 },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 14 },
  bulletText: { flex: 1, lineHeight: 1.4 },
  table: { borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e7e5e4" },
  tableRowLast: { flexDirection: "row" },
  tableCellDesc: { flex: 1, padding: 8 },
  tableCellAmt: { width: 100, padding: 8, textAlign: "right" },
  tableHeaderCell: { fontWeight: 700, backgroundColor: "#f5f5f4" },
  totalRow: { flexDirection: "row", paddingTop: 8, borderTopWidth: 2, borderTopColor: "#1c1917" },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, fontSize: 9, color: "#a8a29e" },
});

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function ProposalDocument({ data }: { data: ProposalData }) {
  const subtotal = data.pricing.reduce((sum, line) => sum + line.amount, 0);
  const gst = data.gstEnabled ? Math.round((subtotal * data.gstRate) / 100) : 0;
  const total = subtotal + gst;

  return (
    <Document title={`Proposal — ${data.lead.businessName}`}>
      {/* Cover page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} />
        <Text style={styles.coverTitle}>Website Proposal</Text>
        <Text style={styles.coverSub}>{data.lead.businessName}</Text>
        <View style={styles.section}>
          <Text style={styles.p}>Prepared by {data.agency.name}</Text>
          {data.agency.whatsapp && <Text style={styles.p}>WhatsApp: {data.agency.whatsapp}</Text>}
          {data.agency.email && <Text style={styles.p}>{data.agency.email}</Text>}
          <Text style={styles.p}>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.h2}>Live demo</Text>
          <Text style={styles.p}>{data.demoUrl}</Text>
        </View>
        <Text style={styles.footer}>
          {data.agency.name}
          {data.agency.gstNo ? ` · GSTIN ${data.agency.gstNo}` : ""} · {data.agency.address}
        </Text>
      </Page>

      {/* Findings + features */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.h2}>Current online presence</Text>
          <Text style={styles.p}>
            {data.lead.website
              ? `Existing website: ${data.lead.website}`
              : "No existing website found."}
          </Text>
          {data.lead.googleRating !== null && (
            <Text style={styles.p}>
              Google rating: {data.lead.googleRating.toFixed(1)}★
              {data.lead.reviewCount !== null ? ` (${data.lead.reviewCount} reviews)` : ""}
            </Text>
          )}
        </View>

        {data.weaknesses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.h2}>What we found</Text>
            {data.weaknesses.map((w, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{w}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.h2}>What you get</Text>
          {data.features.map((f, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{f}</Text>
            </View>
          ))}
        </View>
        <Text
          style={styles.footer}
          render={({ pageNumber }) => `Page ${pageNumber} — ${data.lead.businessName}`}
        />
      </Page>

      {/* Pricing */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.h2}>Pricing</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeaderCell]}>
              <Text style={[styles.tableCellDesc, styles.tableHeaderCell]}>Item</Text>
              <Text style={[styles.tableCellAmt, styles.tableHeaderCell]}>Amount</Text>
            </View>
            {data.pricing.map((line, i) => (
              <View
                key={i}
                style={i === data.pricing.length - 1 ? styles.tableRowLast : styles.tableRow}
              >
                <Text style={styles.tableCellDesc}>{line.description}</Text>
                <Text style={styles.tableCellAmt}>{formatInr(line.amount)}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text>Subtotal</Text>
              <Text>{formatInr(subtotal)}</Text>
            </View>
            {data.gstEnabled && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text>GST ({data.gstRate}%)</Text>
                <Text>{formatInr(gst)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, { justifyContent: "space-between" }]}>
              <Text style={{ fontWeight: 700 }}>Total</Text>
              <Text style={{ fontWeight: 700 }}>{formatInr(total)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.h2}>Next step</Text>
          <Text style={styles.p}>
            Reply on WhatsApp {data.agency.whatsapp} to confirm — we&apos;ll send a payment link
            and get your custom domain connected within 48 hours of confirmation.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderProposalPdf(data: ProposalData): Promise<Buffer> {
  return renderToBuffer(<ProposalDocument data={data} />);
}
