import React, { useMemo, useState } from 'react';
import { RefreshCw, Search, Sparkles, UserRound, Users } from 'lucide-react';
import { api, useRequest } from '../lib';
import {
  Avatar,
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

export default function Characters() {
  const { toast } = useToast();
  const { data, setData, loading, error, reload } = useRequest(() => api('/characters'), []);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(0);

  const characters = data?.characters || [];
  const counts = useMemo(
    () => ({
      available: characters.filter((character) => character.enabled).length,
      locked: characters.filter((character) => !character.enabled).length,
      awakened: characters.filter((character) => character.variant === 'awakened').length,
    }),
    [characters],
  );

  const visible = characters.filter((character) => {
    const query = search.trim().toLowerCase();
    const matches =
      !query || character.name.toLowerCase().includes(query) || String(character.id).includes(query);
    if (!matches) return false;
    if (filter === 'available') return character.enabled;
    if (filter === 'locked') return !character.enabled;
    if (filter === 'awakened') return character.variant === 'awakened';
    return true;
  });

  async function toggle(character, enabled) {
    setSaving(character.id);
    try {
      const result = await api(`/characters/${character.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      setData((current) => ({
        ...current,
        characters: current.characters.map((item) =>
          item.id === character.id ? { ...item, ...result.character } : item,
        ),
      }));
      toast(`${character.name} is now ${enabled ? 'available' : 'locked'}.`, {
        tone: enabled ? 'good' : 'info',
      });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setSaving(0);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Roster"
        icon={UserRound}
        title="Characters"
        description="Lock or unlock characters for every player. At least one character must remain enabled."
        actions={
          <Button variant="secondary" onClick={() => reload()} busy={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error && <Notice tone="bad" className="mb-5" message={error} />}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Roster size" value={characters.length} hint="Characters known to the client" icon={Users} />
        <StatTile label="Available" value={counts.available} hint="Unlocked for players" icon={UserRound} tone="good" />
        <StatTile label="Locked" value={counts.locked} hint="Hidden from the roster" icon={UserRound} tone="neutral" />
        <StatTile label="Awakened" value={counts.awakened} hint="Awakened variants" icon={Sparkles} tone="warn" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search characters by name or ID"
            className="pl-9"
            aria-label="Search characters"
          />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          label="Filter characters"
          options={[
            { value: 'all', label: 'All', count: characters.length },
            { value: 'available', label: 'Available', count: counts.available },
            { value: 'locked', label: 'Locked', count: counts.locked },
            { value: 'awakened', label: 'Awakened', count: counts.awakened },
          ]}
        />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((key) => (
            <Skeleton key={key} className="h-[4.75rem]" />
          ))}
        </div>
      ) : !visible.length ? (
        <Card>
          <Empty
            icon={UserRound}
            title="No matching characters"
            description="Try another search or filter to see the rest of the roster."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((character) => (
            <Card key={character.id} className="flex items-center gap-3.5 p-3.5">
              <Avatar name={character.name} src={character.imageUrl} size="lg" className="rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{character.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">{character.id}</span>
                  {character.variant === 'awakened' && <Badge tone="warn">Awakened</Badge>}
                  {!character.enabled && <Badge tone="neutral">Locked</Badge>}
                </div>
              </div>
              <Switch
                checked={character.enabled}
                disabled={saving === character.id}
                onCheckedChange={(enabled) => toggle(character, enabled)}
                label={`Enable ${character.name}`}
              />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
