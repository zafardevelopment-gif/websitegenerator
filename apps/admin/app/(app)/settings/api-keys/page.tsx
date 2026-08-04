import type { Metadata } from "next";

import { SECRET_SETTING_KEYS, SETTING_KEYS } from "@aiwebsite/config";
import { isEncryptionConfigured } from "@aiwebsite/db/crypto";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getSettingsStatus } from "@aiwebsite/db/settings";
import { getUserProfile } from "@aiwebsite/db/users";

import { ApiKeysForm } from "./api-keys-form";

export const metadata: Metadata = {
  title: "API Keys",
};

export default async function ApiKeysPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getUserProfile(supabase, user.id) : null;

  const status = await getSettingsStatus(supabase, [
    ...SECRET_SETTING_KEYS,
    SETTING_KEYS.openaiCompatBaseUrl,
    SETTING_KEYS.cloudinaryCloudName,
    SETTING_KEYS.razorpayKeyId,
    SETTING_KEYS.googlePlacesApiKey,
  ]);

  return (
    <ApiKeysForm
      status={status}
      readOnly={profile?.role !== "owner"}
      encryptionReady={isEncryptionConfigured()}
    />
  );
}
