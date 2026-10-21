import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, ChevronsUpDown, RotateCw } from 'lucide-react';
import { Skeleton } from '../common/Skeleton.js';

export type Density = 'comfortable' | 'compact';
type SortDir = 'asc' | 'desc';

export interface GridColumn<T> {
  key: string;
  label: string;
  /** Minimum width in px. */
  width?: number;
  align?: 'left' | 'right';
  /** Provide a value to make the column sortable. */
  sortValue?: (row: T) => string | number | null;
  render: (row: T) => React.ReactNode;
  /** Inline editing: Enter, F2 or double-click opens the editor, Enter saves, Esc cancels. */
  edit?: {
    type?: 'text' | 'tel' | 'email' | 'number' | 'datetime-local';
    initial: (row: T) => string;
    save: (row: T, value: string) => Promise<void>;
    validate?: (value: string) => string | null;
    placeholder?: string;
    ariaLabel?: string;
  };
  /** A popover opened with Enter or click (status pills, agent picker, ...). */
  menu?: (row: T, close: () => void) => React.ReactNode;
}

interface DataGridProps<T> {
  columns: Array<GridColumn<T>>;
  rows: T[];
  getId: (row: T) => string;
  /** Name shown to screen readers. */
  label: string;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Enter on the first data column, or the open button, opens the row. */
  onOpenRow?: (row: T) => void;
  density?: Density;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: React.ReactNode;
  /** Initial sort. */
  defaultSort?: { key: string; dir: SortDir };
}

const ROW_PX: Record<Density, string> = { comfortable: 'h-10', compact: 'h-8' };

/**
 * A keyboard-first data grid: click or arrow keys to move between cells, Enter / F2 / double-click to edit,
 * Esc to cancel, sortable headers (asc, desc, off), row checkboxes, sticky header and a loading / error state.
 */
