import React, { useEffect, useState } from 'react';
import {
  Bot,
  BrickWall,
  Crosshair,
  HeartPulse,
  RefreshCw,
  Save,
  Shield,
  ShoppingCart,
  Swords,
} from 'lucide-react';
import { api, useRequest } from '../lib';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Notice,
  PageHeader,
  Segmented,
  Skeleton,
  SwitchRow,
  useToast,
} from '../components';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy', copy: 'Relaxed reaction time and accuracy.' },
  { value: 'normal', label: 'Normal', copy: 'Balanced pressure for everyday matches.' },
  { value: 'hard', label: 'Hard', copy: 'Competitive aim and faster decisions.' },
];

const ABILITIES = [
  { key: 'purchasing', label: 'Buy weapons', hint: 'Bots select and purchase weapons between rounds.', icon: ShoppingCart },
  { key: 'cover', label: 'Take cover', hint: 'Bots seek nearby protection when under fire.', icon: Shield },
  { key: 'reviving', label: 'Revive teammates', hint: 'Bots help knocked team members.', icon: HeartPulse },
  { key: 'gloo', label: 'Use gloo walls', hint: 'Bots deploy defensive gloo walls.', icon: BrickWall },
];

export default function Bots() {
  const { toast } = useToast();
  const { data, setData, loading, error, reload } = useRequest(() => api('/bots'), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);

  async function save() {
    setBusy(true);
    try {
      const result = await api('/bots', { method: 'PUT', body: JSON.stringify(form) });
      setForm(result.settings);
      setData((current) => ({ ...current, settings: result.settings }));
      toast('Bot behavior saved for new matches.', { tone: 'good' });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  if (loading || (!form && !error)) {
    return (
      <>
        <PageHeader eyebrow="Gameplay" icon={Bot} title="Bot configuration" description="Loading bot settings…" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Gameplay"
        icon={Bot}
        title="Bot configuration"
        description="Tune practice opponents, difficulty, and individual behaviors without touching server files."
        actions={
          <>
            <Button variant="secondary" onClick={() => reload()} busy={loading}>
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
            <Button busy={busy} disabled={!form} onClick={save}>
              <Save className="h-4 w-4" />
              Save bot settings
            </Button>
          </>
        }
      />

      {error && <Notice tone="bad" className="mb-5" message={error} />}

      {form && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              eyebrow="Match setup"
              title="Opponent line-up"
              description="Controls the number of bots and the overall challenge."
              action={<Swords className="h-5 w-5 text-primary" />}
            />
            <div className="grid gap-5 p-5">
              <div>
                <div className="mb-2 text-[13px] font-medium text-secondary-foreground">Opponent bots</div>
                <Segmented
                  value={form.opponents}
                  onChange={(value) => setForm({ ...form, opponents: value })}
                  label="Opponent bot count"
                  options={[1, 2, 3, 4].map((value) => ({
                    value,
                    label: `${value} bot${value === 1 ? '' : 's'}`,
                  }))}
                  className="w-full justify-between sm:w-auto"
                />
                <p className="mt-2 text-[11.5px] text-muted-foreground">One to four opponents per practice match.</p>
              </div>

              <div>
                <div className="mb-2 text-[13px] font-medium text-secondary-foreground">Difficulty</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {DIFFICULTIES.map((option) => {
                    const selected = form.difficulty === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setForm({ ...form, difficulty: option.value })}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          selected
                            ? 'border-primary/50 bg-primary/10 text-foreground'
                            : 'border-border bg-background/40 text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="text-[12.5px] font-semibold">{option.label}</span>
                          {selected && <Badge tone="primary">Selected</Badge>}
                        </span>
                        <span className="mt-1 block text-[11px] leading-4 opacity-80">{option.copy}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {data?.geometry?.available ? (
                <Notice
                  tone="good"
                  message={`${data.geometry.map}: ${data.geometry.colliders} navigation colliders loaded.`}
                />
              ) : (
                <Notice
                  tone="bad"
                  message="Navigation geometry is unavailable. Bots may move less accurately."
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Behaviors"
              title="Bot abilities"
              description="Enable individual behaviors for easier testing and tuning."
              action={<Crosshair className="h-5 w-5 text-primary" />}
            />
            <div className="divide-y divide-border px-5">
              {ABILITIES.map(({ key, label, hint, icon: Icon }) => (
                <SwitchRow
                  key={key}
                  checked={Boolean(form[key])}
                  onCheckedChange={(value) => setForm({ ...form, [key]: value })}
                  label={
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {label}
                    </span>
                  }
                  description={hint}
                />
              ))}
            </div>
            <div className="border-t border-border p-5">
              <div className="rounded-xl border border-border bg-background/40 p-3.5">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Current profile
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px]">
                  <Badge tone="primary">{form.opponents} opponents</Badge>
                  <Badge tone={form.difficulty === 'hard' ? 'warn' : 'good'} className="capitalize">
                    {form.difficulty}
                  </Badge>
                  <Badge tone="neutral">
                    {ABILITIES.filter((ability) => form[ability.key]).length} / {ABILITIES.length} abilities
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
