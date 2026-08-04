"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
  Switch,
} from "@aiwebsite/ui";

import { runImportAction, type ImportResult } from "@/lib/actions/import";
import { IMPORT_FIELDS, suggestMapping } from "@/lib/import-mapping";

type Step = "upload" | "map" | "review" | "done";

type RawRow = Record<string, unknown>;

interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: RawRow[];
}

const MAX_ROWS = 2000;

const SAMPLE_ROWS: Record<string, string>[] = [
  {
    business_name: "Sharma Dental Clinic",
    category: "Dental Clinic",
    owner_name: "Dr. Rakesh Sharma",
    phone: "9876543210",
    whatsapp: "9876543210",
    email: "rakesh@sharmadental.com",
    website: "",
    instagram: "",
    facebook: "",
    linkedin: "",
    google_rating: "4.7",
    review_count: "312",
    address: "12 MG Road, Near City Mall",
    area: "Andheri West",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    pincode: "400058",
    latitude: "19.1364",
    longitude: "72.8296",
    google_maps_url: "https://maps.google.com/?q=Sharma+Dental+Clinic",
    place_id: "",
    business_description: "Family dental clinic offering general and cosmetic dentistry",
    services: "Root canal, Braces, Teeth whitening",
    notes: "Owner interested in a new website",
    lead_source: "google_maps",
    tags: "dental",
    priority: "high",
  },
  {
    business_name: "Green Leaf Cafe",
    category: "Restaurant",
    owner_name: "Anita Verma",
    phone: "9123456780",
    whatsapp: "9123456780",
    email: "",
    website: "",
    instagram: "",
    facebook: "",
    linkedin: "",
    google_rating: "4.3",
    review_count: "128",
    address: "45 Park Street",
    area: "Camac Street",
    city: "Kolkata",
    state: "West Bengal",
    country: "India",
    pincode: "700016",
    latitude: "22.5535",
    longitude: "88.3517",
    google_maps_url: "",
    place_id: "",
    business_description: "Cozy cafe serving continental and Bengali fusion food",
    services: "Dine-in, Takeaway, Catering",
    notes: "Referred by existing client",
    lead_source: "referral",
    tags: "cafe;food",
    priority: "medium",
  },
];

