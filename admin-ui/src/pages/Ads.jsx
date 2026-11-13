import React, { useEffect, useState } from 'react';
import {
  CalendarClock,
  ImagePlus,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { api, dateTime, fromDateTimeLocal, toDateTimeLocal, useRequest, windowStatus } from '../lib';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Field,
  Input,
  Modal,
  Notice,
  PageHeader,
  Select,
  Skeleton,
  StatTile,
  Switch,
  SwitchRow,
  useToast,
} from '../components';

const now = () => Math.floor(Date.now() / 1000);

function blankAd(nextId, nextOrder) {
  return {
    enabled: true,
    id: nextId,
    type: 25,
    sortId: nextOrder,
    language: 'default',
    imageUrl: '',
    startAt: now() - 60,
    endAt: now() + 31536000,
    goPos: 0,
    subType: 0,
    subGoPos: '',
    externalForOfficialWebsite: false,
    goToSwitch: false,
    smallStartTime: 0,
  };
}

function adStatus(ad) {
  if (!ad.enabled) return { label: 'Disabled', tone: 'neutral' };
  return windowStatus(ad.startAt, ad.endAt);
}

function destinationLabel(ad) {
  if (ad.externalForOfficialWebsite) return 'External website';
  if (ad.goToSwitch) return 'Feature switch';
  return 'Internal destination';
}

