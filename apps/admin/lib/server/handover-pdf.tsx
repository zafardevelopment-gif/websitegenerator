import "server-only";

import type { ReactNode } from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

export interface HandoverPdfData {
  agency: {
    name: string;
    whatsapp: string;
    email: string;
    address: string;
    gstNo: string;
  };
  businessName: string;
  liveUrl: string;
  domainStatus: "custom" | "demo_subdomain";
  domainExpiry: string | null;
  renewalDate: string | null;
  hostingNotes: string | null;
  maintenanceNotes: string | null;
  convertedAt: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#1c1917" },
  brandBar: { height: 6, backgroundColor: "#4f46e5", marginBottom: 24, borderRadius: 3 },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 13, color: "#57534e", marginBottom: 24 },
  section: { marginBottom: 20 },
  h2: { fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#4f46e5" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "#f0efed" },
  label: { color: "#57534e" },
  value: { fontWeight: 700, maxWidth: 320, textAlign: "right" },
  bullet: { flexDirection: "row", marginBottom: 6, gap: 6 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#4f46e5", marginTop: 4 },
  bulletText: { flex: 1, lineHeight: 1.4 },
  note: { fontSize: 10, color: "#57534e", lineHeight: 1.5, marginTop: 4 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, fontSize: 9, color: "#a8a29e" },
});

function formatDate(d: string | null): string {
  if (!d) return "Not set";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export function HandoverDocument({ data }: { data: HandoverPdfData }) {
  return (
    <Document title={`Handover pack — ${data.businessName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} />
        <Text style={styles.title}>Website handover pack</Text>
        <Text style={styles.sub}>{data.businessName}</Text>

        <View style={styles.section}>
          <Text style={styles.h2}>What&apos;s live</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Website</Text>
            <Text style={styles.value}>{data.liveUrl}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Domain</Text>
            <Text style={styles.value}>
              {data.domainStatus === "custom" ? "Your own custom domain" : "AIVEXA subdomain (temporary)"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Went live</Text>
            <Text style={styles.value}>{formatDate(data.convertedAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>What you own</Text>
          <Bullet>All website content, images and branding shown on the site — yours to reuse anywhere.</Bullet>
          <Bullet>Your domain registration (if you purchased/pointed your own domain) — renews with your registrar, not with us.</Bullet>
          <Bullet>All leads, reviews and customer data the site collects going forward.</Bullet>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>What we manage / what renews</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Domain expiry</Text>
            <Text style={styles.value}>{formatDate(data.domainExpiry)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Hosting / maintenance renewal</Text>
            <Text style={styles.value}>{formatDate(data.renewalDate)}</Text>
          </View>
          {data.hostingNotes && <Text style={styles.note}>{data.hostingNotes}</Text>}
          <Bullet>Hosting, SSL and uptime are managed by {data.agency.name} until the renewal date above.</Bullet>
          <Bullet>Content edits, new sections, or a redesign — just message us on WhatsApp any time.</Bullet>
        </View>

        {data.maintenanceNotes && (
          <View style={styles.section}>
            <Text style={styles.h2}>Notes</Text>
            <Text style={styles.note}>{data.maintenanceNotes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.h2}>Support</Text>
          {data.agency.whatsapp && (
            <View style={styles.row}>
              <Text style={styles.label}>WhatsApp</Text>
              <Text style={styles.value}>{data.agency.whatsapp}</Text>
            </View>
          )}
          {data.agency.email && (
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{data.agency.email}</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          {data.agency.name}
          {data.agency.gstNo ? ` · GSTIN ${data.agency.gstNo}` : ""} · {data.agency.address}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderHandoverPdf(data: HandoverPdfData): Promise<Buffer> {
  return renderToBuffer(<HandoverDocument data={data} />);
}
