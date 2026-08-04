"use client";

import * as React from "react";
import { Loader2, Rocket, Save } from "lucide-react";
import { toast } from "sonner";

import type { DeployConfig } from "@aiwebsite/config";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@aiwebsite/ui";

import { saveDeployConfigAction } from "@/lib/actions/deploy";

export function DeployConfigForm({
  config,
  readOnly,
}: {
  config: DeployConfig;
  readOnly: boolean;
}) {
  const [days, setDays] = React.useState(config.demoExpiryDays);
  const [isPending, startTransition] = React.useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveDeployConfigAction({ demoExpiryDays: days });
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-muted-foreground" />
          Deployment
        </CardTitle>
        <CardDescription>
          Demos auto-expire this many days after publishing (daily cron archives them; the demo
          banner shows a countdown in the final week).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-3">
        <div className="w-40 space-y-1.5">
          <Label htmlFor="expiry-days">Demo expiry (days)</Label>
          <Input
            id="expiry-days"
            type="number"
            min={1}
            max={365}
            value={days}
            disabled={readOnly || isPending}
            onChange={(e) => setDays(Number(e.target.value) || 14)}
          />
        </div>
        {!readOnly && (
          <Button onClick={save} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Save
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
