"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Phone,
  PhoneOff,
  Search,
  Star,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  NativeSelect,
} from "@aiwebsite/ui";

import {
  importGooglePlacesAction,
  searchGooglePlacesAction,
} from "@/lib/actions/lead-search";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  types: string[];
  openNow: boolean | null;
  lat: number | null;
  lng: number | null;
  businessStatus: string | null;
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  alreadyInCrm: boolean;
}

type WebsiteFilter = "all" | "has" | "none";
type PhoneFilter = "all" | "has" | "none";

const MIN_RATINGS = [0, 3, 3.5, 4, 4.5];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function FindLeadsPanel() {
  const router = useRouter();

  // Search form
  const [city, setCity] = React.useState("");
  const [sector, setSector] = React.useState("");
  const [searching, startSearching] = React.useTransition();
  const [results, setResults] = React.useState<PlaceResult[] | null>(null);
  const [nextPageToken, setNextPageToken] = React.useState<string | null>(null);
  const [lastQuery, setLastQuery] = React.useState("");

  // Result filters
  const [minRating, setMinRating] = React.useState(0);
  const [websiteFilter, setWebsiteFilter] = React.useState<WebsiteFilter>("all");
  const [phoneFilter, setPhoneFilter] = React.useState<PhoneFilter>("all");

  // Selection + import
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [tags, setTags] = React.useState("");
  const [importing, startImporting] = React.useTransition();

  function buildQuery() {
    const parts = [sector.trim(), city.trim()].filter(Boolean);
    return sector.trim() && city.trim()
      ? `${sector.trim()} in ${city.trim()}, India`
      : parts.join(" ") + ", India";
  }

  function runSearch(pageToken?: string) {
    const query = pageToken ? lastQuery : buildQuery();
    if (!sector.trim() || !city.trim()) {
      toast.error("Enter both a city and a business type/sector.");
      return;
    }
    startSearching(async () => {
      const MAX_RETRIES = 3;
      let toldUser = false;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const result = await searchGooglePlacesAction({ query, pageToken });
        if (result.ok) {
          setLastQuery(query);
          setResults((prev) =>
            pageToken ? [...(prev ?? []), ...result.results] : result.results
          );
          setNextPageToken(result.nextPageToken);
          if (!pageToken) setSelected(new Set());
          if (result.results.length === 0 && !pageToken) {
            toast.info("No businesses found — try a broader search.");
          }
          return;
        }
        if (result.retryable && attempt < MAX_RETRIES) {
          if (!toldUser) {
            toast.info("Google is still preparing the next page — retrying…");
            toldUser = true;
          }
          await sleep(2000);
          continue;
        }
        toast.error(result.error);
        return;
      }
    });
  }

  const filtered = React.useMemo(() => {
    if (!results) return [];
    return results.filter((r) => {
      if ((r.rating ?? 0) < minRating) return false;
      if (websiteFilter === "has" && !r.website) return false;
      if (websiteFilter === "none" && r.website) return false;
      if (phoneFilter === "has" && !r.phone) return false;
      if (phoneFilter === "none" && r.phone) return false;
      return true;
    });
  }, [results, minRating, websiteFilter, phoneFilter]);

  function toggle(placeId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  }

  const selectableFiltered = React.useMemo(
    () => filtered.filter((r) => !r.alreadyInCrm),
    [filtered]
  );

  function toggleAll() {
    setSelected((prev) =>
      prev.size === selectableFiltered.length
        ? new Set()
        : new Set(selectableFiltered.map((r) => r.placeId))
    );
  }

  function importSelected() {
    if (!results) return;
    const places = results
      .filter((r) => selected.has(r.placeId) && !r.alreadyInCrm)
      .map((r) => ({
        placeId: r.placeId,
        name: r.name,
        phone: r.phone,
        website: r.website,
        address: r.address,
        rating: r.rating,
        reviewCount: r.reviewCount,
        googleMapsUrl: r.googleMapsUrl,
        lat: r.lat,
        lng: r.lng,
      }));
    if (places.length === 0) {
      toast.error("Select at least one business first.");
      return;
    }
    startImporting(async () => {
      const result = await importGooglePlacesAction({
        places,
        category: sector.trim() || undefined,
        defaultTags: tags.trim() || undefined,
      });
      if (result.ok) {
        toast.success(result.message);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Search form */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="city" className="text-xs text-muted-foreground">
                City / area
              </Label>
              <Input
                id="city"
                placeholder="e.g. Karol Bagh, Delhi"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
            <div>
              <Label htmlFor="sector" className="text-xs text-muted-foreground">
                Business type / sector
              </Label>
              <Input
                id="sector"
                placeholder="e.g. Dental Clinic, Restaurant, Gym"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
            </div>
          </div>
          <Button onClick={() => runSearch()} disabled={searching}>
            {searching ? <Loader2 className="animate-spin" /> : <Search />}
            Search Google Maps
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Min rating</Label>
                <NativeSelect
                  className="w-32"
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                >
                  {MIN_RATINGS.map((r) => (
                    <option key={r} value={r}>
                      {r === 0 ? "Any" : `${r}+`}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Website</Label>
                <NativeSelect
                  className="w-40"
                  value={websiteFilter}
                  onChange={(e) => setWebsiteFilter(e.target.value as WebsiteFilter)}
                >
                  <option value="all">All</option>
                  <option value="none">No website (best prospects)</option>
                  <option value="has">Has website</option>
                </NativeSelect>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <NativeSelect
                  className="w-40"
                  value={phoneFilter}
                  onChange={(e) => setPhoneFilter(e.target.value as PhoneFilter)}
                >
                  <option value="all">All</option>
                  <option value="has">Has phone</option>
                  <option value="none">No phone</option>
                </NativeSelect>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">
                {filtered.length} of {results.length} shown · {selected.size} selected
                {filtered.some((r) => r.alreadyInCrm) &&
                  ` · ${filtered.filter((r) => r.alreadyInCrm).length} already in CRM`}
              </span>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="w-8 py-2 pl-3">
                      <input
                        type="checkbox"
                        checked={
                          selectableFiltered.length > 0 &&
                          selected.size === selectableFiltered.length
                        }
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="py-2 pr-4 font-medium">Business</th>
                    <th className="py-2 pr-4 font-medium">Rating</th>
                    <th className="py-2 pr-4 font-medium">Website</th>
                    <th className="py-2 pr-4 font-medium">Phone</th>
                    <th className="py-2 pr-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.placeId}
                      className={`border-b last:border-0 hover:bg-muted/30 ${
                        r.alreadyInCrm ? "opacity-50" : ""
                      }`}
                    >
                      <td className="py-2 pl-3">
                        <input
                          type="checkbox"
                          checked={selected.has(r.placeId)}
                          disabled={r.alreadyInCrm}
                          onChange={() => toggle(r.placeId)}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.address}</p>
                        {r.alreadyInCrm && (
                          <Badge variant="secondary" className="mt-1">
                            Already in CRM
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {r.rating !== null ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            {r.rating.toFixed(1)}
                            {r.reviewCount !== null && (
                              <span className="text-xs text-muted-foreground">
                                ({r.reviewCount})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {r.website ? (
                          <a
                            href={r.website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            Yes
                          </a>
                        ) : (
                          <Badge variant="success" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            No website
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {r.phone ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Phone className="h-3.5 w-3.5 text-success" />
                            {r.phone}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <PhoneOff className="h-3.5 w-3.5" />
                            None
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {r.googleMapsUrl && (
                          <a
                            href={r.googleMapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-primary"
                            title="Open in Google Maps"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        No results match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {nextPageToken && (
              <Button variant="outline" size="sm" onClick={() => runSearch(nextPageToken)} disabled={searching}>
                {searching ? <Loader2 className="animate-spin" /> : null}
                Load more results
              </Button>
            )}

            <div className="flex flex-wrap items-end gap-2 border-t pt-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="tags" className="text-xs text-muted-foreground">
                  Tags for imported leads (optional)
                </Label>
                <Input
                  id="tags"
                  placeholder="e.g. cold-outreach, batch-1"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
              <Button onClick={importSelected} disabled={importing || selected.size === 0}>
                {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Import {selected.size > 0 ? selected.size : ""} lead{selected.size === 1 ? "" : "s"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
