import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Activity,
  Bot,
  Eye,
  EyeOff,
  Flame,
  Gem,
  Gift,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Mic2,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { api, cn, initials } from './lib';
import { Button, Field, Input, Notice, StatusDot, useToast } from './components';
import Overview from './pages/Overview';
import Players from './pages/Players';
import Rewards from './pages/Rewards';
import Lobby from './pages/Lobby';
import Ads from './pages/Ads';
import GameModes from './pages/GameModes';
import Characters from './pages/Characters';
import Bots from './pages/Bots';
import Features from './pages/Features';
import JsonSettings from './pages/JsonSettings';
import ClientConfig from './pages/ClientConfig';
import Voice from './pages/Voice';

const navGroups = [
  {
    label: 'Operations',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard },
      { to: '/players', label: 'Players', icon: Users },
      { to: '/rewards', label: 'Player rewards', icon: Gift },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/lobby', label: 'Lobby content', icon: ImageIcon },
      { to: '/ads', label: 'Advertisements', icon: Sparkles },
    ],
  },
  {
    label: 'Gameplay',
    items: [
      { to: '/game-modes', label: 'Game modes', icon: MapIcon },
      { to: '/characters', label: 'Characters', icon: UserRound },
      { to: '/bots', label: 'Bots', icon: Bot },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/features', label: 'Feature switches', icon: ToggleLeft },
      { to: '/luck-royale', label: 'Luck Royale', icon: Gem },
      { to: '/client-config', label: 'Client configuration', icon: Settings2 },
      { to: '/voice', label: 'Voice chat', icon: Mic2 },
    ],
  },
];

const routes = navGroups.flatMap((group) => group.items);
const titleMap = Object.fromEntries(routes.map((item) => [item.to, item.label]));

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-ember">
        <Flame className="h-5 w-5" />
      </span>
      <span className={cn('leading-tight', compact && 'sr-only')}>
        <span className="block font-display text-[15px] font-semibold tracking-[-0.02em]">Shade Control</span>
        <span className="block font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
          Operations console
        </span>
      </span>
    </div>
  );
}

