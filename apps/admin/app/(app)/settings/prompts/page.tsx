import type { Metadata } from "next";

import { createServerSupabase } from "@aiwebsite/db/server";
import { listPromptTemplates } from "@aiwebsite/db/repositories/prompt-templates";

import { PromptsManager } from "./prompts-manager";

export const metadata: Metadata = {
  title: "Prompt Templates",
};

export default async function PromptsPage() {
  const supabase = await createServerSupabase();
  const prompts = await listPromptTemplates(supabase);

  return <PromptsManager prompts={prompts} />;
}
