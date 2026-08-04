import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createServerSupabase } from "@aiwebsite/db/server";
import { getSite } from "@aiwebsite/db/repositories/sites";
import { getSiteVersion, listSiteVersions } from "@aiwebsite/db/repositories/site-versions";
import {
  buildFallbackContent,
  FONT_FAMILIES,
  getTemplate,
  parseSiteContent,
} from "@aiwebsite/templates";

import { SiteEditor, type EditorTemplateMeta, type EditorVersion } from "./editor";

export const metadata: Metadata = {
  title: "Site editor",
};

export default async function SiteEditorPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const supabase = await createServerSupabase();
  const site = await getSite(supabase, siteId);
  if (!site || site.deleted_at) notFound();

  // Template key via DB row → registry definition.
  let templateKey: string | null = null;
  if (site.template_id) {
    const { data } = await supabase
      .from("aiwebsite_templates")
      .select("key")
      .eq("id", site.template_id)
      .maybeSingle();
    templateKey = data?.key ?? null;
  }
  const templateDef = getTemplate(templateKey);

  const versions = await listSiteVersions(supabase, site.id);
  const currentVersion = site.current_version_id
    ? await getSiteVersion(supabase, site.current_version_id)
    : (versions[0] ?? null);

  const content =
    parseSiteContent(currentVersion?.site_content) ??
    buildFallbackContent({ businessName: site.name });

  const template: EditorTemplateMeta = {
    key: templateDef.key,
    name: templateDef.name,
    colorVariants: templateDef.colorVariants.map((v) => ({
      key: v.key,
      label: v.label,
      primary: v.primary,
    })),
    layoutVariants: templateDef.layoutVariants.map((v) => ({ key: v.key, label: v.label })),
    fonts: Object.keys(FONT_FAMILIES),
  };

  const branding =
    typeof site.branding === "object" && site.branding !== null && !Array.isArray(site.branding)
      ? (Object.fromEntries(
          Object.entries(site.branding).filter(([, v]) => typeof v === "string")
        ) as Record<string, string>)
      : {};

  const editorVersions: EditorVersion[] = versions.slice(0, 20).map((v) => ({
    id: v.id,
    version_no: v.version_no,
    change_summary: v.change_summary,
    created_at: v.created_at,
    site_content: v.site_content,
  }));

  return (
    <SiteEditor
      site={{
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
        colorVariant: site.color_variant,
        layoutVariant: site.layout_variant,
        branding,
        tone: "premium",
      }}
      template={template}
      initialContent={content}
      versions={editorVersions}
      currentVersionId={site.current_version_id ?? currentVersion?.id ?? null}
      sitesUrl={process.env.NEXT_PUBLIC_SITES_URL ?? "http://localhost:3001"}
    />
  );
}
