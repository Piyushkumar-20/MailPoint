"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import {
  formatAttendees,
  formatEventWhen,
  LinkifiedText,
} from "@/lib/display";
import { getWeekBounds } from "@/lib/week";
import { api } from "@/trpc/react";

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CalendarPanel({
  weekOffset,
  focusCreateSignal,
}: {
  /** Which week to show, relative to the current week (0 = this week). Controlled by the header nav. */
  weekOffset: number;
  /** Bump this number to scroll/focus the create-event form (triggered by the header "Create" button). */
  focusCreateSignal: number;
}) {
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const week = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);

  const defaultStart = new Date();
  defaultStart.setMinutes(0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setHours(defaultEnd.getHours() + 1);

  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState(toDatetimeLocalValue(defaultStart));
  const [end, setEnd] = useState(toDatetimeLocalValue(defaultEnd));
  const [attendees, setAttendees] = useState("");

  const createSectionRef = useRef<HTMLDivElement>(null);
  const summaryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusCreateSignal > 0) {
      createSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      summaryInputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCreateSignal]);

  const utils = api.useUtils();

  const events = api.calendar.searchEvents.useQuery({
    query: activeSearch,
    weekStart: week.start.toISOString(),
    weekEnd: week.end.toISOString(),
    limit: 50,
    offset: 0,
  });

  const refreshEvents = api.calendar.refreshEvents.useMutation({
    onSuccess: async () => {
      await utils.calendar.searchEvents.invalidate();
    },
  });

  const createDraft = api.calendar.createDraft.useMutation({
    onSuccess: async () => {
      await utils.calendar.searchEvents.invalidate();
      resetForm();
    },
  });

  const sendInvite = api.calendar.sendInvite.useMutation({
    onSuccess: async () => {
      await utils.calendar.searchEvents.invalidate();
      resetForm();
    },
  });

  function resetForm() {
    setSummary("");
    setDescription("");
    setLocation("");
    setAttendees("");
  }

  function parseAttendees() {
    return attendees
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
  }

  function toIso(datetimeLocal: string) {
    return new Date(datetimeLocal).toISOString();
  }

  const eventInput = {
    summary,
    description: description || undefined,
    location: location || undefined,
    start: toIso(start),
    end: toIso(end),
    attendees: parseAttendees(),
  };

  const inputClass =
    "h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#6E56CF]/50 focus:outline-none";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            refreshEvents.mutate({
              weekStart: week.start.toISOString(),
              weekEnd: week.end.toISOString(),
            })
          }
          disabled={refreshEvents.isPending}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshEvents.isPending ? "animate-spin" : ""}`}
          />
          {refreshEvents.isPending ? "Refreshing…" : "Refresh from calendar"}
        </button>
        {refreshEvents.data && (
          <span className="text-xs text-zinc-600">
            {refreshEvents.data.synced} synced
          </span>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setActiveSearch(search);
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events"
          className={inputClass}
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-white/[0.08] px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
        >
          Search
        </button>
        {activeSearch && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActiveSearch("");
            }}
            className="shrink-0 text-sm text-zinc-500 hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </form>

      <div>
        {events.isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
        {events.error && (
          <p className="text-sm text-red-400">{events.error.message}</p>
        )}

        {events.data && (
          <>
            {events.data.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.08] py-12 text-center">
                <p className="text-sm text-zinc-500">No events this week.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {events.data.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    {event.htmlLink ? (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-zinc-100 hover:text-[#B4A4F0]"
                      >
                        {event.summary || "Untitled"}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-zinc-100">
                        {event.summary || "Untitled"}
                      </span>
                    )}
                    {event.start && (
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatEventWhen(event.start, event.end)}
                      </p>
                    )}
                    {event.location && (
                      <p className="text-xs text-zinc-500">
                        {event.location}
                      </p>
                    )}
                    {event.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">
                        <LinkifiedText text={event.description} />
                      </p>
                    )}
                    {event.attendees.length > 0 && (
                      <p className="mt-2 text-xs text-zinc-500">
                        {formatAttendees(event.attendees)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div
        id="create-event-section"
        ref={createSectionRef}
        className="scroll-mt-20 rounded-lg border border-white/[0.06] bg-white/[0.02] p-5"
      >
        <h2 className="mb-3 text-sm font-semibold text-zinc-100">
          Create event
        </h2>

        <div className="flex flex-col gap-3">
          <input
            ref={summaryInputRef}
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Title"
            className={inputClass}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            className="resize-none rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#6E56CF]/50 focus:outline-none"
          />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className={inputClass}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Start
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              End
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <input
            type="text"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            placeholder="Attendees (comma-separated)"
            className={inputClass}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => createDraft.mutate(eventInput)}
              disabled={createDraft.isPending || !summary || !start || !end}
              className="rounded-md border border-white/[0.08] px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              {createDraft.isPending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => sendInvite.mutate(eventInput)}
              disabled={
                sendInvite.isPending ||
                !summary ||
                !start ||
                !end ||
                parseAttendees().length === 0
              }
              className="rounded-md bg-[#6E56CF] px-3 py-1.5 text-sm text-white hover:bg-[#7C6BDB] disabled:opacity-50"
            >
              {sendInvite.isPending ? "Sending…" : "Send invite"}
            </button>
          </div>

          {(createDraft.error ?? sendInvite.error) && (
            <p className="text-sm text-red-400">
              {(createDraft.error ?? sendInvite.error)?.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
