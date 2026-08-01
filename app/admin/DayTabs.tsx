"use client";

import { useState } from "react";
import NewSubscribers, { type NewSubDetail } from "./NewSubscribers";

export type DayKpi = {
  v: number;
  l: string;
  tone: string;
};

export type DaySnapshot = {
  label: string;
  dateLabel: string;
  live?: boolean;
  kpis: DayKpi[];
  subscribers: NewSubDetail[];
};

export default function DayTabs({
  today,
  yesterday,
}: {
  today: DaySnapshot;
  yesterday: DaySnapshot;
}) {
  const [tab, setTab] = useState<"today" | "yesterday">("today");
  const day = tab === "today" ? today : yesterday;

  return (
    <section className="kpi-group day-group">
      <div className="segmented" role="tablist" aria-label="Día">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "today"}
          className={`segmented-btn${tab === "today" ? " active" : ""}`}
          onClick={() => setTab("today")}
        >
          {today.live && <span className="live-dot" />}
          Hoy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "yesterday"}
          className={`segmented-btn${tab === "yesterday" ? " active" : ""}`}
          onClick={() => setTab("yesterday")}
        >
          Ayer
        </button>
      </div>

      <div className="day-panel">
        <p className="day-panel-date">{day.dateLabel}</p>
        <div className="kpis today-kpis">
          {day.kpis.map((k) => (
            <div className={`kpi today-kpi tone-${k.tone}`} key={k.l}>
              <div className="kpi-top">
                <span className="kpi-dot" />
                <span className="l">{k.l}</span>
              </div>
              <div className="v">{k.v}</div>
            </div>
          ))}
        </div>
      </div>

      {day.subscribers.length > 0 && (
        <NewSubscribers
          key={tab}
          items={day.subscribers}
          title={`Se suscribieron ${tab === "today" ? "hoy" : "ayer"}`}
        />
      )}
    </section>
  );
}
