"use client";

/**
 * DM Logs Page
 *
 * Filterable, paginated table of DM logs.
 */

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import StatusBadge from "@/components/status-badge";

interface DmLog {
  id: string;
  commenterId: string;
  commenterName: string | null;
  commentText: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  automation: { name: string; keywords: string[] };
  instagramAccount: { username: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_FILTERS = [
  "ALL",
  "SENT",
  "FAILED",
  "PENDING",
  "SKIPPED_RATE_LIMIT",
  "SKIPPED_PLAN_LIMIT",
  "SKIPPED_DEDUP",
  "SKIPPED_NO_MATCH",
  "SKIPPED_DM_DISABLED",
];

export default function LogsPage() {
  return (
    <Suspense fallback={null}>
      <LogsPageInner />
    </Suspense>
  );
}

function LogsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [logs, setLogs] = useState<DmLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  // Seeded from the URL so a link from the dashboard/automation page (e.g.
  // "?status=SKIPPED_DM_DISABLED&automationId=...") lands already filtered.
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") ?? "ALL"
  );
  const [automationFilter, setAutomationFilter] = useState(
    () => searchParams.get("automationId")
  );
  const [automationName, setAutomationName] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (selectedAccountId !== "all") {
        params.set("instagramAccountId", selectedAccountId);
      }
      if (automationFilter) params.set("automationId", automationFilter);

      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.logs);
        setPagination(data.data.pagination);
        if (automationFilter && data.data.logs[0]) {
          setAutomationName(data.data.logs[0].automation.name);
        }
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, selectedAccountId, automationFilter]);

  function clearAutomationFilter() {
    setAutomationFilter(null);
    setAutomationName(null);
    setPage(1);
    router.replace("/logs");
  }

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setAccounts(payload.data.instagramAccounts ?? []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLogs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchLogs]);

  function handleFilterChange(status: string) {
    setLoading(true);
    setStatusFilter(status);
    setPage(1);
  }

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {automationFilter && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-sm">
          <span className="text-foreground">
            Filtered to automation: <strong>{automationName ?? automationFilter}</strong>
          </span>
          <button
            onClick={clearAutomationFilter}
            className="ml-auto text-xs font-medium text-accent hover:underline"
          >
            Clear
          </button>
        </div>
      )}
      {/* Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${
                  statusFilter === status
                    ? "bg-accent/15 text-accent border border-accent/20"
                    : "bg-surface text-muted border border-border hover:border-border-hover hover:text-foreground"
                }
              `}
            >
              {status === "ALL" ? "All" : status.replace("SKIPPED_", "").replace("_", " ")}
            </button>
          ))}
        </div>
        {accounts.length > 1 && (
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={handleAccountChange}
          />
        )}
      </div>

      {/* Table */}
      <div className="panel rounded-xl overflow-hidden">
        {/* Six columns don't fit a phone; the table keeps its width and scrolls
            horizontally inside the panel rather than crushing every cell. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Commenter</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Comment</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Automation</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Account</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Status</th>
                <th className="px-4 py-4 text-xs font-semibold text-muted uppercase tracking-wider sm:px-6">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-4 sm:px-6">
                        <div className="h-4 bg-surface-hover rounded-xl" />
                      </td>
                    </tr>
                  ))}
                </>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted sm:px-6">
                    No logs found
                  </td>
                </tr>
              )}
              {!loading &&
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-hover/50 transition-colors">
                    <td className="px-4 py-4 sm:px-6">
                      <span className="font-medium text-foreground">
                        @{log.commenterName ?? log.commenterId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-4 max-w-[200px] sm:px-6">
                      <span className="text-muted truncate block">{log.commentText}</span>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <span className="text-muted">{log.automation.name}</span>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <span className="text-muted">@{log.instagramAccount.username}</span>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-4 text-muted whitespace-nowrap sm:px-6">
                      {new Date(log.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-t border-border sm:px-6">
            <p className="text-xs text-muted">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage(page - 1);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:text-foreground hover:border-border-hover transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                Previous
              </button>
              <span className="text-xs text-muted px-2">
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage(page + 1);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:text-foreground hover:border-border-hover transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
