"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, Save, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { SETTING_KEYS, type SettingKey } from "@aiwebsite/config";
import type { SettingStatus } from "@aiwebsite/db/settings";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@aiwebsite/ui";

import { clearSettingAction, saveApiKeysAction } from "@/lib/actions/settings";
import { apiKeysSchema, type ApiKeysInput } from "@/lib/validation/settings";

interface FieldDef {
  name: keyof ApiKeysInput;
  label: string;
  secret: boolean;
  placeholder?: string;
}

interface GroupDef {
  title: string;
  description: string;
  phase: string;
  fields: FieldDef[];
}

const GROUPS: GroupDef[] = [
  {
    title: "AI providers",
    description: "Claude is primary, Gemini is the automatic fallback (Phase 6).",
    phase: "6",
    fields: [
      { name: "anthropic_api_key", label: "Anthropic (Claude) API key", secret: true },
      { name: "gemini_api_key", label: "Google Gemini API key", secret: true },
      {
        name: "openai_compat_base_url",
        label: "OpenAI-compatible base URL (optional)",
        secret: false,
        placeholder: "https://api.example.com/v1",
      },
      { name: "openai_compat_api_key", label: "OpenAI-compatible API key (optional)", secret: true },
    ],
  },
  {
    title: "Cloudinary",
    description: "Image optimization pipeline (Phase 8).",
    phase: "8",
    fields: [
      { name: "cloudinary_cloud_name", label: "Cloud name", secret: false },
      { name: "cloudinary_api_key", label: "API key", secret: true },
      { name: "cloudinary_api_secret", label: "API secret", secret: true },
    ],
  },
  {
    title: "Resend",
    description: "Transactional email for outreach (Phase 11).",
    phase: "11",
    fields: [{ name: "resend_api_key", label: "Resend API key", secret: true }],
  },
  {
    title: "Razorpay",
    description: "Payment links for won deals (Phase 14).",
    phase: "14",
    fields: [
      { name: "razorpay_key_id", label: "Key ID", secret: false },
      { name: "razorpay_key_secret", label: "Key secret", secret: true },
      { name: "razorpay_webhook_secret", label: "Webhook secret", secret: true },
    ],
  },
  {
    title: "Google Places",
    description: "Pulls a lead's real Google Business photos into its gallery.",
    phase: "15",
    fields: [{ name: "google_places_api_key", label: "Google Places API key", secret: true }],
  },
  {
    title: "n8n / WhatsApp inbound",
    description:
      "HMAC-SHA256 shared secret n8n signs its POST body with when it forwards a WhatsApp reply to /api/webhooks/whatsapp-inbound. Rotate any time — update it in n8n at the same time.",
    phase: "4",
    fields: [
      {
        name: "whatsapp_inbound_webhook_secret",
        label: "Inbound webhook secret",
        secret: true,
      },
    ],
  },
];

const EMPTY_VALUES: ApiKeysInput = {
  anthropic_api_key: "",
  gemini_api_key: "",
  openai_compat_base_url: "",
  openai_compat_api_key: "",
  cloudinary_cloud_name: "",
  cloudinary_api_key: "",
  cloudinary_api_secret: "",
  resend_api_key: "",
  razorpay_key_id: "",
  razorpay_key_secret: "",
  razorpay_webhook_secret: "",
  google_places_api_key: "",
  whatsapp_inbound_webhook_secret: "",
};

export function ApiKeysForm({
  status,
  readOnly,
  encryptionReady,
}: {
  status: Record<string, SettingStatus>;
  readOnly: boolean;
  encryptionReady: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // Plain (non-secret) values are shown as-is; secrets always start empty.
  const defaults: ApiKeysInput = {
    ...EMPTY_VALUES,
    openai_compat_base_url: status[SETTING_KEYS.openaiCompatBaseUrl]?.plainValue ?? "",
    cloudinary_cloud_name: status[SETTING_KEYS.cloudinaryCloudName]?.plainValue ?? "",
    razorpay_key_id: status[SETTING_KEYS.razorpayKeyId]?.plainValue ?? "",
  };

  const form = useForm<ApiKeysInput>({
    resolver: zodResolver(apiKeysSchema),
    defaultValues: defaults,
  });

  function onSubmit(values: ApiKeysInput) {
    startTransition(async () => {
      const result = await saveApiKeysAction(values);
      if (result.ok) {
        toast.success(result.message);
        form.reset(defaults);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function onClear(key: SettingKey) {
    startTransition(async () => {
      const result = await clearSettingAction(key);
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
      {!encryptionReady && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
          <span>
            <code className="font-mono text-xs">SETTINGS_ENCRYPTION_KEY</code> is missing or
            invalid in <code className="font-mono text-xs">apps/admin/.env.local</code> — secrets
            cannot be saved until it is set.
          </span>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {GROUPS.map((group) => (
            <Card key={group.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  {group.title}
                  <Badge variant="outline" className="ml-auto font-mono text-[10px]">
                    Phase {group.phase}
                  </Badge>
                </CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.fields.map((fieldDef) => {
                  const fieldStatus = status[fieldDef.name];
                  const isSet = fieldStatus?.isSet ?? false;
                  return (
                    <FormField
                      key={fieldDef.name}
                      control={form.control}
                      name={fieldDef.name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            {fieldDef.label}
                            {fieldDef.secret && isSet && (
                              <Badge variant="success" className="text-[10px]">
                                Saved ••••{fieldStatus?.last4}
                              </Badge>
                            )}
                          </FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                type={fieldDef.secret ? "password" : "text"}
                                autoComplete="off"
                                disabled={readOnly || isPending}
                                placeholder={
                                  fieldDef.placeholder ??
                                  (fieldDef.secret
                                    ? isSet
                                      ? "Enter a new value to replace"
                                      : "Not set"
                                    : "Not set")
                                }
                                {...field}
                              />
                            </FormControl>
                            {!readOnly && isSet && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={`Clear ${fieldDef.label}`}
                                disabled={isPending}
                                onClick={() => onClear(fieldDef.name as SettingKey)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {!readOnly && (
            <Button type="submit" disabled={isPending || !encryptionReady}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Save keys
            </Button>
          )}
        </form>
      </Form>

      <p className="text-xs text-muted-foreground">
        Secrets are encrypted with AES-256-GCM before they reach the database and are never sent
        back to the browser — only the last 4 characters are shown. Leave a field empty to keep its
        current value.
      </p>
    </div>
  );
}
