import React, { useEffect, useState } from 'react';
import {
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Mic2,
  Save,
  ShieldCheck,
  TestTube2,
} from 'lucide-react';
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
  Skeleton,
  useToast,
} from '../components';

export default function Voice() {
  const { toast } = useToast();
  const { data, setData, loading, error, reload } = useRequest(() => api('/voice'), []);
  const [form, setForm] = useState(null);
  const [secret, setSecret] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);

  async function save() {
    setSaving(true);
    try {
      const result = await api('/voice', {
        method: 'PUT',
        body: JSON.stringify({ ...form, sharedSecret: secret }),
      });
      setForm(result.settings);
      setData({ settings: result.settings });
      setSecret('');
      toast('Voice provider settings saved.', { tone: 'good' });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      await api('/voice/test', { method: 'POST', body: JSON.stringify({ channel: 'dashboard-test' }) });
      toast('Connection successful. The provider returned a token.', { tone: 'good' });
    } catch (cause) {
      toast(cause.message, { tone: 'bad' });
    } finally {
      setTesting(false);
    }
  }

  if (loading || (!form && !error)) {
    return (
      <>
        <PageHeader eyebrow="Platform" icon={Mic2} title="Voice chat" description="Loading provider settings…" />
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
        eyebrow="Platform"
        icon={Mic2}
        title="Voice chat"
        description="Connect the game to an external voice-token provider. The shared secret stays on the server and is never returned to the browser."
        actions={
          <>
            <Button variant="secondary" busy={testing} disabled={!form?.tokenUrl} onClick={test}>
              <TestTube2 className="h-4 w-4" />
              Test connection
            </Button>
            <Button busy={saving} disabled={!form} onClick={save}>
              <Save className="h-4 w-4" />
              Save provider
            </Button>
          </>
        }
      />

      {error && <Notice tone="bad" className="mb-5" message={error} />}

      {form && (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <Card>
            <CardHeader
              eyebrow="Provider"
              title="Token service connection"
              description="The server calls this endpoint to mint voice tokens for match channels."
              action={
                <Badge tone={form.configured ? 'good' : 'warn'} dot>
                  {form.configured ? 'Configured' : 'Not configured'}
                </Badge>
              }
            />
            <div className="grid gap-5 p-5">
              <Field
                label="Token service URL"
                hint="HTTPS endpoint that accepts a JSON token request."
              >
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="url"
                    className="pl-9"
                    placeholder="https://voice.example.com/token"
                    value={form.tokenUrl || ''}
                    onChange={(event) => setForm({ ...form, tokenUrl: event.target.value })}
                  />
                </div>
              </Field>

              <Field
                label="Shared secret"
                hint={
                  form.hasSecret
                    ? 'A secret is already stored. Leave blank to keep it.'
                    : 'Bearer token expected by the provider.'
                }
              >
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={reveal ? 'text' : 'password'}
                    className="pl-9 pr-10"
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                    placeholder={form.hasSecret ? '••••••••••••' : 'Enter secret'}
                  />
                  <button
                    type="button"
                    aria-label={reveal ? 'Hide secret' : 'Show secret'}
                    aria-pressed={reveal}
                    onClick={() => setReveal((value) => !value)}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <Field label="Request timeout" hint="500 to 10,000 milliseconds.">
                <div className="relative">
                  <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    min="500"
                    max="10000"
                    step="100"
                    className="pl-9"
                    value={form.timeoutMs ?? 3000}
                    onChange={(event) => setForm({ ...form, timeoutMs: Number(event.target.value) })}
                  />
                </div>
              </Field>

              <Notice
                tone="info"
                message="Testing uses the saved provider configuration. Save your changes first if you edited the URL or secret."
              />

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" busy={testing} disabled={!form.tokenUrl} onClick={test}>
                  <TestTube2 className="h-4 w-4" />
                  Test connection
                </Button>
                <Button busy={saving} onClick={save}>
                  <Save className="h-4 w-4" />
                  Save provider
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid content-start gap-5">
            <Card>
              <CardHeader
                eyebrow="Status"
                title="Provider health"
                action={<ShieldCheck className="h-5 w-5 text-success" />}
              />
              <div className="grid gap-2 p-4">
                {[
                  ['Token endpoint', form.tokenUrl ? 'Configured' : 'Missing', form.configured],
                  ['Shared secret', form.hasSecret ? 'Stored' : 'Not set', form.hasSecret],
                  ['Timeout', `${form.timeoutMs ?? 3000} ms`, true],
                  ['Provider', 'external-token-service', true],
                ].map(([label, value, ok]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5"
                  >
                    <span className="text-[12px] text-muted-foreground">{label}</span>
                    <Badge tone={ok ? 'good' : 'warn'}>{value}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader eyebrow="Contract" title="Token request" description="What the provider receives." />
              <div className="p-4">
                <pre className="code-area overflow-x-auto rounded-lg border border-border p-3 text-[10.5px] leading-5 text-secondary-foreground">
{`POST ${form.tokenUrl || 'https://voice.example.com/token'}
Authorization: Bearer <shared secret>
Content-Type: application/json

{
  "channel": "match-123",
  "uid": 10000001,
  "role": "publisher"
}`}
                </pre>
                <ul className="mt-4 grid gap-2.5 text-[12px] leading-5 text-muted-foreground">
                  <li className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    The provider must return JSON with a non-empty <span className="font-mono text-foreground">token</span> string.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Non-2xx responses and timeouts are surfaced as errors in the dashboard.
                  </li>
                </ul>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
