import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { api, number, useDebouncedValue, useRequest } from '../lib';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
  Skeleton,
  StatTile,
  Textarea,
  useToast,
} from '../components';

export default function Players() {
  const [params] = useSearchParams();
  const urlQuery = params.get('q') || '';
  const [search, setSearch] = useState(urlQuery);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [query, setQuery] = useState(urlQuery);
  const [sorting, setSorting] = useState([]);
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState('Dashboard action');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const debounced = useDebouncedValue(search, 280);

  useEffect(() => {
    setSearch(urlQuery);
    setPage(1);
  }, [urlQuery]);

  useEffect(() => {
    setPage(1);
    setQuery(debounced);
  }, [debounced]);

  const { data, loading, error, reload } = useRequest(
    () => api(`/status?page=${page}&pageSize=${size}&search=${encodeURIComponent(query)}`),
    [page, size, query],
  );

  const openModal = (player, action) => {
    setReason('Dashboard action');
    setModal({ ...player, action });
  };

  async function moderate() {
    if (!modal) return;
    setBusy(true);
    try {
      await api(`/players/${modal.uid}/${modal.action}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      toast(`${modal.action === 'ban' ? 'Ban' : 'Kick'} completed for ${modal.nickname}.`, { tone: 'good' });
      setModal(null);
      reload({ silent: true });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: 'nickname',
        header: 'Player',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-secondary font-mono text-[11px] font-semibold">
              {(row.original.nickname || 'P').slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{row.original.nickname || 'Unknown player'}</div>
              <div className="text-[11px] text-muted-foreground">Role {row.original.role || 'player'}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'uid',
        header: 'UID',
        cell: ({ getValue }) => <span className="font-mono text-[12px]">{getValue()}</span>,
      },
      {
        accessorKey: 'level',
        header: 'Level',
        cell: ({ getValue }) => <span className="tabular-nums">{getValue() || 0}</span>,
      },
      {
        accessorKey: 'node',
        header: 'Gateway',
        cell: ({ getValue }) => (
          <span className="font-mono text-[11px] text-muted-foreground">{getValue() || '—'}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: () => (
          <Badge tone="good" dot>
            Online
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => openModal(row.original, 'kick')}>
              Kick
            </Button>
            <Button size="sm" variant="dangerSoft" onClick={() => openModal(row.original, 'ban')}>
              Ban
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: data?.users || [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const total = data?.pagination?.total || 0;
  const currentPage = data?.pagination?.page || 1;
  const pages = data?.pagination?.pages || 1;

  return (
    <>
      <PageHeader
        eyebrow="Player operations"
        icon={Users}
        title="Players"
        description="Find connected accounts, review session details, and take moderation action with an audit reason."
        actions={
          <Button variant="secondary" onClick={() => reload()} busy={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && <Notice tone="bad" className="mb-5" message={error} />}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatTile label="Visible sessions" value={number(total)} hint="Matching the current search" icon={Users} />
        <StatTile
          label="Current page"
          value={`${currentPage} / ${pages}`}
          hint={`${size} players per page`}
          icon={ArrowDownUp}
          tone="neutral"
        />
        <StatTile
          label="Moderation"
          value={<span className="text-success">Ready</span>}
          hint="Kick and ban endpoints online"
          icon={ShieldCheck}
          tone="good"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search nickname or UID"
              className="pl-9"
              aria-label="Search players by nickname or UID"
            />
          </div>
          <Select
            className="sm:w-40"
            value={size}
            onChange={(event) => {
              setPage(1);
              setSize(Number(event.target.value));
            }}
            aria-label="Players per page"
          >
            {[10, 20, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value} per page
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="p-5">
            <Skeleton className="h-64" />
          </div>
        ) : !data?.users?.length ? (
          <Empty
            icon={Users}
            title="No matching players"
            description="Try another search or wait for a player to connect to the gateway."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[780px] text-left text-[13px]">
              <thead className="border-b border-border bg-background/30">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const sorted = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          aria-sort={
                            header.column.getCanSort()
                              ? sorted === 'asc'
                                ? 'ascending'
                                : sorted === 'desc'
                                  ? 'descending'
                                  : 'none'
                              : undefined
                          }
                          className="px-5 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1.5 transition hover:text-foreground"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <ArrowDownUp className={sorted ? 'h-3 w-3 text-primary' : 'h-3 w-3 opacity-50'} />
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-3.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3.5 text-[12px] text-muted-foreground sm:flex-row">
          <span>
            <span className="font-mono tabular-nums text-foreground">{number(total)}</span> players
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="iconSm"
              variant="secondary"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-1 font-mono text-[11px]">
              Page {currentPage} of {pages}
            </span>
            <Button
              size="iconSm"
              variant="secondary"
              aria-label="Next page"
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={!!modal}
        onOpenChange={(open) => !open && setModal(null)}
        tone={modal?.action === 'ban' ? 'danger' : 'primary'}
        title={`${modal?.action === 'ban' ? 'Ban' : 'Kick'} ${modal?.nickname || 'player'}?`}
        description={
          modal?.action === 'ban'
            ? 'The account will be blocked and disconnected immediately. The reason is stored with the moderation action.'
            : 'The player will be disconnected but can sign in again. The reason is stored with the moderation action.'
        }
        confirmLabel={modal?.action === 'ban' ? 'Ban player' : 'Kick player'}
        busy={busy}
        onConfirm={moderate}
      >
        <Field label="Reason" hint="This is stored with the moderation action.">
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </ConfirmDialog>
    </>
  );
}
