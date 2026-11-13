import React, { useEffect, useMemo, useState } from 'react';
import { Braces, CheckCircle2, RotateCcw, Save, ShieldAlert, Sparkles } from 'lucide-react';
import { api, safeJsonParse, useRequest } from '../lib';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Notice,
  PageHeader,
  Skeleton,
  useToast,
} from '../components';

export default function JsonSettings({ title, description, endpoint, field }) {
  const { toast } = useToast();
  const { data, loading, error } = useRequest(() => api(endpoint), [endpoint]);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const next = JSON.stringify(data[field], null, 2);
    setText(next);
    setSaved(next);
  }, [data, field]);

  const parsed = useMemo(() => safeJsonParse(text), [text]);
  const dirty = text !== saved;
  const lineCount = text ? text.split('\n').length : 0;

  async function save() {
    if (!parsed.ok) {
      toast('Fix the JSON syntax before saving.', { tone: 'bad' });
      return;
    }
    setBusy(true);
    try {
      const result = await api(endpoint, { method: 'PUT', body: JSON.stringify(parsed.value) });
      const next = JSON.stringify(result[field] ?? result.settings ?? parsed.value, null, 2);
      setText(next);
      setSaved(next);
      toast('Configuration validated and saved.', { tone: 'good' });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }

  function format() {
    if (!parsed.ok) {
      toast('The JSON format is invalid. Check commas and brackets.', { tone: 'bad' });
      return;
    }
    setText(JSON.stringify(parsed.value, null, 2));
  }

  return (
    <>
      <PageHeader
        eyebrow="Advanced"
        icon={Braces}
        title={title}
        description={description}
        actions={
          <>
            <Button variant="ghost" onClick={() => setText(saved)} disabled={!dirty}>
              <RotateCcw className="h-4 w-4" />
              Restore
            </Button>
            <Button variant="secondary" onClick={format}>
              <Sparkles className="h-4 w-4" />
              Format JSON
            </Button>
            <Button busy={busy} disabled={!parsed.ok} onClick={save}>
              <Save className="h-4 w-4" />
              Validate and save
            </Button>
          </>
        }
      />

      {error && <Notice tone="bad" className="mb-5" message={error} />}

      {loading ? (
        <Skeleton className="h-[620px]" />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_310px]">
          <Card className="overflow-hidden">
            <CardHeader
              eyebrow="Configuration data"
              title="JSON editor"
              description="Changes are checked by the server before they are accepted."
              action={
                <div className="flex items-center gap-2">
                  {dirty && <Badge tone="warn">Unsaved</Badge>}
                  <Badge tone={parsed.ok ? 'good' : 'bad'} dot>
                    {parsed.ok ? 'Valid JSON' : 'Syntax error'}
                  </Badge>
                </div>
              }
            />
            <div className="p-4">
              <div className="editor-shell">
                <div className="flex h-9 items-center justify-between border-b border-border bg-secondary/40 px-3 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Braces className="h-3.5 w-3.5 text-primary" />
                    settings.json
                  </span>
                  <span>
                    {lineCount} lines · {text.length} chars
                  </span>
                </div>
                <textarea
                  spellCheck="false"
                  autoCapitalize="off"
                  autoCorrect="off"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  aria-label={`${title} JSON configuration`}
                  aria-invalid={!parsed.ok}
                  className="code-area min-h-[520px] w-full resize-y border-0 bg-transparent p-4 text-foreground outline-none"
                />
              </div>
              {!parsed.ok && (
                <Notice tone="bad" className="mt-3" message={`JSON syntax error: ${parsed.error}`} />
              )}
            </div>
          </Card>

          <div className="grid content-start gap-5">
            <Card>
              <CardHeader
                eyebrow="Caution"
                title="Advanced settings"
                action={<ShieldAlert className="h-5 w-5 text-warning" />}
              />
              <div className="p-5">
                <Notice
                  tone="warn"
                  message="Invalid IDs can hide content from the client. Keep a copy of the current configuration before making large changes."
                />
              </div>
            </Card>

            <Card>
              <CardHeader eyebrow="Guardrails" title="How validation works" />
              <ul className="grid gap-3 p-5 text-[12.5px] leading-5 text-muted-foreground">
                {[
                  'The server parses and normalizes the document before writing it.',
                  'Unknown or invalid IDs are rejected with a specific error.',
                  'Saved configuration is returned and reloaded into this editor.',
                  'Active clients receive the change on their next refresh.',
                ].map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
