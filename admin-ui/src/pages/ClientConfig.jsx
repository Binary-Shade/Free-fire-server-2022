import React, { useMemo, useState } from 'react';
import { FileJson, Pencil, RefreshCw, Save, Search, Settings2, Sparkles } from 'lucide-react';
import { api, safeJsonParse, useRequest } from '../lib';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  Modal,
  Notice,
  PageHeader,
  Skeleton,
  StatTile,
  SwitchRow,
  Textarea,
  useToast,
} from '../components';

export default function ClientConfig() {
  const { toast } = useToast();
  const { data, setData, loading, error, reload } = useRequest(() => api('/login-desc'), []);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const sections = data?.sections || [];
  const counts = useMemo(
    () => ({
      enabled: sections.filter((section) => section.enabled).length,
      disabled: sections.filter((section) => !section.enabled).length,
    }),
    [sections],
  );

  const visible = sections.filter((section) => {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      section.key.toLowerCase().includes(query) ||
      (section.label || '').toLowerCase().includes(query)
    );
  });

  function openEditor(section) {
    setEditing({
      key: section.key,
      label: section.label || section.key,
      enabled: section.enabled,
      text: JSON.stringify(section.data ?? {}, null, 2),
    });
  }

  const parsed = editing ? safeJsonParse(editing.text) : { ok: false, error: '' };

  async function save() {
    if (!editing) return;
    if (!parsed.ok) {
      toast('The JSON format is invalid.', { tone: 'bad' });
      return;
    }
    setBusy(true);
    try {
      const result = await api(`/login-desc/${editing.key}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: editing.enabled, data: parsed.value }),
      });
      setData((current) => ({
        ...current,
        sections: current.sections.map((section) =>
          section.key === editing.key ? { ...section, ...result.section } : section,
        ),
      }));
      toast(`${editing.label} saved.`, { tone: 'good' });
      setEditing(null);
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        icon={Settings2}
        title="Client configuration"
        description="Manage the LoginGetDesc sections sent to the game during sign-in. Disabled sections fall back to the game's defaults."
        actions={
          <Button variant="secondary" onClick={() => reload()} busy={loading}>
            <RefreshCw className="h-4 w-4" />
            Reload
          </Button>
        }
      />

      {error && <Notice tone="bad" className="mb-5" message={error} />}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatTile label="Sections" value={sections.length} hint="Login configuration blocks" icon={FileJson} />
        <StatTile label="Enabled" value={counts.enabled} hint="Sent to clients" icon={Settings2} tone="good" />
        <StatTile label="Disabled" value={counts.disabled} hint="Using game defaults" icon={Settings2} tone="neutral" />
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search sections by label or key"
          className="pl-9"
          aria-label="Search client configuration sections"
        />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <Skeleton key={key} className="h-32" />
          ))}
        </div>
      ) : !visible.length ? (
        <Card>
          <Empty
            icon={FileJson}
            title="No matching sections"
            description="Try another search to find the login configuration section."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((section) => (
            <Card key={section.key} interactive className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{section.label || section.key}</div>
                  <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{section.key}</div>
                </div>
                <Badge tone={section.enabled ? 'good' : 'neutral'} dot>
                  {section.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="mt-3 font-mono text-[10px] text-muted-foreground">
                {section.data && typeof section.data === 'object'
                  ? `${Object.keys(section.data).length} top-level keys`
                  : 'No custom data'}
              </div>
              <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => openEditor(section)}>
                <Pencil className="h-3.5 w-3.5" />
                Review settings
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.label}
        description="Edit this LoginGetDesc section. The server validates the document before saving."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button busy={busy} onClick={save}>
              <Save className="h-4 w-4" />
              Save section
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4">
            <SwitchRow
              checked={editing.enabled}
              onCheckedChange={(enabled) => setEditing({ ...editing, enabled })}
              label="Send to clients"
              description="Disabled sections use the game's default behavior."
              className="rounded-xl border border-border bg-background/40 px-4 py-2"
            />
            <Field label="Section data" hint="JSON object sent as this section's payload.">
              <div className="editor-shell">
                <div className="flex h-8 items-center justify-between border-b border-border bg-secondary/40 px-3 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span>{editing.key}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (parsed.ok) setEditing({ ...editing, text: JSON.stringify(parsed.value, null, 2) });
                    }}
                    className="inline-flex items-center gap-1 transition hover:text-foreground"
                  >
                    <Sparkles className="h-3 w-3" />
                    Format
                  </button>
                </div>
                <Textarea
                  spellCheck="false"
                  value={editing.text}
                  onChange={(event) => setEditing({ ...editing, text: event.target.value })}
                  aria-label={`${editing.label} JSON data`}
                  aria-invalid={!parsed.ok}
                  className="code-area min-h-[18rem] resize-y rounded-none border-0 bg-transparent"
                />
              </div>
            </Field>
            {!parsed.ok && <Notice tone="bad" message={`JSON syntax error: ${parsed.error}`} />}
          </div>
        )}
      </Modal>
    </>
  );
}
