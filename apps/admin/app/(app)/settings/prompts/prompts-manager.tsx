"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, History, Loader2, Pencil, Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { BUSINESS_CATEGORIES } from "@aiwebsite/config";
import type { PromptTemplateRow } from "@aiwebsite/db/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  Textarea,
} from "@aiwebsite/ui";

import { savePromptVersionAction } from "@/lib/actions/ai";
import { formatDateTime } from "@/lib/format";

interface PromptGroup {
  key: string;
  active: PromptTemplateRow | null;
  versions: PromptTemplateRow[];
}

const TONES = ["premium", "friendly", "medical-professional", "luxury"];

function groupPrompts(prompts: PromptTemplateRow[]): PromptGroup[] {
  const byKey = new Map<string, PromptTemplateRow[]>();
  for (const prompt of prompts) {
    const list = byKey.get(prompt.key) ?? [];
    list.push(prompt);
    byKey.set(prompt.key, list);
  }
  return Array.from(byKey.entries()).map(([key, versions]) => ({
    key,
    active: versions.find((v) => v.is_active) ?? null,
    versions: versions.sort((a, b) => b.version - a.version),
  }));
}

interface EditorState {
  key: string;
  name: string;
  category: string;
  tone: string;
  system_prompt: string;
  user_prompt: string;
}

const EMPTY_EDITOR: EditorState = {
  key: "",
  name: "",
  category: "",
  tone: "premium",
  system_prompt: "",
  user_prompt: "",
};

export function PromptsManager({ prompts }: { prompts: PromptTemplateRow[] }) {
  const router = useRouter();
  const groups = React.useMemo(() => groupPrompts(prompts), [prompts]);
  const [editor, setEditor] = React.useState<EditorState | null>(null);
  const [isNewKey, setIsNewKey] = React.useState(false);
  const [historyKey, setHistoryKey] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const historyGroup = groups.find((g) => g.key === historyKey) ?? null;

  function openEdit(group: PromptGroup) {
    const source = group.active ?? group.versions[0];
    if (!source) return;
    setIsNewKey(false);
    setEditor({
      key: source.key,
      name: source.name,
      category: source.category ?? "",
      tone: source.tone ?? "premium",
      system_prompt: source.system_prompt,
      user_prompt: source.user_prompt ?? "",
    });
  }

  function restoreVersion(version: PromptTemplateRow) {
    setHistoryKey(null);
    setIsNewKey(false);
    setEditor({
      key: version.key,
      name: version.name,
      category: version.category ?? "",
      tone: version.tone ?? "premium",
      system_prompt: version.system_prompt,
      user_prompt: version.user_prompt ?? "",
    });
    toast.info(`Loaded v${version.version} — save to make it the new active version.`);
  }

  function save() {
    if (!editor) return;
    startTransition(async () => {
      const result = await savePromptVersionAction(editor);
      if (result.ok) {
        toast.success(result.message);
        setEditor(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          System prompts used by the AI engine, per category. Every save creates a new version and
          deactivates the old one — tune output without redeploying, roll back any time.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setIsNewKey(true);
            setEditor({ ...EMPTY_EDITOR });
          }}
        >
          <Plus />
          New prompt
        </Button>
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No prompt templates yet. Run <code className="font-mono text-xs">supabase/seed/seed.sql</code>{" "}
            for strong defaults, or create one.
          </CardContent>
        </Card>
      )}

      {groups.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <code className="font-mono text-sm">{group.key}</code>
              {group.active ? (
                <Badge variant="success">v{group.active.version} active</Badge>
              ) : (
                <Badge variant="destructive">no active version</Badge>
              )}
              {group.active?.category && <Badge variant="secondary">{group.active.category}</Badge>}
              {group.active?.tone && <Badge variant="outline">{group.active.tone}</Badge>}
              <span className="ml-auto flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setHistoryKey(group.key)}>
                  <History />
                  {group.versions.length} version{group.versions.length === 1 ? "" : "s"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(group)}>
                  <Pencil />
                  Edit
                </Button>
              </span>
            </CardTitle>
            <CardDescription>{group.active?.name ?? group.versions[0]?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="line-clamp-3 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
              {group.active?.system_prompt ?? group.versions[0]?.system_prompt}
            </p>
          </CardContent>
        </Card>
      ))}

      {/* Editor dialog */}
      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNewKey ? "New prompt template" : `Edit ${editor?.key}`}</DialogTitle>
            <DialogDescription>Saving creates a new active version.</DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-key">Key</Label>
                  <Input
                    id="p-key"
                    value={editor.key}
                    disabled={!isNewKey}
                    placeholder="site_content_dental"
                    onChange={(e) => setEditor((s) => s && { ...s, key: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-name">Name</Label>
                  <Input
                    id="p-name"
                    value={editor.name}
                    onChange={(e) => setEditor((s) => s && { ...s, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-category">Category (optional)</Label>
                  <NativeSelect
                    id="p-category"
                    value={editor.category}
                    onChange={(e) => setEditor((s) => s && { ...s, category: e.target.value })}
                  >
                    <option value="">Any category</option>
                    {BUSINESS_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-tone">Default tone</Label>
                  <NativeSelect
                    id="p-tone"
                    value={editor.tone}
                    onChange={(e) => setEditor((s) => s && { ...s, tone: e.target.value })}
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-system">System prompt</Label>
                <Textarea
                  id="p-system"
                  rows={10}
                  className="font-mono text-xs"
                  value={editor.system_prompt}
                  onChange={(e) => setEditor((s) => s && { ...s, system_prompt: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-user">Extra user-prompt instructions (optional)</Label>
                <Textarea
                  id="p-user"
                  rows={4}
                  className="font-mono text-xs"
                  value={editor.user_prompt}
                  onChange={(e) => setEditor((s) => s && { ...s, user_prompt: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditor(null)} disabled={isPending}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={isPending}>
                  {isPending ? <Loader2 className="animate-spin" /> : <Save />}
                  Save as new version
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={historyGroup !== null} onOpenChange={(open) => !open && setHistoryKey(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Versions of {historyGroup?.key}</DialogTitle>
            <DialogDescription>
              Restoring loads an old version into the editor; saving it creates a new version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {historyGroup?.versions.map((version) => (
              <div key={version.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant={version.is_active ? "success" : "outline"}>
                    v{version.version}
                    {version.is_active && " · active"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(version.created_at)}
                  </span>
                  {!version.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => restoreVersion(version)}
                    >
                      <RotateCcw />
                      Restore
                    </Button>
                  )}
                </div>
                <p className="line-clamp-4 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                  {version.system_prompt}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
