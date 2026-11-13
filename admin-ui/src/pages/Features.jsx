import React, { useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, ToggleLeft, Wrench } from 'lucide-react';
import { api, useRequest } from '../lib';
import {
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Notice,
  PageHeader,
  Segmented,
  Skeleton,
  StatTile,
  Switch,
  useToast,
} from '../components';

export default function Features() {
  const { toast } = useToast();
  const { data, setData, loading, error, reload } = useRequest(() => api('/feature-switches'), []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState('');

  const switches = data?.switches || [];
  const counts = useMemo(
    () => ({
      ready: switches.filter((item) => item.state === 'working').length,
      planned: switches.filter((item) => item.state !== 'working').length,
      enabled: switches.filter((item) => item.enabled).length,
    }),
    [switches],
  );

  const visible = switches.filter((item) => {
    const query = search.trim().toLowerCase();
    const matches =
      !query ||
      item.label.toLowerCase().includes(query) ||
      item.key.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query);
    if (!matches) return false;
    if (filter === 'ready') return item.state === 'working';
    if (filter === 'planned') return item.state !== 'working';
    if (filter === 'enabled') return item.enabled;
    return true;
  });

  async function toggle(item, enabled) {
    setSaving(item.key);
    try {
      const result = await api(`/feature-switches/${item.key}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      setData((current) => ({
        ...current,
        switches: current.switches.map((entry) => (entry.key === item.key ? result.switch : entry)),
      }));
      toast(`${item.label} ${enabled ? 'enabled' : 'disabled'}.`, { tone: enabled ? 'good' : 'info' });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setSaving('');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        icon={ToggleLeft}
        title="Feature switches"
        description="Expose client menus only when their server support is complete. Planned switches stay disabled to prevent dead menus."
        actions={
          <Button variant="secondary" onClick={() => reload()} busy={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && <Notice tone="bad" className="mb-5" message={error} />}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatTile label="Ready" value={counts.ready} hint="Fully implemented" icon={ShieldCheck} tone="good" />
        <StatTile label="Planned" value={counts.planned} hint="Server work remaining" icon={Wrench} tone="warn" />
        <StatTile label="Enabled" value={counts.enabled} hint="Visible to clients" icon={ToggleLeft} />
      </div>

      <Notice
        tone="info"
        className="mb-4"
        message="Switches marked Planned cannot be enabled until the server implements their behavior. This prevents exposing an empty menu to players."
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search switches by name, key, or description"
            className="pl-9"
            aria-label="Search feature switches"
          />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          label="Filter feature switches"
          options={[
            { value: 'all', label: 'All', count: switches.length },
            { value: 'ready', label: 'Ready', count: counts.ready },
            { value: 'planned', label: 'Planned', count: counts.planned },
            { value: 'enabled', label: 'Enabled', count: counts.enabled },
          ]}
        />
      </div>

      <Card>
        {loading ? (
          <div className="p-5">
            <Skeleton className="h-80" />
          </div>
        ) : !visible.length ? (
          <Empty
            icon={ToggleLeft}
            title="No switches in this filter"
            description="Try another search or filter to see the rest of the switches."
          />
        ) : (
          <div className="divide-y divide-border">
            {visible.map((item) => (
              <div
                key={item.key}
                className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">#{item.id}</span>
                    <span className="text-[13px] font-semibold">{item.label}</span>
                    <Badge tone={item.state === 'working' ? 'good' : 'warn'}>
                      {item.state === 'working' ? 'Ready' : 'Planned'}
                    </Badge>
                    {item.enabled && <Badge tone="primary">Enabled</Badge>}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">{item.key}</div>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">{item.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                    {item.state === 'working' ? 'Operational' : 'Unavailable'}
                  </span>
                  <Switch
                    checked={item.enabled}
                    disabled={item.state !== 'working' || saving === item.key}
                    onCheckedChange={(enabled) => toggle(item, enabled)}
                    label={`Enable ${item.label}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
