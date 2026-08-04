"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calculator, Loader2, Plus, RefreshCw, Save, X } from "lucide-react";
import { toast } from "sonner";

import {
  BUSINESS_CATEGORIES,
  computeLeadScore,
  type ScoringWeights,
} from "@aiwebsite/config";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
} from "@aiwebsite/ui";

import { recalculateScoresAction, saveScoringWeightsAction } from "@/lib/actions/scoring";

export function ScoringForm({
  weights: initial,
  readOnly,
}: {
  weights: ScoringWeights;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [weights, setWeights] = React.useState<ScoringWeights>(initial);
  const [newCategory, setNewCategory] = React.useState("");
  const [newWeight, setNewWeight] = React.useState("15");

  const setNum = (key: Exclude<keyof ScoringWeights, "categoryOverrides">) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      setWeights((w) => ({ ...w, [key]: Number.isFinite(n) ? n : 0 }));
    };

  // Live preview against a typical strong prospect.
  const preview = computeLeadScore(
    { googleRating: 4.7, reviewCount: 312, hasWebsite: false, category: "Dental Clinic" },
    weights
  );

  function save() {
    startTransition(async () => {
      const result = await saveScoringWeightsAction(weights);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function recalc() {
    startTransition(async () => {
      const result = await recalculateScoresAction();
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            Lead scoring weights
          </CardTitle>
          <CardDescription>
            score = rating + review volume + no-website bonus + category weight (0–100). Example
            preview — 4.7★, 312 reviews, no website, Dental Clinic:{" "}
            <span className="font-semibold text-foreground">{preview}/100</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset disabled={readOnly || isPending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="w-rating">Rating (max pts)</Label>
              <Input id="w-rating" type="number" min={0} max={100}
                value={weights.ratingWeight} onChange={setNum("ratingWeight")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-reviews">Reviews (max pts)</Label>
              <Input id="w-reviews" type="number" min={0} max={100}
                value={weights.reviewsWeight} onChange={setNum("reviewsWeight")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-saturation">Review saturation</Label>
              <Input id="w-saturation" type="number" min={1} max={100000}
                value={weights.reviewSaturation} onChange={setNum("reviewSaturation")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-nowebsite">No-website bonus</Label>
              <Input id="w-nowebsite" type="number" min={0} max={100}
                value={weights.noWebsiteWeight} onChange={setNum("noWebsiteWeight")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-category">Default category pts</Label>
              <Input id="w-category" type="number" min={0} max={100}
                value={weights.defaultCategoryWeight} onChange={setNum("defaultCategoryWeight")} />
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label>Category overrides</Label>
            {Object.keys(weights.categoryOverrides).length === 0 && (
              <p className="text-xs text-muted-foreground">
                None — every category uses the default weight.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {Object.entries(weights.categoryOverrides).map(([category, weight]) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                >
                  {category}: <span className="font-semibold tabular-nums">{weight}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label={`Remove override for ${category}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setWeights((w) => {
                          const next = { ...w.categoryOverrides };
                          delete next[category];
                          return { ...w, categoryOverrides: next };
                        })
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!readOnly && (
              <div className="flex items-end gap-2">
                <div className="w-56 space-y-1.5">
                  <Label htmlFor="ov-category" className="text-xs">Category</Label>
                  <NativeSelect
                    id="ov-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {BUSINESS_CATEGORIES.filter((c) => !(c in weights.categoryOverrides)).map(
                      (c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      )
                    )}
                  </NativeSelect>
                </div>
                <div className="w-24 space-y-1.5">
                  <Label htmlFor="ov-weight" className="text-xs">Points</Label>
                  <Input
                    id="ov-weight"
                    type="number"
                    min={0}
                    max={100}
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!newCategory}
                  onClick={() => {
                    const n = Number(newWeight);
                    if (!newCategory || !Number.isFinite(n)) return;
                    setWeights((w) => ({
                      ...w,
                      categoryOverrides: {
                        ...w.categoryOverrides,
                        [newCategory]: Math.max(0, Math.min(100, n)),
                      },
                    }));
                    setNewCategory("");
                  }}
                >
                  <Plus />
                  Add
                </Button>
              </div>
            )}
          </div>

          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : <Save />}
                Save weights
              </Button>
              <Button variant="outline" onClick={recalc} disabled={isPending}>
                <RefreshCw />
                Recalculate all lead scores
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
