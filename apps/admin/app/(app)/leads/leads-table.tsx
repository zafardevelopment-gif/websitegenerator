"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Eye,
  Globe,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { LeadRow } from "@aiwebsite/db/types";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@aiwebsite/ui";

import { LeadStatusBadge, PriorityBadge, RatingCell } from "@/components/lead-badges";
import { deleteLeadAction, restoreLeadAction, setLeadStatusAction } from "@/lib/actions/leads";
import { formatDate } from "@/lib/format";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, waLink } from "@/lib/lead-meta";

import { FollowUpDialog } from "./follow-up-dialog";

interface LeadsTableProps {
  rows: LeadRow[];
  count: number;
  page: number;
  pageCount: number;
  pageSize: number;
  trashView: boolean;
}

const VISIBILITY_KEY = "aiwebsite.leads.columns";

export function LeadsTable({ rows, count, page, pageCount, trashView }: LeadsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();
  const [followUpLead, setFollowUpLead] = React.useState<LeadRow | null>(null);

  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(VISIBILITY_KEY);
      if (raw) setColumnVisibility(JSON.parse(raw) as VisibilityState);
    } catch {
      // corrupted localStorage — fall back to defaults
    }
  }, []);
  React.useEffect(() => {
    window.localStorage.setItem(VISIBILITY_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  const currentSort = searchParams.get("sort") ?? "created_at";
  const currentDir = searchParams.get("dir") ?? "desc";

  const toggleSort = React.useCallback(
    (column: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (currentSort === column) {
        params.set("dir", currentDir === "asc" ? "desc" : "asc");
      } else {
        params.set("sort", column);
        params.set("dir", column === "business_name" ? "asc" : "desc");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, currentSort, currentDir]
  );

  const goToPage = React.useCallback(
    (target: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (target <= 1) params.delete("page");
      else params.set("page", String(target));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function sortHeader(label: string, column: string) {
    const active = currentSort === column;
    const Icon = !active ? ArrowUpDown : currentDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => toggleSort(column)}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    );
  }

  function runAction(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  const columns = React.useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        id: "business",
        header: () => sortHeader("Business", "business_name"),
        cell: ({ row }) => (
          <Link href={`/leads/${row.original.id}`} className="group block min-w-44">
            <span className="font-medium group-hover:text-primary group-hover:underline">
              {row.original.business_name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {[row.original.area, row.original.city].filter(Boolean).join(", ") || "—"}
            </span>
          </Link>
        ),
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">{row.original.category ?? "—"}</span>
        ),
      },
      {
        id: "rating",
        header: () => sortHeader("Rating", "google_rating"),
        cell: ({ row }) => (
          <RatingCell rating={row.original.google_rating} reviews={row.original.review_count} />
        ),
      },
      {
        id: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs">{row.original.phone ?? "—"}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <LeadStatusBadge status={row.original.status} />,
      },
      {
        id: "priority",
        header: "Priority",
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      },
      {
        id: "score",
        header: () => sortHeader("Score", "lead_score"),
        cell: ({ row }) => <span className="tabular-nums">{row.original.lead_score}</span>,
      },
      {
        id: "next_follow_up",
        header: () => sortHeader("Follow-up", "next_follow_up"),
        cell: ({ row }) => {
          const value = row.original.next_follow_up;
          const overdue = value !== null && new Date(value).getTime() < Date.now();
          return (
            <span className={overdue ? "font-medium text-destructive" : undefined}>
              {formatDate(value)}
            </span>
          );
        },
      },
      {
        id: "created_at",
        header: () => sortHeader("Created", "created_at"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatDate(row.original.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Actions for ${lead.business_name}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {trashView ? (
                  <DropdownMenuItem onSelect={() => runAction(() => restoreLeadAction(lead.id))}>
                    <RotateCcw />
                    Restore lead
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href={`/leads/${lead.id}`}>
                        <Eye />
                        View details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/leads/${lead.id}/edit`}>
                        <Pencil />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <span className="flex items-center gap-2">Change status</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                        {LEAD_STATUSES.map((status) => (
                          <DropdownMenuItem
                            key={status}
                            disabled={status === lead.status}
                            onSelect={() => runAction(() => setLeadStatusAction(lead.id, status))}
                          >
                            {LEAD_STATUS_LABELS[status]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem onSelect={() => setFollowUpLead(lead)}>
                      <CalendarPlus />
                      Add follow-up
                    </DropdownMenuItem>
                    {(lead.whatsapp ?? lead.phone) && (
                      <DropdownMenuItem asChild>
                        <a
                          href={waLink(lead.whatsapp ?? lead.phone ?? "")}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle />
                          Open WhatsApp chat
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href={`/generator/new?leadId=${lead.id}`}>
                        <Globe />
                        Generate website
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => runAction(() => deleteLeadAction(lead.id))}
                    >
                      <Trash2 />
                      Move to trash
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trashView, currentSort, currentDir, searchParams]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(!!v)}
                  className="capitalize"
                >
                  {column.id.replace(/_/g, " ")}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={table.getVisibleFlatColumns().length}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  {trashView
                    ? "Trash is empty."
                    : "No leads match. Create one or adjust the filters."}
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {pageCount} · {count} lead{count === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            <ChevronLeft />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => goToPage(page + 1)}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </div>

      <FollowUpDialog lead={followUpLead} onOpenChange={(open) => !open && setFollowUpLead(null)} />
    </div>
  );
}
