import React, { useEffect, useState } from 'react';
import {
  ImagePlus,
  LayoutTemplate,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { api, fromDateTimeLocal, toDateTimeLocal, useRequest, windowStatus } from '../lib';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  Notice,
  PageHeader,
  Skeleton,
  Switch,
  SwitchRow,
  Textarea,
  useToast,
} from '../components';

function fileData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function emptyBanner(index, nextId) {
  return {
    enabled: true,
    id: nextId,
    sortId: index + 1,
    name: `Lobby banner ${index + 1}`,
    title: '',
    description: '',
    imageUrl: '',
    linkUrl: '',
    startAt: 0,
    endAt: 0,
  };
}

export default function Lobby() {
  const { toast } = useToast();
  const { data, setData, loading, error, reload } = useRequest(() => api('/content'), []);
  const [form, setForm] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [feedbackError, setFeedbackError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteIndex, setDeleteIndex] = useState(null);

  useEffect(() => {
    if (data) setForm(structuredClone(data));
  }, [data]);

  useEffect(() => {
    api('/feedback')
      .then((result) => setFeedback(result.settings))
      .catch((cause) => setFeedbackError(cause.message));
  }, []);

  function setRoot(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadFile(file) {
    const dataUrl = await fileData(file);
    const result = await api('/cloudinary-upload', {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    });
    return result.imageUrl;
  }

  async function uploadMany(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of list) urls.push(await uploadFile(file));
      setForm((current) => {
        let id = Math.max(0, ...current.banners.map((banner) => Number(banner.id) || 0));
        const additions = urls.map((imageUrl, index) =>
          emptyBanner(current.banners.length + index, ++id),
        ).map((banner, index) => ({ ...banner, imageUrl: urls[index] }));
        return { ...current, banners: [...current.banners, ...additions] };
      });
      toast(`${urls.length} banner image${urls.length === 1 ? '' : 's'} uploaded. Add details, then publish.`, {
        tone: 'good',
      });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setUploading(false);
    }
  }

  async function uploadDraft(file) {
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await uploadFile(file);
      setEditing((current) => ({ ...current, draft: { ...current.draft, imageUrl } }));
      toast('Banner image uploaded. Save the banner to apply it.', { tone: 'good' });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const result = await api('/content', {
        method: 'PUT',
        body: JSON.stringify({ ...form, marquee: Array.isArray(form.marquee) ? form.marquee : [] }),
      });
      setForm(structuredClone(result.content));
      setData(result.content);
      toast('Lobby changes published. Players receive them on their next refresh.', { tone: 'good' });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  async function saveFeedback() {
    setBusy(true);
    try {
      const result = await api('/feedback', { method: 'PUT', body: JSON.stringify(feedback) });
      setFeedback(result.settings);
      toast('Feedback settings saved.', { tone: 'good' });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  function openEditor(index) {
    if (index === -1) {
      const nextId = Math.max(0, ...form.banners.map((banner) => Number(banner.id) || 0)) + 1;
      setEditing({ index: -1, draft: emptyBanner(form.banners.length, nextId) });
      return;
    }
    setEditing({ index, draft: structuredClone(form.banners[index]) });
  }

  function saveDraft() {
    if (!editing) return;
    const { index, draft } = editing;
    setForm((current) => ({
      ...current,
      banners:
        index === -1
          ? [...current.banners, draft]
          : current.banners.map((banner, bannerIndex) => (bannerIndex === index ? draft : banner)),
    }));
    setEditing(null);
  }

  function setDraft(key, value) {
    setEditing((current) => ({ ...current, draft: { ...current.draft, [key]: value } }));
  }

  if (loading || !form) {
    return (
      <>
        <PageHeader eyebrow="Lobby" icon={LayoutTemplate} title="Lobby content" description="Loading lobby configuration…" />
        <div className="grid gap-5 xl:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Lobby"
        icon={LayoutTemplate}
        title="Lobby content"
        description="Publish announcements, rotating image banners, and the post-match feedback prompt seen by every player."
        actions={
          <>
            <Button variant="secondary" onClick={() => reload()} busy={loading}>
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
            <Button busy={busy} onClick={publish}>
              <Save className="h-4 w-4" />
              Publish changes
            </Button>
          </>
        }
      />

      {error && <Notice tone="bad" className="mb-5" message={error} />}

      <div className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
        <div className="grid content-start gap-5">
          <Card>
            <CardHeader
              eyebrow="Presentation"
              title="Region and announcements"
              description="Shown in the lobby and used by regional content."
              action={<LayoutTemplate className="h-5 w-5 text-primary" />}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Default region">
                <Input value={form.region || ''} onChange={(event) => setRoot('region', event.target.value)} />
              </Field>
              <Field label="Language">
                <Input value={form.language || ''} onChange={(event) => setRoot('language', event.target.value)} />
              </Field>
              <Field
                className="sm:col-span-2"
                label="Marquee messages"
                hint="Enter one announcement per line. Empty lines are ignored."
              >
                <Textarea
                  className="min-h-28"
                  value={(form.marquee || []).join('\n')}
                  onChange={(event) => setRoot('marquee', event.target.value.split('\n').filter(Boolean))}
                />
              </Field>
              <div className="sm:col-span-2">
                <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  Live preview
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-background/50 py-2">
                  {form.marquee?.length ? (
                    <div className="marquee-track gap-8">
                      {[0, 1, 2, 3].map((copy) =>
                        form.marquee.map((message, index) => (
                          <span
                            key={`${copy}-${index}`}
                            className="flex items-center gap-2 whitespace-nowrap font-mono text-[11px] text-muted-foreground"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {message}
                          </span>
                        )),
                      )}
                    </div>
                  ) : (
                    <div className="px-4 text-[12px] text-muted-foreground">No announcements configured.</div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Post-match"
              title="Feedback prompt"
              description="Choose whether the game asks players for feedback after matches."
              action={
                feedback ? (
                  <Switch
                    checked={feedback.enabled}
                    onCheckedChange={(enabled) => setFeedback({ ...feedback, enabled })}
                    label="Enable post-match feedback"
                  />
                ) : null
              }
            />
            {feedbackError ? (
              <div className="p-5">
                <Notice tone="bad" message={feedbackError} />
              </div>
            ) : !feedback ? (
              <div className="p-5">
                <Skeleton className="h-32" />
              </div>
            ) : (
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Region">
                  <Input
                    value={feedback.region || ''}
                    onChange={(event) => setFeedback({ ...feedback, region: event.target.value })}
                  />
                </Field>
                <Field label="Cooldown" hint="Seconds between prompts">
                  <Input
                    type="number"
                    value={feedback.cooldown ?? 0}
                    onChange={(event) => setFeedback({ ...feedback, cooldown: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Primary game mode">
                  <Input
                    type="number"
                    value={feedback.primary?.gameMode ?? 0}
                    onChange={(event) =>
                      setFeedback({
                        ...feedback,
                        primary: { ...feedback.primary, gameMode: Number(event.target.value) },
                      })
                    }
                  />
                </Field>
                <Field label="Rank threshold">
                  <Input
                    type="number"
                    value={feedback.primary?.rank ?? 0}
                    onChange={(event) =>
                      setFeedback({
                        ...feedback,
                        primary: { ...feedback.primary, rank: Number(event.target.value) },
                      })
                    }
                  />
                </Field>
                <div className="sm:col-span-2 flex justify-end">
                  <Button variant="secondary" busy={busy} onClick={saveFeedback}>
                    Save feedback settings
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader
            eyebrow="Rotation"
            title="Lobby image banners"
            description="The client displays enabled banners in order, filtered by their active window."
            action={
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-[12.5px] font-semibold transition hover:bg-muted">
                <Upload className="h-4 w-4" />
                Upload images
                <input
                  className="sr-only"
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => uploadMany(event.target.files)}
                />
              </label>
            }
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {form.banners.map((banner, index) => {
              const status = banner.enabled
                ? windowStatus(banner.startAt, banner.endAt)
                : { label: 'Disabled', tone: 'neutral' };
              return (
                <div key={`${banner.id}-${index}`} className="overflow-hidden rounded-xl border border-border bg-background/40">
                  <div className="relative aspect-[16/8] overflow-hidden bg-muted">
                    {banner.imageUrl ? (
                      <img
                        src={banner.imageUrl}
                        alt={banner.title || banner.name || 'Lobby banner'}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <ImagePlus className="h-7 w-7" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                      <div className="line-clamp-1 text-[13px] font-semibold text-white">
                        {banner.title || banner.name || 'Untitled banner'}
                      </div>
                      {banner.description && (
                        <div className="line-clamp-1 text-[11px] text-white/60">{banner.description}</div>
                      )}
                    </div>
                    <div className="absolute left-2 top-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold">{banner.name || 'Banner'}</div>
                      <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">
                        ID {banner.id} · order {banner.sortId}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={banner.enabled}
                        onCheckedChange={(enabled) =>
                          setForm((current) => ({
                            ...current,
                            banners: current.banners.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, enabled } : item,
                            ),
                          }))
                        }
                        label={`Enable ${banner.name || 'banner'}`}
                      />
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label="Edit banner"
                        onClick={() => openEditor(index)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label="Delete banner"
                        onClick={() => setDeleteIndex(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => openEditor(-1)}
              className="grid min-h-[11rem] place-items-center rounded-xl border border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              <span className="flex flex-col items-center gap-2">
                <Plus className="h-5 w-5" />
                <span className="text-[12px] font-semibold">Add empty banner</span>
              </span>
            </button>
          </div>
        </Card>
      </div>

      <Modal
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.index === -1 ? 'New lobby banner' : 'Edit lobby banner'}
        description="Upload artwork, write the overlay copy, and control when the banner is visible."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveDraft}>
              <Save className="h-4 w-4" />
              Save banner
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-5">
            <div className="relative aspect-[16/7] overflow-hidden rounded-xl border border-border bg-muted">
              {editing.draft.imageUrl ? (
                <img
                  src={editing.draft.imageUrl}
                  alt="Banner preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-muted-foreground">
                  <ImagePlus className="h-8 w-8" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-[12.5px] font-semibold transition hover:bg-muted">
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
              <span className="text-[11px] text-muted-foreground">PNG, JPG, or WebP up to 8 MB.</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Image URL" className="sm:col-span-2">
                <Input value={editing.draft.imageUrl || ''} onChange={(event) => setDraft('imageUrl', event.target.value)} />
              </Field>
              <Field label="Internal name">
                <Input value={editing.draft.name || ''} onChange={(event) => setDraft('name', event.target.value)} />
              </Field>
              <Field label="Headline">
                <Input value={editing.draft.title || ''} onChange={(event) => setDraft('title', event.target.value)} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea
                  value={editing.draft.description || ''}
                  onChange={(event) => setDraft('description', event.target.value)}
                />
              </Field>
              <Field label="Open when tapped" className="sm:col-span-2">
                <Input value={editing.draft.linkUrl || ''} onChange={(event) => setDraft('linkUrl', event.target.value)} />
              </Field>
              <Field label="ID">
                <Input
                  type="number"
                  min="1"
                  value={editing.draft.id}
                  onChange={(event) => setDraft('id', Number(event.target.value))}
                />
              </Field>
              <Field label="Display order">
                <Input
                  type="number"
                  min="0"
                  value={editing.draft.sortId}
                  onChange={(event) => setDraft('sortId', Number(event.target.value))}
                />
              </Field>
              <Field label="Starts" hint="Leave empty for immediately.">
                <Input
                  type="datetime-local"
                  value={toDateTimeLocal(editing.draft.startAt)}
                  onChange={(event) => setDraft('startAt', fromDateTimeLocal(event.target.value))}
                />
              </Field>
              <Field label="Ends" hint="Leave empty for no expiry.">
                <Input
                  type="datetime-local"
                  value={toDateTimeLocal(editing.draft.endAt)}
                  onChange={(event) => setDraft('endAt', fromDateTimeLocal(event.target.value))}
                />
              </Field>
            </div>

            <SwitchRow
              checked={editing.draft.enabled}
              onCheckedChange={(enabled) => setDraft('enabled', enabled)}
              label="Banner enabled"
              description="Disabled banners stay saved but are hidden from every client."
              className="rounded-xl border border-border bg-background/40 px-4 py-2"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => !open && setDeleteIndex(null)}
        title="Delete this banner?"
        description="It will be removed from the lobby after you publish changes."
        confirmLabel="Delete banner"
        onConfirm={() => {
          setForm((current) => ({
            ...current,
            banners: current.banners.filter((_, index) => index !== deleteIndex),
          }));
          setDeleteIndex(null);
        }}
      />
    </>
  );
}
