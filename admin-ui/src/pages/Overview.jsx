import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Gamepad2,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Timer,
  Users,
  Wifi,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, clock, number } from '../lib';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Empty,
  Notice,
  PageHeader,
  ProgressBar,
  Skeleton,
  Sparkline,
  StatTile,
  StatusDot,
} from '../components';

const EMBER = 'hsl(20, 100%, 60%)';
const JADE = 'hsl(156, 60%, 46%)';
const AMBER = 'hsl(38, 92%, 58%)';
const STEEL = 'hsl(220, 12%, 62%)';
const GRID = 'hsl(30, 8%, 17%)';
const AXIS = 'hsl(30, 8%, 58%)';
const MIX = [EMBER, JADE, AMBER, STEEL];

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((item) => (
        <div className="chart-tooltip-row" key={item.dataKey}>
          <i style={{ background: item.color }} />
          <span>{item.name}</span>
          <b>{number(item.value)}</b>
        </div>
      ))}
    </div>
  );
}

function StatusRow({ name, ok, detail, icon: Icon = Server }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <StatusDot tone={ok ? 'good' : 'bad'} pulse={ok} />
      <span className="grid h-8 w-8 place-items-center rounded-md border border-border bg-muted/60 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold">{name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{detail || 'No telemetry received'}</div>
      </div>
      <Badge tone={ok ? 'good' : 'bad'}>{ok ? 'Healthy' : 'Offline'}</Badge>
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const next = await api('/status?page=1&pageSize=8');
      setData(next);
      setError('');
      const stats = next.stats || {};
      setHistory((rows) =>
        [
          ...rows,
          {
            time: clock(Date.now()),
            online: Number(stats.online) || 0,
            inGame: Number(stats.inGame) || 0,
            queue: Number(stats.queue) || 0,
          },
        ].slice(-24),
      );
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const stats = data?.stats || {};
  const mix = useMemo(
    () =>
      [
        { name: 'In match', value: Number(stats.inGame) || 0 },
        { name: 'Training', value: Number(stats.trainingPlayers) || 0 },
        { name: 'Clash Squad', value: Number(stats.clashSquadPlayers) || 0 },
        { name: 'Queued', value: Number(stats.queue) || 0 },
      ].filter((item) => item.value > 0),
    [stats.inGame, stats.trainingPlayers, stats.clashSquadPlayers, stats.queue],
  );

  const workload = [
    { label: 'Online', value: Number(stats.online) || 0, tone: 'primary' },
    { label: 'In game', value: Number(stats.inGame) || 0, tone: 'good' },
    { label: 'Queue', value: Number(stats.queue) || 0, tone: 'warn' },
    { label: 'Matches', value: Number(stats.activeMatches) || 0, tone: 'primary' },
  ];
  const peak = Math.max(...workload.map((item) => item.value), 1);
  const online = history.map((point) => point.online);
  const inGame = history.map((point) => point.inGame);
  const matches = history.map((point) => point.queue);

  return (
    <>
      <PageHeader
        eyebrow="Live operations"
        icon={Activity}
        title="Command center"
        description="A real-time view of connected players, active matches, and the services behind them. Telemetry refreshes every 15 seconds."
        actions={
          <>
            <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground sm:flex">
              <StatusDot tone="good" pulse />
              Updated {clock(data?.generatedAt || Date.now())}
            </span>
            <Button variant="secondary" onClick={() => load()} busy={refreshing}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <Notice
          tone="bad"
          className="mb-5"
          message={`Unable to refresh live telemetry: ${error}`}
          action={
            <button type="button" onClick={() => load()} className="text-[12px] font-semibold underline">
              Retry
            </button>
          }
        />
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-[8.75rem]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Online players"
            value={number(stats.online)}
            hint="Connected to the gateway"
            icon={Users}
            tone="good"
          >
            <Sparkline values={online} tone="jade" />
          </StatTile>
          <StatTile
            label="Players in game"
            value={number(stats.inGame)}
            hint={`${number(stats.trainingPlayers)} training · ${number(stats.clashSquadPlayers)} Clash Squad`}
            icon={Gamepad2}
            tone="primary"
          >
            <Sparkline values={inGame} />
          </StatTile>
          <StatTile
            label="Active matches"
            value={number(stats.activeMatches)}
            hint="Across every match node"
            icon={Activity}
            tone="warn"
          >
            <Sparkline values={matches} tone="amber" />
          </StatTile>
          <StatTile
            label="Matchmaking queue"
            value={number(stats.queue)}
            hint="Waiting for allocation"
            icon={Timer}
            tone="neutral"
          >
            <Sparkline values={matches} tone="ember" className="opacity-60" />
          </StatTile>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            eyebrow="Activity"
            title="Live player traffic"
            description="Gateway sessions and in-match population sampled every 15 seconds."
            action={
              <Badge tone="good">
                <Radio className="h-3 w-3" />
                15s refresh
              </Badge>
            }
          />
          <div className="h-[270px] p-4 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="overviewOnline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EMBER} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={EMBER} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="overviewGame" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={JADE} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={JADE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: AXIS, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: AXIS, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTip />} cursor={{ stroke: GRID }} />
                <Area
                  type="monotone"
                  dataKey="online"
                  name="Online"
                  stroke={EMBER}
                  strokeWidth={2.2}
                  fill="url(#overviewOnline)"
                />
                <Area
                  type="monotone"
                  dataKey="inGame"
                  name="In game"
                  stroke={JADE}
                  strokeWidth={1.8}
                  fill="url(#overviewGame)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Distribution" title="Session mix" description="Where connected players spend their time." />
          <div className="p-5">
            <div className="relative mx-auto h-[190px] max-w-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mix.length ? mix : [{ name: 'Idle', value: 1 }]}
                    dataKey="value"
                    innerRadius={58}
                    outerRadius={80}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {(mix.length ? mix : [{ name: 'Idle', value: 1 }]).map((entry, index) => (
                      <Cell key={entry.name} fill={mix.length ? MIX[index % MIX.length] : GRID} />
                    ))}
                  </Pie>
                  {mix.length ? <Tooltip content={<ChartTip />} /> : null}
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="font-display text-2xl font-semibold tabular-nums">{number(stats.online)}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">online</div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {mix.length ? (
                mix.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2 text-[12px]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: MIX[index % MIX.length] }}
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="ml-auto font-mono text-[11px] font-semibold tabular-nums">
                      {number(item.value)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-[12px] text-muted-foreground">No active sessions.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            eyebrow="Players"
            title="Online now"
            description="Recently connected accounts, newest first."
            action={
              <NavLink
                to="/players"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary transition hover:text-primary/80"
              >
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </NavLink>
            }
          />
          {data?.users?.length ? (
            <div className="divide-y divide-border">
              {data.users.map((player) => (
                <div key={player.uid} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-secondary font-mono text-[11px] font-semibold">
                    {(player.nickname || 'P').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{player.nickname || 'Unknown player'}</div>
                    <div className="truncate font-mono text-[10.5px] text-muted-foreground">
                      UID {player.uid} · Lv {player.level || 0}
                    </div>
                  </div>
                  <span className="hidden items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1 font-mono text-[10px] text-muted-foreground sm:flex">
                    <Wifi className="h-3 w-3" />
                    {player.node || 'gateway'}
                  </span>
                  <Badge tone="good" dot>
                    Online
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={Users}
              title="No players online"
              description="Connected players will appear here automatically."
            />
          )}
        </Card>

        <Card>
          <CardHeader
            eyebrow="System"
            title="Infrastructure"
            description="Services reporting to the control plane."
            action={<ShieldCheck className="h-5 w-5 text-success" />}
          />
          <div className="grid gap-2 p-4">
            <StatusRow name="Redis event bus" ok={stats.redis} detail="Queue and presence transport" icon={Server} />
            <StatusRow name="PostgreSQL" ok={stats.postgres} detail="Persistent player storage" icon={Server} />
            {stats.matchTelemetry?.map((node) => (
              <StatusRow
                key={node.node}
                name={node.node}
                ok
                detail={`${number(node.players)} players · ${number(node.matches)} matches`}
                icon={Radio}
              />
            ))}
            {!stats.matchTelemetry?.length && (
              <p className="px-1 py-2 text-[12px] text-muted-foreground">No match nodes are reporting.</p>
            )}
          </div>
          <div className="border-t border-border p-4">
            <div className="mb-3 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>Workload</span>
              <span>live</span>
            </div>
            <div className="grid gap-3">
              {workload.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono tabular-nums">{number(item.value)}</span>
                  </div>
                  <ProgressBar value={(item.value / peak) * 100} tone={item.tone} />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
