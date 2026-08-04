import "server-only";

import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { QuotationWithItems } from "@aiwebsite/db/repositories/quotations";

export interface QuotationPdfData {
  agency: {
    name: string;
    whatsapp: string;
    email: string;
    address: string;
    gstNo: string;
  };
  businessName: string;
  demoUrl: string;
  quotation: QuotationWithItems;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#1c1917" },
  brandBar: { height: 6, backgroundColor: "#4f46e5", marginBottom: 24, borderRadius: 3 },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 13, color: "#57534e", marginBottom: 24 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  metaBlock: { maxWidth: 260 },
  metaLabel: { fontSize: 9, color: "#a8a29e", marginBottom: 2, textTransform: "uppercase" },
  metaValue: { marginBottom: 6, lineHeight: 1.4 },
  section: { marginBottom: 20 },
  h2: { fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#4f46e5" },
  table: { borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e7e5e4" },
  tableRowLast: { flexDirection: "row" },
  tableHeaderCell: { fontWeight: 700, backgroundColor: "#f5f5f4" },
  cellDesc: { flex: 1, padding: 8 },
  cellQty: { width: 60, padding: 8, textAlign: "right" },
  cellPrice: { width: 90, padding: 8, textAlign: "right" },
  cellAmt: { width: 100, padding: 8, textAlign: "right" },
  totalsBlock: { marginTop: 12, alignSelf: "flex-end", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#1c1917",
  },
  notes: { marginTop: 20, fontSize: 10, color: "#57534e", lineHeight: 1.5 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, fontSize: 9, color: "#a8a29e" },
});

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

export function QuotationDocument({ data }: { data: QuotationPdfData }) {
  const { quotation } = data;
  return (
    <Document title={`Quotation ${quotation.quote_number} — ${data.businessName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} />
        <Text style={styles.title}>Quotation</Text>
        <Text style={styles.sub}>
          {quotation.quote_number} · {STATUS_LABELS[quotation.status] ?? quotation.status}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>From</Text>
            <Text style={styles.metaValue}>{data.agency.name}</Text>
            {data.agency.address && <Text style={styles.metaValue}>{data.agency.address}</Text>}
            {data.agency.gstNo && <Text style={styles.metaValue}>GSTIN {data.agency.gstNo}</Text>}
            {data.agency.whatsapp && <Text style={styles.metaValue}>WhatsApp {data.agency.whatsapp}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>To</Text>
            <Text style={styles.metaValue}>{data.businessName}</Text>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>
              {new Date(quotation.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
            {quotation.valid_until && (
              <>
                <Text style={styles.metaLabel}>Valid until</Text>
                <Text style={styles.metaValue}>
                  {new Date(quotation.valid_until).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>{quotation.title}</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeaderCell]}>
              <Text style={[styles.cellDesc, styles.tableHeaderCell]}>Item</Text>
              <Text style={[styles.cellQty, styles.tableHeaderCell]}>Qty</Text>
              <Text style={[styles.cellPrice, styles.tableHeaderCell]}>Unit price</Text>
              <Text style={[styles.cellAmt, styles.tableHeaderCell]}>Amount</Text>
            </View>
            {quotation.items.map((item, i) => (
              <View
                key={item.id}
                style={i === quotation.items.length - 1 ? styles.tableRowLast : styles.tableRow}
              >
                <Text style={styles.cellDesc}>{item.description}</Text>
                <Text style={styles.cellQty}>{item.quantity}</Text>
                <Text style={styles.cellPrice}>{formatInr(item.unit_price)}</Text>
                <Text style={styles.cellAmt}>{formatInr(item.amount)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text>Subtotal</Text>
              <Text>{formatInr(quotation.subtotal)}</Text>
            </View>
            {quotation.gst_enabled && (
              <View style={styles.totalRow}>
                <Text>GST ({quotation.gst_rate}%)</Text>
                <Text>{formatInr(quotation.gst_amount)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={{ fontWeight: 700 }}>Total</Text>
              <Text style={{ fontWeight: 700 }}>{formatInr(quotation.total)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Live demo</Text>
          <Text>{data.demoUrl}</Text>
        </View>

        {quotation.notes && <Text style={styles.notes}>{quotation.notes}</Text>}

        <Text style={styles.footer}>
          {data.agency.name}
          {data.agency.gstNo ? ` · GSTIN ${data.agency.gstNo}` : ""} · {data.agency.address}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
  return renderToBuffer(<QuotationDocument data={data} />);
}
