import React, { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, LoaderCircle, Search } from 'lucide-react';
import { api, cn, useDebouncedValue } from './lib';
import { Input } from './components';

export default function ItemPicker({ value, onChange, disabled, placeholder = 'Search item name or ID' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ? String(value) : '');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebouncedValue(query, 220);

  useEffect(() => {
    if (!open) setQuery(value ? String(value) : '');
  }, [value, open]);

  useEffect(() => {
    if (!open || disabled) return undefined;
    let active = true;
    setLoading(true);
    api(`/item-catalog?q=${encodeURIComponent(debounced)}&pageSize=24`)
      .then((data) => {
        if (active) setItems(data.items || []);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debounced, open, disabled]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            disabled={disabled}
            value={query}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
            }}
            className="pl-9 pr-14"
            aria-label={placeholder}
          />
          {value > 0 && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
              {value}
            </span>
          )}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-[70] w-[var(--radix-popover-trigger-width)] min-w-[20rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover shadow-lift outline-none data-[state=open]:animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {loading && <LoaderCircle className="h-3 w-3 animate-spin" />}
              {loading ? 'Searching' : `${items.length} results`}
            </span>
            <span>Select an item</span>
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5 scrollbar-thin">
            {items.map((item) => {
              const selected = Number(value) === Number(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setQuery(item.name || String(item.id));
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted',
                    selected && 'bg-primary/10',
                  )}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-black/30">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain"
                        onError={(event) => {
                          event.currentTarget.style.visibility = 'hidden';
                        }}
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{item.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {item.type} · {item.rarity}
                    </span>
                  </span>
                  <span className="font-mono text-[10.5px] text-muted-foreground">{item.id}</span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}
            {!loading && !items.length && (
              <div className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">No matching items.</div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
