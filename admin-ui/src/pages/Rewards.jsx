import React, { useEffect, useState } from 'react';
import { Gift, Inbox, Mail, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import { api, useRequest } from '../lib';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Notice,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from '../components';
import ItemPicker from '../ItemPicker';

const AWARD_LABELS = {
  item: 'Inventory item',
  coins: 'Coins',
  gems: 'Diamonds',
  exp: 'Experience',
  activeness: 'Activeness',
  accelerators: 'Accelerators',
};

function newAward() {
  return { type: 'coins', itemId: 0, amount: 500 };
}

function ServerGrants() {
  const { toast } = useToast();
  const [target, setTarget] = useState('player');
  const [uid, setUid] = useState('');
  const [kind, setKind] = useState('item');
  const [amount, setAmount] = useState(1);
  const [itemId, setItemId] = useState(0);
  const [grantId, setGrantId] = useState('');
  const [title, setTitle] = useState('A reward from the server');
  const [message, setMessage] = useState('Thanks for playing. Claim your attached reward!');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rewardLabel =
    kind === 'item'
      ? itemId
        ? `Item #${itemId} × ${amount || 0}`
        : 'Choose an inventory item'
      : `${kind === 'gems' ? 'Diamonds' : 'Coins'} × ${amount || 0}`;

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const destination = target === 'all' ? 'all' : uid.trim();
      if (!destination) throw new Error('Enter a player UID.');
      const body = { kind, amount: Number(amount), title, message };
      if (kind === 'item') {
        if (!itemId) throw new Error('Choose an inventory item.');
        body.itemId = Number(itemId);
      }
      if (grantId.trim()) body.grantId = grantId.trim();
      const result = await api(`/grants/${destination}`, { method: 'POST', body: JSON.stringify(body) });
      toast(
        `Inbox reward ${result.grantId} sent to ${result.applied} player${result.applied === 1 ? '' : 's'}${
          result.skipped ? `; ${result.skipped} already received it` : ''
        }.`,
        { tone: 'good', title: 'Reward delivered' },
      );
      setGrantId('');
    } catch (cause) {
      setError(cause.message);
      toast(cause.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card>
        <CardHeader
          eyebrow="Inbox delivery"
          title="Send an inbox reward"
          description="The reward enters the player's inventory only after they claim the message."
          action={
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </span>
          }
        />
        <form className="grid gap-5 p-5" onSubmit={send}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reward type">
              <Select value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="item">Inventory item</option>
                <option value="gems">Diamonds</option>
                <option value="coins">Coins</option>
              </Select>
            </Field>
            <Field label="Amount" hint="1 to 100,000,000">
              <Input
                type="number"
                min="1"
                max="100000000"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </Field>
          </div>

          {kind === 'item' && (
            <Field label="Inventory item" hint="Searchable catalog with names, images, types, rarity, and IDs.">
              <ItemPicker value={itemId} onChange={setItemId} />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipients">
              <Select value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="player">One player UID</option>
                <option value="all">All registered players</option>
              </Select>
            </Field>
            {target === 'player' && (
              <Field label="Player UID">
                <Input
                  inputMode="numeric"
                  value={uid}
                  onChange={(event) => setUid(event.target.value)}
                  placeholder="10000001"
                  required
                />
              </Field>
            )}
          </div>

          <Field label="Inbox title" hint="Up to 120 characters">
            <Input maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} required />
          </Field>
          <Field label="Inbox message" hint="Shown in the player's mailbox. Up to 1,000 characters.">
            <Textarea maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} />
          </Field>
          <Field
            label="Delivery ID"
            hint="Optional. Reusing an ID prevents accidental duplicate delivery to the same player."
          >
            <Input
              value={grantId}
              onChange={(event) => setGrantId(event.target.value)}
              placeholder="weekend-reward-2026-11-12"
            />
          </Field>

          {error && <Notice tone="bad" message={error} />}

          <div className="flex justify-end">
            <Button type="submit" busy={busy}>
              <Gift className="h-4 w-4" />
              {target === 'all' ? 'Send to every inbox' : 'Send to player inbox'}
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid content-start gap-5">
        <Card>
          <CardHeader eyebrow="Preview" title="Inbox message" description="How the reward appears in the game mailbox." />
          <div className="p-5">
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Inbox className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{title || 'Inbox title'}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    To {target === 'all' ? 'all players' : uid || 'player UID'}
                  </div>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-[12.5px] leading-5 text-muted-foreground">
                {message || 'Message body'}
              </p>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5">
                <span className="flex items-center gap-2 text-[12.5px] font-semibold text-primary">
                  <Gift className="h-4 w-4" />
                  {rewardLabel}
                </span>
                <Badge tone="primary">Attachment</Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Rules" title="Delivery notes" />
          <ul className="grid gap-3 p-5 text-[12.5px] leading-5 text-muted-foreground">
            <li className="flex gap-2.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Rewards are attached to a mailbox message and claimed by the player.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Sending to all players iterates every registered account.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              A delivery ID is single-use per account; reuse it to avoid duplicates.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function NewPlayerCampaign() {
  const { toast } = useToast();
  const { data, loading, error, reload } = useRequest(() => api('/new-player-rewards'), []);
  const [form, setForm] = useState(null);
  const [types, setTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm(structuredClone(data.settings));
    setTypes(data.awardTypes || Object.keys(AWARD_LABELS));
  }, [data]);

  function setReward(index, key, value) {
    setForm((current) => ({
      ...current,
      rewards: current.rewards.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    }));
  }

  function setAward(dayIndex, awardIndex, key, value) {
    setForm((current) => ({
      ...current,
      rewards: current.rewards.map((entry, entryIndex) =>
        entryIndex === dayIndex
          ? {
              ...entry,
              awards: entry.awards.map((award, index) =>
                index === awardIndex ? { ...award, [key]: value } : award,
              ),
            }
          : entry,
      ),
    }));
  }

  async function save() {
    setBusy(true);
    setNotice('');
    try {
      const result = await api('/new-player-rewards', { method: 'PUT', body: JSON.stringify(form) });
      setForm(structuredClone(result.settings));
      setNotice('New-player reward campaign published.');
      toast('New-player reward campaign published.', { tone: 'good' });
    } catch (cause) {
      setNotice(cause.message);
      toast(cause.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  if (error && !form) {
    return (
      <Card>
        <div className="p-5">
          <Notice
            tone="bad"
            message={error}
            action={
              <Button variant="secondary" size="sm" onClick={() => reload()}>
                Retry
              </Button>
            }
          />
        </div>
      </Card>
    );
  }

  if (loading || !form) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">New-player campaign</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Daily welcome rewards for accounts created after publishing.
          </p>
        </div>
        <Button busy={busy} onClick={save}>
          <Sparkles className="h-4 w-4" />
          Publish campaign
        </Button>
      </div>

      {(error || notice) && <Notice tone={error ? 'bad' : 'good'} message={error || notice} />}

      <Card>
        <CardHeader
          eyebrow="Availability"
          title="Campaign window"
          description="Claims are measured from each account's creation time."
          action={
            <div className="flex items-center gap-3">
              <Badge tone={form.enabled ? 'good' : 'neutral'} dot>
                {form.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Switch
                checked={form.enabled}
                onCheckedChange={(enabled) => setForm({ ...form, enabled })}
                label="Enable new-player rewards"
              />
            </div>
          }
        />
        <div className="p-5">
          <Field
            label="Claim window"
            hint="Days after account creation before unclaimed rewards expire."
            className="max-w-xs"
          >
            <Input
              type="number"
              min="1"
              max="365"
              value={form.expiryDays}
              onChange={(event) => setForm({ ...form, expiryDays: Number(event.target.value) })}
            />
          </Field>
        </div>
      </Card>

      <div className="grid gap-4">
        {form.rewards.map((entry, index) => (
          <Card key={`${entry.day}-${index}`}>
            <CardHeader
              eyebrow={`Reward day ${entry.day}`}
              title={`Day ${entry.day}`}
              description={`${entry.awards.length} reward${entry.awards.length === 1 ? '' : 's'} unlocked on this day`}
              action={
                <div className="flex items-center gap-2">
                  <Badge tone="primary">{entry.awards.length}</Badge>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    aria-label={`Remove day ${entry.day}`}
                    onClick={() =>
                      setForm({ ...form, rewards: form.rewards.filter((_, entryIndex) => entryIndex !== index) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              }
            />
            <div className="grid gap-4 p-5">
              <Field label="Unlock day" className="max-w-[10rem]">
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={entry.day}
                  onChange={(event) => setReward(index, 'day', Number(event.target.value))}
                />
              </Field>

              {entry.awards.map((award, awardIndex) => (
                <div
                  key={awardIndex}
                  className="grid gap-4 rounded-xl border border-border bg-background/40 p-4 lg:grid-cols-[12rem_1fr_8rem_auto] lg:items-end"
                >
                  <Field label="Reward type">
                    <Select
                      value={award.type}
                      onChange={(event) => {
                        setAward(index, awardIndex, 'type', event.target.value);
                        if (event.target.value !== 'item') setAward(index, awardIndex, 'itemId', 0);
                      }}
                    >
                      {types.map((type) => (
                        <option key={type} value={type}>
                          {AWARD_LABELS[type] || type}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="Inventory item"
                    hint={award.type === 'item' ? 'Search by name, type, rarity, or ID.' : 'Select item as the reward type first.'}
                  >
                    {award.type === 'item' ? (
                      <ItemPicker
                        value={award.itemId}
                        onChange={(id) => setAward(index, awardIndex, 'itemId', id)}
                      />
                    ) : (
                      <div className="flex h-10 items-center rounded-lg border border-dashed border-border px-3 text-[12px] text-muted-foreground">
                        Not required
                      </div>
                    )}
                  </Field>

                  <Field label="Amount">
                    <Input
                      type="number"
                      min="1"
                      max="100000000"
                      value={award.amount}
                      onChange={(event) => setAward(index, awardIndex, 'amount', Number(event.target.value))}
                    />
                  </Field>

                  <Button
                    variant="ghost"
                    size="iconSm"
                    aria-label="Remove reward"
                    className="mb-0.5"
                    disabled={entry.awards.length === 1}
                    onClick={() =>
                      setReward(
                        index,
                        'awards',
                        entry.awards.filter((_, rewardIndex) => rewardIndex !== awardIndex),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="secondary"
                size="sm"
                className="justify-self-start"
                onClick={() => setReward(index, 'awards', [...entry.awards, newAward()])}
              >
                <Plus className="h-4 w-4" />
                Add reward
              </Button>
            </div>
          </Card>
        ))}

        <Button
          variant="secondary"
          className="justify-self-start border-dashed"
          onClick={() =>
            setForm({
              ...form,
              rewards: [
                ...form.rewards,
                {
                  day: Math.max(0, ...form.rewards.map((entry) => entry.day)) + 1,
                  awards: [newAward()],
                },
              ],
            })
          }
        >
          <Plus className="h-4 w-4" />
          Add reward day
        </Button>
      </div>
    </div>
  );
}

export default function Rewards() {
  const [tab, setTab] = useState('grants');
  return (
    <>
      <PageHeader
        eyebrow="Reward operations"
        icon={Gift}
        title="Player rewards"
        description="Deliver claimed inbox rewards and run the daily welcome campaign for new accounts."
        actions={
          <Badge tone="info">
            <Users className="h-3 w-3" />
            Validated server-side
          </Badge>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="grants">Inbox grants</TabsTrigger>
          <TabsTrigger value="new-players">New-player campaign</TabsTrigger>
        </TabsList>
        <TabsContent value="grants">
          <ServerGrants />
        </TabsContent>
        <TabsContent value="new-players">
          <NewPlayerCampaign />
        </TabsContent>
      </Tabs>
    </>
  );
}