function downloadSampleCsv() {
  const headers = IMPORT_FIELDS.map((f) => f.key);
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    headers.join(","),
    ...SAMPLE_ROWS.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads_import_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseJsonFile(text: string): { headers: string[]; rows: RawRow[] } {
  const data: unknown = JSON.parse(text);
  const array = Array.isArray(data)
    ? data
    : typeof data === "object" && data !== null && Array.isArray((data as { leads?: unknown[] }).leads)
      ? (data as { leads: unknown[] }).leads
      : null;
  if (!array) throw new Error("JSON must be an array of objects (or { leads: [...] }).");
  const rows = array.filter((r): r is RawRow => typeof r === "object" && r !== null);
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return { headers, rows };
}

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("upload");
  const [file, setFile] = React.useState<ParsedFile | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [skipDuplicates, setSkipDuplicates] = React.useState(true);
  const [defaultSource, setDefaultSource] = React.useState("import");
  const [defaultTags, setDefaultTags] = React.useState("");
  const [result, setResult] = React.useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFile(selected: File) {
    const finish = (headers: string[], rows: RawRow[]) => {
      if (rows.length === 0) {
        toast.error("No data rows found in the file.");
        return;
      }
      if (rows.length > MAX_ROWS) {
        toast.error(`File has ${rows.length} rows — the limit is ${MAX_ROWS} per import.`);
        return;
      }
      setFile({ fileName: selected.name, headers, rows });
      setMapping(suggestMapping(headers));
      setStep("map");
    };

    if (selected.name.toLowerCase().endsWith(".json")) {
      selected
        .text()
        .then((text) => {
          const { headers, rows } = parseJsonFile(text);
          finish(headers, rows);
        })
        .catch((e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Could not parse JSON file.")
        );
      return;
    }

    Papa.parse<RawRow>(selected, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (parsed) => {
        const headers = (parsed.meta.fields ?? []).filter(Boolean);
        if (headers.length === 0) {
          toast.error("Could not detect a header row in the CSV.");
          return;
        }
        finish(headers, parsed.data);
      },
      error: (err) => toast.error(`CSV parse failed: ${err.message}`),
    });
  }

  // Client-side dry run for the review step.
  const review = React.useMemo(() => {
    if (!file) return null;
    const nameColumn = Object.entries(mapping).find(([, t]) => t === "business_name")?.[0];
    let missingName = 0;
    const phoneColumn = Object.entries(mapping).find(([, t]) => t === "phone")?.[0];
    const seenPhones = new Set<string>();
    let inFileDupes = 0;
    for (const row of file.rows) {
      const name = nameColumn ? String(row[nameColumn] ?? "").trim() : "";
      if (!name) missingName += 1;
      if (phoneColumn) {
        const digits = String(row[phoneColumn] ?? "").replace(/[^0-9]/g, "").slice(-10);
        if (digits.length === 10) {
          if (seenPhones.has(digits)) inFileDupes += 1;
          else seenPhones.add(digits);
        }
      }
    }
    const mappedCount = Object.values(mapping).filter(Boolean).length;
    return { missingName, inFileDupes, mappedCount, hasName: !!nameColumn };
  }, [file, mapping]);

  function runImport() {
    if (!file) return;
    startTransition(async () => {
      const res = await runImportAction({
        fileName: file.fileName,
        mapping,
        options: { skipDuplicates, defaultSource, defaultTags },
        rows: file.rows,
      });
      if (res.ok) {
        setResult(res);
        setStep("done");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setMapping({});
    setResult(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {step === "upload" && "1 · Choose a file"}
          {step === "map" && "2 · Map columns"}
          {step === "review" && "3 · Review & import"}
          {step === "done" && "Import complete"}
        </CardTitle>
        <CardDescription>
          {step === "upload" && "CSV with a header row, or a JSON array of objects. Up to 2,000 rows."}
          {step === "map" && `${file?.fileName} · ${file?.rows.length} rows · pick a target for each column`}
          {step === "review" && "Last check before writing to the CRM."}
          {step === "done" && file?.fileName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "upload" && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files[0];
                if (dropped) handleFile(dropped);
              }}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <FileSpreadsheet className="h-8 w-8" />
              <span className="text-sm font-medium">Drop a CSV/JSON file here or click to browse</span>
              <span className="text-xs">Your 40+ column exports work — unknown columns are preserved.</span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) handleFile(selected);
                  e.target.value = "";
                }}
              />
            </button>
            <p className="text-center text-xs text-muted-foreground">
              New to imports?{" "}
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Download a sample CSV
              </button>{" "}
              with the right columns filled in.
            </p>
          </>
        )}

        {step === "map" && file && (
          <>
            <div className="max-h-96 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">File column</th>
                    <th className="px-3 py-2 font-medium">Sample</th>
                    <th className="px-3 py-2 font-medium">Import as</th>
                  </tr>
                </thead>
                <tbody>
                  {file.headers.map((header) => (
                    <tr key={header} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{header}</td>
                      <td className="max-w-48 truncate px-3 py-2 text-xs text-muted-foreground">
                        {String(file.rows[0]?.[header] ?? "")}
                      </td>
                      <td className="px-3 py-2">
                        <NativeSelect
                          className="h-8 w-56"
                          value={mapping[header] ?? ""}
                          onChange={(e) =>
                            setMapping((m) => ({ ...m, [header]: e.target.value }))
                          }
                        >
                          <option value="">— keep as raw data only —</option>
                          {IMPORT_FIELDS.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={reset}>
                <ArrowLeft />
                Start over
              </Button>
              <Button onClick={() => setStep("review")} disabled={!review?.hasName}>
                {review?.hasName ? "Continue" : "Map Business name to continue"}
                <ArrowRight />
              </Button>
            </div>
          </>
        )}

        {step === "review" && file && review && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-2xl font-semibold tabular-nums">{file.rows.length}</p>
                <p className="text-xs text-muted-foreground">rows in file</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-2xl font-semibold tabular-nums">{review.mappedCount}</p>
                <p className="text-xs text-muted-foreground">columns mapped</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-2xl font-semibold tabular-nums text-warning">
                  {review.missingName}
                </p>
                <p className="text-xs text-muted-foreground">rows missing business name</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-2xl font-semibold tabular-nums text-warning">
                  {review.inFileDupes}
                </p>
                <p className="text-xs text-muted-foreground">duplicate phones in file</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Switch
                  id="skip-dupes"
                  checked={skipDuplicates}
                  onCheckedChange={setSkipDuplicates}
                />
                <Label htmlFor="skip-dupes" className="text-sm leading-snug">
                  Skip rows matching existing leads (phone / place ID)
                </Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="default-source">Lead source</Label>
                <Input
                  id="default-source"
                  value={defaultSource}
                  onChange={(e) => setDefaultSource(e.target.value)}
                  placeholder="import"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="default-tags">Add tags to every row</Label>
                <Input
                  id="default-tags"
                  value={defaultTags}
                  onChange={(e) => setDefaultTags(e.target.value)}
                  placeholder="jan-batch, karol-bagh"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("map")} disabled={isPending}>
                <ArrowLeft />
                Back to mapping
              </Button>
              <Button onClick={runImport} disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : <Upload />}
                Import {file.rows.length} rows
              </Button>
            </div>
          </>
        )}

        {step === "done" && result && (
          <>
            <div className="flex items-center gap-3 rounded-md border border-success/40 bg-success/10 p-4">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
              <div className="text-sm">
                <p className="font-medium">
                  Imported {result.imported} lead{result.imported === 1 ? "" : "s"}.
                </p>
                <p className="text-muted-foreground">
                  {result.duplicates} duplicate{result.duplicates === 1 ? "" : "s"} detected ·{" "}
                  {result.skipped} skipped.
                </p>
              </div>
            </div>
            {result.issues.length > 0 && (
              <div className="space-y-1 rounded-md border p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Row notes (first {result.issues.length})
                </p>
                <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {result.issues.map((issue, i) => (
                    <li key={i}>
                      Row {issue.row}: {issue.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => router.push("/leads")}>View leads</Button>
              <Button variant="outline" onClick={reset}>
                Import another file
              </Button>
              <Badge variant="outline" className="ml-auto self-center font-mono text-[10px]">
                batch {result.importId.slice(0, 8)}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
