import { normalizeDeployConfig, SETTING_KEYS } from "@aiwebsite/config";
import { createServerSupabase } from "@aiwebsite/db/server";
import { getAgencyProfile, getJsonSetting } from "@aiwebsite/db/settings";
import { getUserProfile } from "@aiwebsite/db/users";

import { AgencyProfileForm } from "./agency-profile-form";
import { BackupExportCard } from "./backup-export-card";
import { DeployConfigForm } from "./deploy-config-form";

export default async function GeneralSettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getUserProfile(supabase, user.id) : null;
  const agency = await getAgencyProfile(supabase);
  const deployConfig = normalizeDeployConfig(
    await getJsonSetting(supabase, SETTING_KEYS.deployConfig)
  );
  const readOnly = profile?.role !== "owner";

  return (
    <div className="space-y-6">
      <AgencyProfileForm defaultValues={agency} readOnly={readOnly} />
      <DeployConfigForm config={deployConfig} readOnly={readOnly} />
      <BackupExportCard readOnly={readOnly} />
    </div>
  );
}
