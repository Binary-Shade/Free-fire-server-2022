import React, { useMemo, useState } from 'react';
import { Map as MapIcon, RefreshCw, Swords } from 'lucide-react';
import { api, useRequest } from '../lib';
import {
  Badge,
  Button,
  Card,
  Empty,
  Notice,
  PageHeader,
  Segmented,
  Skeleton,
  StatTile,
  Switch,
  useToast,
} from '../components';

export default function GameModes() {
  const { toast } = useToast();
  const { data, setData, loading, error, reload } = useRequest(() => api('/game-modes'), []);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState('');

  const modes = data?.modes || [];
  const counts = useMemo(
    () => ({
      ready: modes.filter((mode) => mode.state === 'working').length,
      preview: modes.filter((mode) => mode.state !== 'working').length,
      disabled: modes.filter((mode) => !mode.enabled).length,
    }),
    [modes],
  );

  const visible = modes.filter((mode) => {
    if (filter === 'ready') return mode.state === 'working';
    if (filter === 'preview') return mode.state !== 'working';
    if (filter === 'disabled') return !mode.enabled;
    return true;
  });

  async function toggle(mode, enabled) {
    setSaving(mode.key);
    try {
      const result = await api(`/game-modes/${mode.key}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      setData((current) => ({
        ...current,
        modes: current.modes.map((item) => (item.key === mode.key ? result.mode : item)),
      }));
      toast(
        `${mode.label} ${enabled ? 'enabled' : 'disabled'}. New matchmaking requests use this setting immediately.`,
        { tone: enabled ? 'good' : 'info' },
      );
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setSaving('');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Gameplay"
        icon={MapIcon}
        title="Game modes"
        description="Publish or hide Classic, Ranked, Clash Squad, and Training from the client. Existing matches are allowed to finish."
        actions={
          <Button variant="secondary" onClick={() => reload()} busy={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && <Notice tone="bad" className="mb-5" message={error} />}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatTile label="Ready modes" value={counts.ready} hint="Complete server support" icon={Swords} tone="good" />
        <StatTile label="Preview modes" value={counts.preview} hint="Client UI, partial support" icon={MapIcon} tone="warn" />
        <StatTile label="Disabled" value={counts.disabled} hint="Hidden from matchmaking" icon={MapIcon} tone="neutral" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          label="Filter game modes"
          options={[
            { value: 'all', label: 'All', count: modes.length },
            { value: 'ready', label: 'Ready', count: counts.ready },
            { value: 'preview', label: 'Preview', count: counts.preview },
            { value: 'disabled', label: 'Disabled', count: counts.disabled },
          ]}
        />
        <p className="text-[11.5px] text-muted-foreground">
          Disabled modes are removed from discovery and rejected by matchmaking.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <Skeleton key={key} className="h-48" />
          ))}
        </div>
      ) : !visible.length ? (
        <Card>
          <Empty icon={MapIcon} title="No modes in this filter" description="Try another filter to see available modes." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((mode) => (
            <Card key={mode.key} className="group relative overflow-hidden p-5">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.1),transparent_70%)]"
                aria-hidden="true"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                    {mode.key}
                  </div>
                  <h3 className="mt-1 font-display text-[16px] font-semibold tracking-tight">{mode.label}</h3>
                </div>
                <Switch
                  checked={mode.enabled}
                  disabled={saving === mode.key}
                  onCheckedChange={(enabled) => toggle(mode, enabled)}
                  label={`Enable ${mode.label}`}
                />
              </div>

              <div className="relative mt-5 grid grid-cols-2 gap-2">
                {[
                  ['Map', mode.map_id],
                  ['Game mode', mode.game_mode],
                  ['Match mode', mode.match_mode],
                  ['Sort', mode.sort_id],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-background/40 px-2.5 py-1.5">
                    <div className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground">
                      {label}
                    </div>
                    <div className="mt-0.5 font-mono text-[11.5px] font-semibold tabular-nums">{value}</div>
                  </div>
                ))}
              </div>

              <div className="relative mt-4 flex flex-wrap items-center gap-2">
                <Badge tone={mode.enabled ? 'good' : 'neutral'} dot>
                  {mode.enabled ? 'Available' : 'Disabled'}
                </Badge>
                <Badge tone={mode.state === 'working' ? 'good' : 'warn'}>
                  {mode.state === 'working' ? 'Ready' : 'Preview'}
                </Badge>
                {mode.state !== 'working' && mode.enabled && (
                  <span className="text-[10.5px] text-muted-foreground">Partial server support</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