export function DataGrid<T>({ columns, rows, getId, label, selectedIds = [], onSelectionChange, onOpenRow, density = 'comfortable', loading, error, onRetry, empty, defaultSort }: DataGridProps<T>) {
  const selectable = Boolean(onSelectionChange);
  const offset = selectable ? 1 : 0; // column 0 is the checkbox when selection is on
  const colCount = columns.length + offset;

  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(defaultSort ?? null);
  const [active, setActive] = useState<{ r: number; c: number }>({ r: 0, c: offset });
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [menu, setMenu] = useState<{ r: number; c: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const shouldFocus = useRef(false);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1; // empty values always last
      if (y === null) return -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [rows, columns, sort]);

  // Keep the active cell inside the data when rows change
  useEffect(() => {
    setActive(a => ({ r: Math.min(a.r, Math.max(0, sorted.length - 1)), c: a.c }));
    setEditing(null);
    setMenu(null);
  }, [sorted.length]);

  // Move DOM focus to the active cell after keyboard navigation
  useEffect(() => {
    if (!shouldFocus.current || editing) return;
    shouldFocus.current = false;
    root.current?.querySelector<HTMLElement>(`[data-r="${active.r}"][data-c="${active.c}"]`)?.focus();
  }, [active, editing]);

  const move = (r: number, c: number) => {
    shouldFocus.current = true;
    setActive({ r: Math.max(0, Math.min(sorted.length - 1, r)), c: Math.max(0, Math.min(colCount - 1, c)) });
  };

  const cycleSort = (key: string) =>
    setSort(s => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

  const toggleRow = (id: string) => onSelectionChange?.(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  const allSelected = sorted.length > 0 && sorted.every(r => selectedIds.includes(getId(r)));
  const toggleAll = () => onSelectionChange?.(allSelected ? [] : sorted.map(getId));

  const startEdit = useCallback((r: number, c: number, seed?: string) => {
    const col = columns[c - offset];
    const row = sorted[r];
    if (!col?.edit || !row) return;
    setActive({ r, c });
    setDraft(seed ?? col.edit.initial(row));
    setEditError(null);
    setEditing({ r, c });
  }, [columns, offset, sorted]);

  const cancelEdit = () => {
    shouldFocus.current = true;
    setEditing(null);
    setEditError(null);
  };

  const commitEdit = async () => {
    if (!editing || saving) return;
    const col = columns[editing.c - offset];
    const row = sorted[editing.r];
    if (!col?.edit || !row) return;
    if (draft === col.edit.initial(row)) return cancelEdit();
    const invalid = col.edit.validate?.(draft) ?? null;
    if (invalid) {
      setEditError(invalid);
      return;
    }
    setSaving(true);
    try {
      await col.edit.save(row, draft);
      cancelEdit();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (editing || sorted.length === 0) return;
    const { r, c } = active;
    const target = e.target as HTMLElement;
    if (target.closest('[data-popover]') || (target.tagName === 'INPUT' && target.getAttribute('type') !== 'checkbox')) return;
    const col = columns[c - offset];
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(r + 1, c); break;
      case 'ArrowUp': e.preventDefault(); move(r - 1, c); break;
      case 'ArrowRight': e.preventDefault(); move(r, c + 1); break;
      case 'ArrowLeft': e.preventDefault(); move(r, c - 1); break;
      case 'Home': e.preventDefault(); move(e.ctrlKey ? 0 : r, 0); break;
      case 'End': e.preventDefault(); move(e.ctrlKey ? sorted.length - 1 : r, colCount - 1); break;
      case 'PageDown': e.preventDefault(); move(r + 10, c); break;
      case 'PageUp': e.preventDefault(); move(r - 10, c); break;
      case ' ':
        if (selectable) {
          e.preventDefault();
          toggleRow(getId(sorted[r]!));
        }
        break;
      case 'F2':
        e.preventDefault();
        startEdit(r, c);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectable && c === 0) toggleRow(getId(sorted[r]!));
        else if (col?.edit) startEdit(r, c);
        else if (col?.menu) setMenu({ r, c });
        else if (onOpenRow) onOpenRow(sorted[r]!);
        break;
      case 'Escape':
        setMenu(null);
        break;
      default:
        break;
    }
  };

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-10 text-center">
        <AlertCircle aria-hidden className="h-6 w-6 text-danger" />
        <p className="text-sm font-semibold text-text">Could not load this list</p>
        <p className="max-w-sm text-sm text-text-muted">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover">
            <RotateCw className="h-4 w-4" /> Retry
          </button>
        )}
      </div>
    );
  }

  const cellPad = density === 'compact' ? 'px-3' : 'px-4';

  return (
    <div ref={root} className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="max-h-[calc(100vh-20rem)] min-h-[200px] overflow-auto">
        <table role="grid" aria-label={label} aria-rowcount={sorted.length + 1} aria-colcount={colCount} aria-busy={loading || undefined} className="w-full border-separate border-spacing-0 text-[13px]" onKeyDown={onGridKeyDown}>
          <thead>
            <tr role="row" className="h-10">
              {selectable && (
                <th role="columnheader" scope="col" className="sticky top-0 z-10 w-10 border-b border-border bg-surface-2 px-3">
                  <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={toggleAll} disabled={sorted.length === 0} className="h-4 w-4 rounded border-border accent-[rgb(var(--accent-rgb))]" />
                </th>
              )}
              {columns.map(col => {
                const dir = sort?.key === col.key ? sort.dir : null;
                return (
                  <th
                    key={col.key}
                    role="columnheader"
                    scope="col"
                    aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : col.sortValue ? 'none' : undefined}
                    style={{ minWidth: col.width }}
                    className={`sticky top-0 z-10 whitespace-nowrap border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wide text-text-muted ${cellPad} ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {col.sortValue ? (
                      <button type="button" onClick={() => cycleSort(col.key)} className="inline-flex items-center gap-1 uppercase hover:text-text">
                        {col.label}
                        {dir === 'asc' ? <ArrowUp aria-hidden className="h-3 w-3 text-accent" /> : dir === 'desc' ? <ArrowDown aria-hidden className="h-3 w-3 text-accent" /> : <ChevronsUpDown aria-hidden className="h-3 w-3 opacity-40" />}
                        <span className="sr-only">{dir ? `, sorted ${dir === 'asc' ? 'ascending' : 'descending'}` : ', not sorted'}</span>
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} role="row" className={ROW_PX[density]}>
                  {Array.from({ length: colCount }).map((__, j) => (
                    <td key={j} className={`border-b border-border-subtle ${cellPad}`}><Skeleton className="h-3.5 w-full max-w-[140px]" /></td>
                  ))}
                </tr>
              ))}
            {!loading &&
              sorted.map((row, r) => {
                const id = getId(row);
                const isSelected = selectedIds.includes(id);
                return (
                  <tr key={id} role="row" aria-rowindex={r + 2} aria-selected={isSelected} className={`${ROW_PX[density]} transition-colors ${isSelected ? 'bg-accent-soft/50' : 'hover:bg-surface-2/60'}`}>
                    {selectable && (
                      <td
                        role="gridcell"
                        data-r={r}
                        data-c={0}
                        tabIndex={active.r === r && active.c === 0 ? 0 : -1}
                        aria-colindex={1}
                        onClick={() => setActive({ r, c: 0 })}
                        className="w-10 border-b border-border-subtle px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                      >
                        <input type="checkbox" tabIndex={-1} aria-label={`Select row ${r + 1}`} checked={isSelected} onChange={() => toggleRow(id)} className="h-4 w-4 rounded border-border accent-[rgb(var(--accent-rgb))]" />
                      </td>
                    )}
                    {columns.map((col, ci) => {
                      const c = ci + offset;
                      const isActive = active.r === r && active.c === c;
                      const isEditing = editing?.r === r && editing.c === c;
                      return (
                        <td
                          key={col.key}
                          role="gridcell"
                          data-r={r}
                          data-c={c}
                          aria-colindex={c + 1}
                          aria-selected={isActive}
                          tabIndex={isActive ? 0 : -1}
                          onClick={() => {
                            setActive({ r, c });
                            if (col.menu) setMenu({ r, c });
                          }}
                          onDoubleClick={() => col.edit && startEdit(r, c)}
                          style={{ minWidth: col.width }}
                          className={`relative border-b border-border-subtle ${cellPad} ${col.align === 'right' ? 'text-right' : 'text-left'} text-text focus:outline-none ${isActive ? 'ring-2 ring-inset ring-accent' : ''}`}
                        >
                          {isEditing && col.edit ? (
                            <div>
                              <input
                                autoFocus
                                aria-label={col.edit.ariaLabel ?? `Edit ${col.label}`}
                                aria-invalid={editError ? true : undefined}
                                type={col.edit.type ?? 'text'}
                                value={draft}
                                placeholder={col.edit.placeholder}
                                disabled={saving}
                                onChange={e => setDraft(e.target.value)}
                                onKeyDown={e => {
                                  e.stopPropagation();
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void commitEdit();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelEdit();
                                  }
                                }}
                                onBlur={() => void commitEdit()}
                                className="w-full rounded-md border border-accent bg-surface px-2 py-1 text-[13px] text-text focus:outline-none"
                              />
                              {editError && <p role="alert" className="absolute left-2 top-full z-30 mt-0.5 rounded-md bg-danger px-2 py-1 text-xs font-medium text-white shadow-lg">{editError}</p>}
                            </div>
                          ) : (
                            col.render(row)
                          )}
                          {menu?.r === r && menu.c === c && col.menu && (
                            <div data-popover className="dropdown-elevated absolute left-2 top-full z-30 mt-1 min-w-[180px] p-1" onKeyDown={e => e.key === 'Escape' && (e.stopPropagation(), setMenu(null))}>
                              {col.menu(row, () => {
                                setMenu(null);
                                shouldFocus.current = true;
                                setActive({ r, c });
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
        {!loading && sorted.length === 0 && <div className="border-t border-border">{empty}</div>}
      </div>
    </div>
  );
}
