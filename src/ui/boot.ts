import { DateTime } from "luxon";
import { loadYaml } from "../domain/load";
import type { NormalizedItem, SiteConfig } from "../domain/types";
import { humanizeCountdown } from "../domain/time";
import { mountCalendar } from "./calendar";

type ViewMode = "calendar" | "list";

export async function boot(root: HTMLElement) {
  root.innerHTML = `<div class="wrap">
    <div class="top">
      <div class="brand">
        <h1 class="title">DDL Calendar</h1>
        <div class="subtitle">Loading...</div>
      </div>
      <div class="controls">
        <div class="ctl">
          <label>Search</label>
          <input id="q" type="text" placeholder="title / venue / tag" />
        </div>
        <div class="ctl">
          <label>Venue</label>
          <select id="venue"><option value="">All</option></select>
        </div>
        <div class="ctl">
          <label>Tag</label>
          <select id="tag"><option value="">All</option></select>
        </div>
        <div class="ctl">
          <label>Show</label>
          <select id="scope">
            <option value="upcoming">Upcoming</option>
            <option value="all">All</option>
          </select>
        </div>
        <button id="reload" class="btn">Reload YAML</button>
      </div>
    </div>

    <div class="grid">
      <div class="panel">
        <div class="panelHead">
          <h2>Schedule</h2>
          <div class="tabs">
            <button class="tab" id="tabCal" data-active="true">Calendar</button>
            <button class="tab" id="tabList" data-active="false">List</button>
          </div>
        </div>
        <div class="panelBody">
          <div id="calendar"></div>
          <div id="list" style="display:none"></div>
        </div>
      </div>

      <div class="panel">
        <div class="panelHead">
          <h2>Upcoming (Top 20)</h2>
          <div class="small" id="tzHint"></div>
        </div>
        <div class="panelBody">
          <div id="side" class="list"></div>
          <div class="foot">
            <div id="footLeft"></div>
            <div id="footRight"></div>
          </div>
        </div>
      </div>
    </div>

    <div id="err" style="margin-top:14px; display:none" class="err"></div>
  </div>

  <div class="modalOverlay" id="modal" data-open="false" role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modalHead">
        <div>
          <h3 id="mTitle"></h3>
          <div class="small" id="mSub"></div>
        </div>
        <button class="btn" id="mClose">Close</button>
      </div>
      <div class="modalBody">
        <div class="modalGrid" id="mGrid"></div>
        <div style="margin-top:10px" class="small" id="mNote"></div>
      </div>
      <div class="modalActions">
        <a class="btn primary" id="mLink" target="_blank" rel="noreferrer">Open Link</a>
        <button class="btn" id="mCopy">Copy Deadline (UTC)</button>
      </div>
    </div>
  </div>`;

  const elTitle = root.querySelector(".title") as HTMLElement;
  const elSubtitle = root.querySelector(".subtitle") as HTMLElement;
  const elErr = root.querySelector("#err") as HTMLElement;

  const elQ = root.querySelector("#q") as HTMLInputElement;
  const elVenue = root.querySelector("#venue") as HTMLSelectElement;
  const elTag = root.querySelector("#tag") as HTMLSelectElement;
  const elScope = root.querySelector("#scope") as HTMLSelectElement;
  const elReload = root.querySelector("#reload") as HTMLButtonElement;

  const elTabCal = root.querySelector("#tabCal") as HTMLButtonElement;
  const elTabList = root.querySelector("#tabList") as HTMLButtonElement;
  const elCalendarWrap = root.querySelector("#calendar") as HTMLElement;
  const elListWrap = root.querySelector("#list") as HTMLElement;
  const elSide = root.querySelector("#side") as HTMLElement;

  const elTzHint = root.querySelector("#tzHint") as HTMLElement;
  const elFootLeft = root.querySelector("#footLeft") as HTMLElement;
  const elFootRight = root.querySelector("#footRight") as HTMLElement;

  let site: SiteConfig | undefined;
  let allItems: NormalizedItem[] = [];
  let viewMode: ViewMode = "calendar";

  const modal = mkModal(root);

  let calendarApi: ReturnType<typeof mountCalendar> | null = null;
  let didAutoFocus = false;

  async function reload() {
    try {
      elErr.style.display = "none";
      elSubtitle.textContent = "Loading YAML...";
      const yamlUrl = resolveDeadlinesUrl();
      const data = await loadYaml(yamlUrl);
      site = data.site;
      allItems = data.items;

      elTitle.textContent = site?.title || "DDL Calendar";
      elSubtitle.textContent = site?.subtitle || "Deadlines, synced from YAML";
      elFootLeft.textContent = site?.footer?.left || "";
      elFootRight.textContent = site?.footer?.right || "";

      rebuildFacetOptions(allItems, elVenue, elTag);
      render();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      elErr.style.display = "block";
      elErr.textContent = msg;
      elSubtitle.textContent = "Failed to load YAML";
    }
  }

  function getFiltered(): NormalizedItem[] {
    const q = elQ.value.trim().toLowerCase();
    const venue = elVenue.value;
    const tag = elTag.value;
    const scope = elScope.value as "upcoming" | "all";

    const nowUtc = DateTime.utc();
    return allItems.filter((it) => {
      if (scope === "upcoming") {
        const dt = DateTime.fromISO(it.deadlineIsoUtc, { zone: "utc" });
        if (dt <= nowUtc) return false;
      }
      if (venue && it.venue !== venue) return false;
      if (tag && !it.tags.includes(tag)) return false;
      if (!q) return true;
      const hay = `${it.title} ${it.acronym || ""} ${it.venue} ${(it.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function render() {
    const filtered = getFiltered();
    const nowUtc = DateTime.utc();
    const tzMode = site?.timezone || "UTC";
    elTzHint.textContent = `Default TZ: ${tzMode} | Now(UTC): ${nowUtc.toFormat("yyyy-MM-dd HH:mm")}`;

    // Side list: top 20 upcoming by deadline
    const sideItems = filtered
      .filter((it) => DateTime.fromISO(it.deadlineIsoUtc, { zone: "utc" }) > nowUtc)
      .slice(0, 20);
    elSide.innerHTML = sideItems.map((it) => renderCard(it, nowUtc)).join("");
    for (const el of Array.from(elSide.querySelectorAll("[data-open]"))) {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).getAttribute("data-open")!;
        const item = allItems.find((x) => x.id === id);
        if (item) modal.open(item);
      });
    }

    if (!calendarApi) {
      calendarApi = mountCalendar(elCalendarWrap, {
        onOpen: (id) => {
          const item = allItems.find((x) => x.id === id);
          if (item) modal.open(item);
        },
      });
    }
    calendarApi.setItems(filtered);
    // UX: the default month might not include the next deadline. Auto-jump once on first render.
    if (!didAutoFocus) {
      const next = filtered.find((it) => DateTime.fromISO(it.deadlineIsoUtc, { zone: "utc" }) > nowUtc);
      if (next) {
        calendarApi.focusOnIsoUtc(next.deadlineIsoUtc);
        didAutoFocus = true;
      }
    }

    renderList(elListWrap, filtered, nowUtc, (id) => {
      const item = allItems.find((x) => x.id === id);
      if (item) modal.open(item);
    });

    updateViewMode();
  }

  function updateViewMode() {
    elTabCal.dataset.active = String(viewMode === "calendar");
    elTabList.dataset.active = String(viewMode === "list");
    elCalendarWrap.style.display = viewMode === "calendar" ? "block" : "none";
    elListWrap.style.display = viewMode === "list" ? "block" : "none";
    calendarApi?.updateSize();
  }

  elQ.addEventListener("input", render);
  elVenue.addEventListener("change", render);
  elTag.addEventListener("change", render);
  elScope.addEventListener("change", render);
  elReload.addEventListener("click", reload);

  elTabCal.addEventListener("click", () => {
    viewMode = "calendar";
    updateViewMode();
  });
  elTabList.addEventListener("click", () => {
    viewMode = "list";
    updateViewMode();
  });

  await reload();
}

function resolveDeadlinesUrl(): string {
  const configuredUrl = import.meta.env.VITE_DEADLINES_URL;

  if (typeof configuredUrl === "string" && configuredUrl.trim() !== "") {
    return configuredUrl.trim();
  }

  return "deadlines.yaml";
}

function rebuildFacetOptions(items: NormalizedItem[], elVenue: HTMLSelectElement, elTag: HTMLSelectElement) {
  const venues = Array.from(new Set(items.map((x) => x.venue))).sort((a, b) => a.localeCompare(b));
  const tags = Array.from(new Set(items.flatMap((x) => x.tags))).sort((a, b) => a.localeCompare(b));

  const prevVenue = elVenue.value;
  const prevTag = elTag.value;

  elVenue.innerHTML = `<option value="">All</option>` + venues.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  elTag.innerHTML = `<option value="">All</option>` + tags.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");

  if (venues.includes(prevVenue)) elVenue.value = prevVenue;
  if (tags.includes(prevTag)) elTag.value = prevTag;
}

function renderCard(it: NormalizedItem, nowUtc: DateTime): string {
  const dUtc = DateTime.fromISO(it.deadlineIsoUtc, { zone: "utc" });
  const { label, state } = humanizeCountdown(nowUtc, dUtc);
  const when = dUtc.toFormat("yyyy-MM-dd HH:mm") + " UTC";
  const tags = it.tags.slice(0, 3).join(" · ");

  return `<div class="card">
    <div class="cardTop">
      <div>
        <p class="cardTitle">${esc(it.acronym ? `${it.acronym} ${it.year ?? ""}`.trim() : it.title)}</p>
        <div class="meta">
          <span class="pill">${esc(it.venue)}</span>
          ${tags ? `<span>${esc(tags)}</span>` : ""}
        </div>
      </div>
      <span class="kpi" data-state="${state}">${esc(label)}</span>
    </div>
    <div class="meta">
      <span><b>DDL</b> ${esc(when)}</span>
      <button class="btn" style="height:30px; padding:0 10px" data-open="${esc(it.id)}">Details</button>
    </div>
  </div>`;
}

function renderList(
  root: HTMLElement,
  items: NormalizedItem[],
  nowUtc: DateTime,
  onOpen: (id: string) => void
) {
  const rows = items.map((it) => {
    const dUtc = DateTime.fromISO(it.deadlineIsoUtc, { zone: "utc" });
    const { label, state } = humanizeCountdown(nowUtc, dUtc);
    const title = it.acronym ? `${it.acronym} ${it.year ?? ""}`.trim() : it.title;
    const tags = it.tags.join(", ");
    return `<div class="card">
      <div class="cardTop">
        <div>
          <p class="cardTitle">${esc(title)}</p>
          <div class="meta">
            <span class="pill">${esc(it.venue)}</span>
            ${tags ? `<span>${esc(tags)}</span>` : ""}
          </div>
        </div>
        <span class="kpi" data-state="${state}">${esc(label)}</span>
      </div>
      <div class="meta">
        <span><b>DDL</b> ${esc(dUtc.toFormat("yyyy-MM-dd HH:mm"))} UTC</span>
        ${it.url ? `<a class="btn" style="height:30px; padding:0 10px; text-decoration:none" href="${esc(it.url)}" target="_blank" rel="noreferrer">Link</a>` : ""}
        <button class="btn" style="height:30px; padding:0 10px" data-open="${esc(it.id)}">Details</button>
      </div>
    </div>`;
  });

  root.innerHTML = `<div class="list">${rows.join("")}</div>`;
  for (const el of Array.from(root.querySelectorAll("[data-open]"))) {
    el.addEventListener("click", () => onOpen((el as HTMLElement).getAttribute("data-open")!));
  }
}

function mkModal(root: HTMLElement) {
  const el = root.querySelector("#modal") as HTMLElement;
  const elTitle = root.querySelector("#mTitle") as HTMLElement;
  const elSub = root.querySelector("#mSub") as HTMLElement;
  const elGrid = root.querySelector("#mGrid") as HTMLElement;
  const elNote = root.querySelector("#mNote") as HTMLElement;
  const elLink = root.querySelector("#mLink") as HTMLAnchorElement;
  const elClose = root.querySelector("#mClose") as HTMLButtonElement;
  const elCopy = root.querySelector("#mCopy") as HTMLButtonElement;

  let current: NormalizedItem | null = null;

  function close() {
    el.dataset.open = "false";
    current = null;
  }

  function open(it: NormalizedItem) {
    current = it;
    const title = it.acronym ? `${it.acronym} ${it.year ?? ""}`.trim() : it.title;
    elTitle.textContent = title;
    elSub.textContent = `${it.venue}${it.location ? ` | ${it.location}` : ""}`;

    const dUtc = DateTime.fromISO(it.deadlineIsoUtc, { zone: "utc" });
    const dLocal = DateTime.fromISO(it.deadlineIsoUtc, { zone: "utc" }).setZone(it.timezone);

    elGrid.innerHTML = [
      kv("Deadline (UTC)", dUtc.toFormat("yyyy-MM-dd HH:mm") + " UTC"),
      kv("Deadline (Local)", dLocal.toFormat("yyyy-MM-dd HH:mm") + ` ${it.timezone}`),
      kv("Tags", it.tags.length ? it.tags.join(", ") : "-"),
      kv("ID", it.id),
      kv("URL", it.url || "-"),
      kv("Conference", it.start || it.end ? `${it.start || "?"} ~ ${it.end || "?"}` : "-"),
    ].join("");

    elNote.textContent = it.note || "";
    elLink.href = it.url || "#";
    elLink.style.pointerEvents = it.url ? "auto" : "none";
    elLink.style.opacity = it.url ? "1" : "0.55";
    el.dataset.open = "true";
  }

  elClose.addEventListener("click", close);
  el.addEventListener("click", (ev) => {
    if (ev.target === el) close();
  });
  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") close();
  });
  elCopy.addEventListener("click", async () => {
    if (!current) return;
    await navigator.clipboard.writeText(current.deadlineIsoUtc);
    elCopy.textContent = "Copied";
    setTimeout(() => (elCopy.textContent = "Copy Deadline (UTC)"), 900);
  });

  return { open, close };
}

function kv(k: string, v: string): string {
  return `<div class="kv"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
}

function esc(s: string): string {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