function Login({ onLogin, configured }) {
  const [user, setUser] = useState('admin');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: user, password }),
      });
      onLogin(data.user);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_.95fr]">
      <section className="panel-grid relative hidden overflow-hidden border-r border-border px-12 py-12 lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10">
          <Brand />
        </div>
        <div className="relative z-10 max-w-lg">
          <div className="eyebrow mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Administrator access
          </div>
          <h1 className="font-display text-[clamp(2.4rem,4vw,3.6rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
            Command the fire.
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-6 text-muted-foreground">
            One console for live players, matchmaking, lobby content, and gameplay configuration.
            Every change is validated by the server before it reaches a client.
          </p>
          <div className="mt-10 grid gap-3">
            {[
              { icon: Activity, title: 'Live telemetry', copy: 'Players, matches, and node health refresh automatically.' },
              { icon: ShieldCheck, title: 'Safe moderation', copy: 'Kick or ban with an audit reason attached to the action.' },
              { icon: Sparkles, title: 'Instant publishing', copy: 'Rewards, banners, and modes deploy without a restart.' },
            ].map(({ icon: Icon, title, copy }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border border-border/80 bg-card/50 p-3.5 backdrop-blur-sm">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[13px] font-semibold">{title}</div>
                  <div className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{copy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <StatusDot tone="good" pulse />
          Private server control plane
        </div>
        <div className="pointer-events-none absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full border border-primary/10 bg-primary/[0.04] blur-2xl" />
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <div className="mb-7">
            <div className="eyebrow mb-2.5">Secure sign in</div>
            <h2 className="font-display text-[2rem] font-semibold leading-none tracking-[-0.04em]">Welcome back</h2>
            <p className="mt-2.5 text-[13.5px] leading-6 text-muted-foreground">
              Authenticate to manage players, gameplay, and lobby content.
            </p>
          </div>

          {!configured && (
            <Notice
              tone="bad"
              className="mb-5"
              message="Admin login is not configured. Add ADMIN_PASSWORD to the server .env file and restart it."
            />
          )}

          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Username" htmlFor="login-user">
              <Input
                id="login-user"
                autoComplete="username"
                value={user}
                onChange={(event) => setUser(event.target.value)}
                required
              />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <div className="relative">
                <Input
                  id="login-password"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={reveal ? 'Hide password' : 'Show password'}
                  aria-pressed={reveal}
                  onClick={() => setReveal((value) => !value)}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {error && <Notice tone="bad" message={error} />}
            <Button type="submit" size="lg" busy={busy} className="mt-2 w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-[11.5px] leading-5 text-muted-foreground">
            Protected administration area. Sessions expire after 12 hours.
          </p>
        </div>
      </section>
    </main>
  );
}

function SidebarContent({ onNavigate, online }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-2">
        <Brand />
      </div>
      <nav className="mt-3 flex-1 space-y-4 overflow-y-auto pb-4 scrollbar-thin" aria-label="Primary">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
              {group.label}
            </div>
            <div className="grid gap-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} className="nav-item">
                  <Icon />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-2 rounded-xl border border-border bg-background/40 p-3">
        <div className="flex items-center gap-2">
          <StatusDot tone="good" pulse />
          <span className="text-[12px] font-semibold">Live control plane</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <span>{online != null ? `${online} online` : 'Connecting'}</span>
          <span>v1.0</span>
        </div>
      </div>
    </div>
  );
}

function MobileNav({ open, onOpenChange, online }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[3px] data-[state=open]:animate-fade-in lg:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-[86%] max-w-[300px] border-r border-border bg-card p-3 shadow-lift outline-none data-[state=open]:animate-slide-in-left lg:hidden">
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Admin console sections</DialogPrimitive.Description>
          <DialogPrimitive.Close asChild>
            <Button aria-label="Close navigation" variant="ghost" size="iconSm" className="absolute right-3 top-3">
              <X className="h-4 w-4" />
            </Button>
          </DialogPrimitive.Close>
          <SidebarContent onNavigate={() => onOpenChange(false)} online={online} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Shell({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [online, setOnline] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function tick() {
      try {
        const data = await api('/status?page=1&pageSize=10');
        if (active) setOnline(Number(data?.stats?.online) || 0);
      } catch {
        /* header telemetry is best-effort */
      }
    }
    tick();
    const timer = setInterval(tick, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== '/') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    const value = term.trim();
    navigate(value ? `/players?q=${encodeURIComponent(value)}` : '/players');
  }

  const title = titleMap[location.pathname] || 'Administration';

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-border bg-card/60 px-3 py-3 backdrop-blur-xl lg:block">
        <SidebarContent online={online} />
      </aside>

      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} online={online} />

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Button
              variant="ghost"
              size="iconSm"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/70">
                Console
                <span aria-hidden="true">/</span>
                <span className="text-primary/90">Shade</span>
              </div>
              <h1 className="truncate font-display text-[15px] font-semibold leading-tight tracking-tight">{title}</h1>
            </div>

            <form onSubmit={submitSearch} className="relative ml-auto hidden w-full max-w-xs md:block lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search players…"
                className="h-9 pl-9 pr-12 text-[13px]"
                aria-label="Search players"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                /
              </kbd>
            </form>

            <div className="ml-auto flex items-center gap-2 md:ml-0">
              <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:inline-flex">
                <StatusDot tone="good" pulse />
                <span className="text-[11.5px] font-semibold">Live</span>
                {online != null && (
                  <span className="font-mono text-[10.5px] text-muted-foreground">{online} online</span>
                )}
              </span>
              <div className="hidden items-center gap-2.5 border-l border-border pl-3 sm:flex">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-secondary font-mono text-[11px] font-semibold">
                  {initials(user, 'A')}
                </span>
                <span className="hidden leading-tight xl:block">
                  <span className="block max-w-32 truncate text-[12.5px] font-semibold">{user}</span>
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    Administrator
                  </span>
                </span>
              </div>
              <Button variant="secondary" size="iconSm" aria-label="Sign out" title="Sign out" onClick={onLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 pb-16 sm:px-6 lg:px-8 lg:py-8">
          <div key={location.pathname} className="page-enter">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/players" element={<Players />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/lobby" element={<Lobby />} />
              <Route path="/ads" element={<Ads />} />
              <Route path="/game-modes" element={<GameModes />} />
              <Route path="/characters" element={<Characters />} />
              <Route path="/bots" element={<Bots />} />
              <Route path="/features" element={<Features />} />
              <Route
                path="/luck-royale"
                element={
                  <JsonSettings
                    title="Luck Royale"
                    description="Configure draws, prize pools, pricing, and availability for the Luck Royale rotation."
                    endpoint="/luck-royale"
                    field="settings"
                  />
                }
              />
              <Route path="/client-config" element={<ClientConfig />} />
              <Route path="/voice" element={<Voice />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState({ loading: true, authenticated: false, configured: true, user: '' });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    api('/auth/session')
      .then((data) => setSession({ loading: false, ...data }))
      .catch((error) =>
        setSession({
          loading: false,
          authenticated: false,
          configured: error.data?.configured ?? error.status !== 503,
          user: '',
        }),
      );
  }, []);

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (error) {
      toast(error.message, { tone: 'bad' });
    } finally {
      setSession((current) => ({ ...current, authenticated: false, user: '' }));
      navigate('/');
    }
  }

  if (session.loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-ember">
            <Flame className="h-6 w-6" />
          </span>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Establishing secure session
          </div>
        </div>
      </div>
    );
  }

  if (!session.authenticated) {
    return (
      <Login
        configured={session.configured}
        onLogin={(user) => setSession({ loading: false, authenticated: true, configured: true, user })}
      />
    );
  }

  return <Shell user={session.user || 'admin'} onLogout={logout} />;
}
