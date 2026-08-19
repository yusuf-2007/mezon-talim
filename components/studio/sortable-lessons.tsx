"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ContentFormState } from "@/lib/content/actions";
import { cn } from "@/lib/utils";

export type SortableLessonItem = {
  id: string;
  /** Plain-text title, for the drag handle's accessible name. */
  label: string;
  /** Server-rendered LessonRow (carries its own edit/delete/VQ actions). */
  node: React.ReactNode;
};

/**
 * Drag-to-reorder wrapper around the module's lesson rows.
 *
 * Lesson order *is* the curriculum: `getCurriculum` flattens lessons by
 * order_index to decide what a student may open next (sequential unlock, B2),
 * so a drop here changes the learning path, not just this list.
 *
 * The rows themselves stay server-rendered — they are passed in as `node` and
 * only reordered here — so the whole lesson editor (video questions, forms)
 * does not have to become client code to gain a drag handle.
 */
export function SortableLessons({
  items,
  action,
}: {
  items: SortableLessonItem[];
  action: (ids: string[]) => Promise<ContentFormState>;
}) {
  const t = useTranslations("Studio");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const listId = useId();

  // Server order is the source of truth; the optimistic layer only holds the
  // in-flight arrangement so the row does not snap back mid-request.
  const serverIds = items.map((i) => i.id);
  const [order, setOrder] = useOptimistic(serverIds);

  // A failed save leaves the server order authoritative, and the revalidation
  // re-renders these rows; nothing to reconcile by hand.
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as SortableLessonItem[];

  const sensors = useSensors(
    // A small distance gate keeps a click on "Edit"/"Delete" inside a row from
    // being swallowed as the start of a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commit(next: string[], movedId: string) {
    const from = order.indexOf(movedId);
    const to = next.indexOf(movedId);
    if (from === to) return;

    setError(null);
    const item = byId.get(movedId);
    if (item) {
      setStatus(t("reorderedTo", { title: item.label, position: to + 1 }));
    }
    startTransition(async () => {
      setOrder(next);
      const res = await action(next);
      if (res.error) setError(res.error);
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    commit(arrayMove(order, from, to), String(active.id));
  }

  /** Keyboard/button nudge — the same commit path as a drop. */
  function move(id: string, delta: -1 | 1) {
    const from = order.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    commit(arrayMove(order, from, to), id);
  }

  return (
    <div>
      <p id={`${listId}-hint`} className="mt-3 text-xs text-slate-500">
        {t("reorderHint")}
      </p>

      <DndContext
        // dnd-kit numbers its own a11y description ids from a module-level
        // counter, which starts fresh on the server and again in the browser —
        // with one context per module the two disagree and React reports a
        // hydration mismatch. A stable id per list removes the guesswork.
        id={`${listId}-dnd`}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul
            aria-describedby={`${listId}-hint`}
            className={cn("mt-2 space-y-2", pending && "opacity-70")}
          >
            {ordered.map((item, index) => (
              <SortableLessonRow
                key={item.id}
                item={item}
                index={index}
                total={ordered.length}
                onMove={move}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* Drag position is invisible to screen readers, so mirror each landing
          spot into a live region. */}
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
      {pending && <p className="mt-2 text-xs text-slate-500">{t("reorderSaving")}</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function SortableLessonRow({
  item,
  index,
  total,
  onMove,
}: {
  item: SortableLessonItem;
  index: number;
  total: number;
  onMove: (id: string, delta: -1 | 1) => void;
}) {
  const t = useTranslations("Studio");
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-start gap-2",
        isDragging && "relative z-10 opacity-90",
      )}
    >
      <div className="flex flex-col items-center gap-1 pt-3">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${t("reorderHandle")}: ${item.label}`}
          className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-slate-400 hover:bg-navy-50 hover:text-navy-600 focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:outline-none active:cursor-grabbing"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <circle cx="5.5" cy="3" r="1.4" />
            <circle cx="10.5" cy="3" r="1.4" />
            <circle cx="5.5" cy="8" r="1.4" />
            <circle cx="10.5" cy="8" r="1.4" />
            <circle cx="5.5" cy="13" r="1.4" />
            <circle cx="10.5" cy="13" r="1.4" />
          </svg>
        </button>
        {/* Pointer-free fallback: dnd-kit's keyboard sensor needs the handle
            focused and held, which is awkward; these are unambiguous. */}
        <MoveButton
          label={t("reorderMoveUp")}
          disabled={index === 0}
          onClick={() => onMove(item.id, -1)}
          d="M8 4l4 5H4z"
        />
        <MoveButton
          label={t("reorderMoveDown")}
          disabled={index === total - 1}
          onClick={() => onMove(item.id, 1)}
          d="M8 12L4 7h8z"
        />
      </div>
      <div className="min-w-0 flex-1">{item.node}</div>
    </li>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  d,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  d: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-6 w-8 place-items-center rounded text-slate-400 hover:bg-navy-50 hover:text-navy-600 focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <path d={d} />
      </svg>
    </button>
  );
}