export default function Ads() {
  const { toast } = useToast();
  const { data, setData, loading, error, reload } = useRequest(() => api('/ads'), []);
  const [ads, setAds] = useState([]);
  const [draft, setDraft] = useState(null);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (data) setAds(data.ads || []);
  }, [data]);

  const active = ads.filter(
    (ad) => ad.enabled && (!ad.startAt || ad.startAt <= now()) && (!ad.endAt || ad.endAt > now()),
  ).length;
  const scheduled = ads.filter((ad) => ad.enabled && ad.startAt > now()).length;
  const disabled = ads.filter((ad) => !ad.enabled).length;

  function openNew() {
    const nextId = Math.max(0, ...ads.map((ad) => Number(ad.id) || 0)) + 1;
    const nextOrder = Math.max(0, ...ads.map((ad) => Number(ad.sortId) || 0)) + 1;
    setDraft({ index: -1, ad: blankAd(nextId, nextOrder) });
  }

  function openEdit(index) {
    setDraft({ index, ad: structuredClone(ads[index]) });
  }

  function setField(key, value) {
    setDraft((current) => ({ ...current, ad: { ...current.ad, [key]: value } }));
  }

  function saveDraft() {
    if (!draft) return;
    setAds((current) =>
      draft.index === -1
        ? [...current, draft.ad]
        : current.map((ad, index) => (index === draft.index ? draft.ad : ad)),
    );
    setDraft(null);
  }

  async function uploadDraft(file) {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await api('/cloudinary-upload', {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
      });
      setField('imageUrl', result.imageUrl);
      toast('Image uploaded. Publish advertisements when ready.', { tone: 'good' });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const result = await api('/ads', { method: 'PUT', body: JSON.stringify({ ads }) });
      setAds(result.ads || []);
      setData({ ads: result.ads || [] });
      toast('Advertisements published. Active players receive them on refresh.', { tone: 'good' });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Lobby" icon={Megaphone} title="Advertisements" description="Loading campaigns…" />
        <div className="grid gap-5">
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Lobby"
        icon={Megaphone}
        title="Advertisements"
        description="Manage lobby promotions shown by login, GetAds, and GetAdvert. Campaigns are filtered by enabled state, language, and their active window."
        actions={
          <>
            <Button variant="secondary" onClick={() => reload()} busy={loading}>
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
            <Button onClick={publish} busy={busy}>
              <Save className="h-4 w-4" />
              Publish advertisements
            </Button>
          </>
        }
      />

      {error && <Notice tone="bad" className="mb-5" message={error} />}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Campaigns" value={ads.length} hint="Saved advertisement slots" icon={Megaphone} />
        <StatTile label="Active now" value={active} hint="Visible to matching clients" icon={CalendarClock} tone="good" />
        <StatTile label="Scheduled" value={scheduled} hint="Waiting for their start time" icon={CalendarClock} tone="warn" />
        <StatTile label="Disabled" value={disabled} hint="Saved but hidden" icon={Megaphone} tone="neutral" />
      </div>

      <div className="grid gap-4">
        {ads.map((ad, index) => {
          const status = adStatus(ad);
          return (
            <Card key={`${ad.id}-${index}`} className="overflow-hidden">
              <div className="grid gap-4 p-4 lg:grid-cols-[210px_1fr_auto] lg:items-center">
                <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-background">
                  {ad.imageUrl ? (
                    <img src={ad.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">
                      <ImagePlus className="h-7 w-7" />
                    </div>
                  )}
                  <div className="absolute left-2 top-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-[15px] font-semibold tracking-tight">
                      Advertisement #{ad.id}
                    </h3>
                    <Badge tone="neutral">{ad.language || 'default'}</Badge>
                    <Badge tone="info">{destinationLabel(ad)}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
                    <span>order {ad.sortId}</span>
                    <span>type {ad.type}</span>
                    <span>goPos {ad.goPos}</span>
                    <span>subType {ad.subType}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {dateTime(ad.startAt * 1000)} → {ad.endAt ? dateTime(ad.endAt * 1000) : 'No expiry'}
                    </span>
                    {ad.subGoPos && (
                      <span className="truncate font-mono text-[10.5px]">→ {ad.subGoPos}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Switch
                    checked={ad.enabled}
                    onCheckedChange={(enabled) =>
                      setAds((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? { ...item, enabled } : item)),
                      )
                    }
                    label={`Enable advertisement ${ad.id}`}
                  />
                  <Button variant="secondary" size="sm" onClick={() => openEdit(index)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="iconSm" aria-label="Delete advertisement" onClick={() => setDeleteIndex(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}

        {!ads.length && (
          <Card>
            <Empty
              icon={Megaphone}
              title="No advertisements"
              description="Add a campaign to show promotional art in the game lobby."
              action={
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4" />
                  Add advertisement
                </Button>
              }
            />
          </Card>
        )}

        {ads.length > 0 && (
          <Button variant="secondary" className="justify-self-start border-dashed" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Add advertisement
          </Button>
        )}
      </div>

      <Modal
        open={!!draft}
        onOpenChange={(open) => !open && setDraft(null)}
        title={draft?.index === -1 ? 'New advertisement' : `Advertisement #${draft?.ad.id ?? ''}`}
        description="Upload artwork and configure the destination behavior. Publish from the page header when finished."
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={saveDraft}>
              <Save className="h-4 w-4" />
              Save advertisement
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
            <div>
              <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
                {draft.ad.imageUrl ? (
                  <img src={draft.ad.imageUrl} alt="Advertisement preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <ImagePlus className="h-8 w-8" />
                  </div>
                )}
              </div>
              <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-[12.5px] font-semibold transition hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload image'}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(event) => uploadDraft(event.target.files[0])}
                />
              </label>
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">PNG, JPG, or WebP up to 8 MB.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Image or resource URL" className="sm:col-span-2">
                <Input value={draft.ad.imageUrl || ''} onChange={(event) => setField('imageUrl', event.target.value)} />
              </Field>
              <Field label="ID" hint="Must be unique across campaigns.">
                <Input
                  type="number"
                  min="1"
                  value={draft.ad.id}
                  onChange={(event) => setField('id', Number(event.target.value))}
                />
              </Field>
              <Field label="Display order">
                <Input
                  type="number"
                  min="0"
                  value={draft.ad.sortId}
                  onChange={(event) => setField('sortId', Number(event.target.value))}
                />
              </Field>
              <Field label="Language" hint="Use default to match every language.">
                <Input
                  value={draft.ad.language || ''}
                  placeholder="default or en"
                  onChange={(event) => setField('language', event.target.value)}
                />
              </Field>
              <Field label="Ad type">
                <Input
                  type="number"
                  min="0"
                  value={draft.ad.type}
                  onChange={(event) => setField('type', Number(event.target.value))}
                />
              </Field>
              <Field label="Starts">
                <Input
                  type="datetime-local"
                  value={toDateTimeLocal(draft.ad.startAt)}
                  onChange={(event) => setField('startAt', fromDateTimeLocal(event.target.value))}
                />
              </Field>
              <Field label="Ends">
                <Input
                  type="datetime-local"
                  value={toDateTimeLocal(draft.ad.endAt)}
                  onChange={(event) => setField('endAt', fromDateTimeLocal(event.target.value))}
                />
              </Field>
              <Field label="Destination type">
                <Input
                  type="number"
                  min="0"
                  value={draft.ad.goPos}
                  onChange={(event) => setField('goPos', Number(event.target.value))}
                />
              </Field>
              <Field label="Subtype">
                <Input
                  type="number"
                  min="0"
                  value={draft.ad.subType}
                  onChange={(event) => setField('subType', Number(event.target.value))}
                />
              </Field>
              <Field label="Destination value">
                <Input value={draft.ad.subGoPos || ''} onChange={(event) => setField('subGoPos', event.target.value)} />
              </Field>
              <Field label="Open behavior">
                <Select
                  value={
                    draft.ad.externalForOfficialWebsite
                      ? 'external'
                      : draft.ad.goToSwitch
                        ? 'switch'
                        : 'internal'
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      ad: {
                        ...current.ad,
                        externalForOfficialWebsite: value === 'external',
                        goToSwitch: value === 'switch',
                      },
                    }));
                  }}
                >
                  <option value="internal">Internal destination</option>
                  <option value="switch">Feature switch</option>
                  <option value="external">External website</option>
                </Select>
              </Field>
              <SwitchRow
                checked={draft.ad.enabled}
                onCheckedChange={(enabled) => setField('enabled', enabled)}
                label="Campaign enabled"
                description="Disabled campaigns stay saved but are not sent to clients."
                className="sm:col-span-2 rounded-xl border border-border bg-background/40 px-4 py-2"
              />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => !open && setDeleteIndex(null)}
        title="Delete this advertisement?"
        description="It will be removed from the lobby after you publish advertisements."
        confirmLabel="Delete advertisement"
        onConfirm={() => {
          setAds((current) => current.filter((_, index) => index !== deleteIndex));
          setDeleteIndex(null);
        }}
      />
    </>
  );
}
