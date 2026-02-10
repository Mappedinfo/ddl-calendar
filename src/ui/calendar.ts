import { DateTime } from "luxon";
import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import luxon3Plugin from "@fullcalendar/luxon3";
import type { NormalizedItem } from "../domain/types";

export function mountCalendar(
  root: HTMLElement,
  opts: { onOpen: (id: string) => void }
) {
  let items: NormalizedItem[] = [];

  const cal = new Calendar(root, {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxon3Plugin],
    initialView: "dayGridMonth",
    height: "auto",
    timeZone: "UTC",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,listMonth",
    },
    eventClick: (info) => {
      const id = (info.event.extendedProps as any)?.id as string | undefined;
      if (id) opts.onOpen(id);
    },
    eventDidMount: (arg) => {
      // Slightly richer hover title
      const ex: any = arg.event.extendedProps;
      const t = `${arg.event.title}\n${ex.venue}\n${ex.deadlineUtc}`;
      arg.el.setAttribute("title", t);
    },
    events: [],
  });

  cal.render();

  function setItems(next: NormalizedItem[]) {
    items = next;
    // Replace event source reliably (function-style sources require callback signatures).
    cal.batchRendering(() => {
      for (const src of cal.getEventSources()) src.remove();
      cal.addEventSource(itemsToEvents(items));
    });
  }

  function updateSize() {
    cal.updateSize();
  }

  function focusOnIsoUtc(isoUtc: string) {
    const dt = DateTime.fromISO(isoUtc, { zone: "utc" });
    if (dt.isValid) cal.gotoDate(dt.toJSDate());
  }

  return { setItems, updateSize, focusOnIsoUtc };
}

function itemsToEvents(items: NormalizedItem[]) {
  return items.map((it) => {
    const dtUtc = DateTime.fromISO(it.deadlineIsoUtc, { zone: "utc" });
    const title = it.acronym ? `${it.acronym} ${it.year ?? ""}`.trim() : it.title;
    const hue = stableHue(it.venue);
    return {
      id: it.id,
      title,
      start: dtUtc.toISO(),
      allDay: false,
      backgroundColor: `hsla(${hue} 85% 55% / 0.20)`,
      borderColor: `hsla(${hue} 85% 55% / 0.55)`,
      textColor: "rgba(255,255,255,0.92)",
      extendedProps: {
        id: it.id,
        venue: it.venue,
        deadlineUtc: dtUtc.toFormat("yyyy-MM-dd HH:mm") + " UTC",
      },
    };
  });
}

function stableHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
