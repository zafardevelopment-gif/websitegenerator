"use client";

import * as React from "react";
import { Bot, CheckCircle2, Loader2, Save, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";

import { ANTHROPIC_MODELS, GEMINI_MODELS } from "@aiwebsite/ai/pricing";
import type { AiConfig } from "@aiwebsite/config";
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
} from "@aiwebsite/ui";

import { saveAiConfigAction, testAiEngineAction, type EngineTestReport } from "@/lib/actions/ai";

export function AiConfigForm({ config: initial, readOnly }: { config: AiConfig; readOnly: boolean }) {
  const [config, setConfig] = React.useState<AiConfig>(initial);
  const [isPending, startTransition] = React.useTransition();
  const [testing, startTesting] = React.useTransition();
  const [report, setReport] = React.useState<EngineTestReport | null>(null);

  function save() {
    startTransition(async () => {
      const result = await saveAiConfigAction(config);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function runTest() {
    setReport(null);
    startTesting(async () => {
      setReport(await testAiEngineAction());
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            AI engine
          </CardTitle>
          <CardDescription>
            Claude is primary; Gemini takes over automatically on failure. Keys live in Settings →
            API Keys (or env vars).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset disabled={readOnly || isPending} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-anthropic">Claude model (primary)</Label>
              <NativeSelect
                id="ai-anthropic"
                value={config.anthropicModel}
                onChange={(e) => setConfig((c) => ({ ...c, anthropicModel: e.target.value }))}
              >
                {ANTHROPIC_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-gemini">Gemini model (fallback)</Label>
              <NativeSelect
                id="ai-gemini"
                value={config.geminiModel}
                onChange={(e) => setConfig((c) => ({ ...c, geminiModel: e.target.value }))}
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-effort">Claude effort</Label>
              <NativeSelect
                id="ai-effort"
                value={config.effort}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, effort: e.target.value as AiConfig["effort"] }))
                }
              >
                <option value="low">Low — fastest, cheapest</option>
                <option value="medium">Medium — balanced (recommended)</option>
                <option value="high">High — most thorough</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-openai">OpenAI-compatible model (optional)</Label>
              <Input
                id="ai-openai"
                placeholder="e.g. llama-3.3-70b (leave empty to disable)"
                value={config.openaiCompatModel}
                onChange={(e) => setConfig((c) => ({ ...c, openaiCompatModel: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-budget">Monthly budget (₹)</Label>
              <Input
                id="ai-budget"
                type="number"
                min={0}
                value={config.monthlyBudgetInr}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, monthlyBudgetInr: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-fx">USD → INR rate (for cost estimates)</Label>
              <Input
                id="ai-fx"
                type="number"
                min={1}
                value={config.usdToInr}
                onChange={(e) => setConfig((c) => ({ ...c, usdToInr: Number(e.target.value) || 90 }))}
              />
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            {!readOnly && (
              <Button onClick={save} disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : <Save />}
                Save configuration
              </Button>
            )}
            <Button variant="outline" onClick={runTest} disabled={testing}>
              {testing ? <Loader2 className="animate-spin" /> : <Zap />}
              Test engine
            </Button>
          </div>

          {testing && (
            <p className="text-sm text-muted-foreground">
              Generating a structured test completion — this can take up to a minute…
            </p>
          )}

          {report && (
            <div
              className={`space-y-2 rounded-md border p-4 text-sm ${
                report.ok ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"
              }`}
            >
              {report.ok ? (
                <>
                  <p className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Engine working — structured JSON validated against the schema.
                  </p>
                  <p>
                    <span className="text-muted-foreground">Headline:</span>{" "}
                    <strong>{report.headline}</strong>
                    <br />
                    <span className="text-muted-foreground">Tagline:</span> {report.tagline}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="secondary">{report.provider}</Badge>
                    <Badge variant="outline">{report.model}</Badge>
                    <Badge variant="outline">{report.latencyMs} ms</Badge>
                    <Badge variant="outline">
                      {report.tokensIn} in / {report.tokensOut} out
                    </Badge>
                    <Badge variant="outline">
                      chain: {report.providersConfigured?.join(" → ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This call was logged to AI usage — check the dashboard cost widget.
                  </p>
                </>
              ) : (
                <p className="flex items-start gap-2 font-medium">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  {report.error}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
