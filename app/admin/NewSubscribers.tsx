"use client";

import { useState } from "react";

export type NewSubDetail = {
  identity: string;
  isAccount: boolean;
  plan: string;
  platformLabel: string;
  platformClass: string;
  tenureLabel: string;
  tenureClass: string;
  appVersion: string;
  productCount: number;
  lastSeen: string;
  aiMonth: string;
  installId: string;
  accountKey: string | null;
  deviceCount: number;
};

export default function NewSubscribers({ items }: { items: NewSubDetail[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="panel">
      <h2>Se suscribieron hoy ({items.length})</h2>
      <p className="muted">
        Cuenta = tiene sesión (mismo ID en sucursales). Dispositivo = solo
        instaló y pagó sin cuenta. Toca una fila para ver el detalle.
      </p>
      <div className="sub-list">
        {items.map((n) => {
          const isOpen = open === n.identity;
          return (
            <div
              key={n.identity}
              className={`sub-card${isOpen ? " open" : ""}`}
            >
              <button
                type="button"
                className="sub-card-head"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : n.identity)}
              >
                <span className="sub-card-id" title={n.identity}>
                  {n.identity.slice(0, 8)}
                </span>
                <span
                  className={`sub-card-type pill ${n.isAccount ? "sub" : "off"}`}
                >
                  {n.isAccount ? "Cuenta" : "Dispositivo"}
                </span>
                <span className="sub-card-plan">{n.plan}</span>
                <span className={`sub-card-platform ${n.platformClass}`}>
                  {n.platformLabel}
                </span>
                <span className={`sub-card-chevron${isOpen ? " open" : ""}`}>
                  ▾
                </span>
              </button>
              <div className="sub-card-body" hidden={!isOpen}>
                <div className="sub-detail-grid">
                  <div>
                    <span className="sub-detail-l">Antigüedad</span>
                    <span className={n.tenureClass}>{n.tenureLabel}</span>
                  </div>
                  <div>
                    <span className="sub-detail-l">Última visita</span>
                    <span className="sub-detail-v">{n.lastSeen}</span>
                  </div>
                  <div>
                    <span className="sub-detail-l">Versión</span>
                    <span className="sub-detail-v">{n.appVersion}</span>
                  </div>
                  <div>
                    <span className="sub-detail-l">Productos</span>
                    <span className="sub-detail-v">{n.productCount}</span>
                  </div>
                  <div>
                    <span className="sub-detail-l">IA (mes)</span>
                    <span className="sub-detail-v">{n.aiMonth}</span>
                  </div>
                  {n.isAccount && (
                    <div>
                      <span className="sub-detail-l">Equipos</span>
                      <span className="sub-detail-v">{n.deviceCount}</span>
                    </div>
                  )}
                  <div>
                    <span className="sub-detail-l">ID dispositivo</span>
                    <span className="sub-detail-v mono" title={n.installId}>
                      {n.installId.slice(0, 8)}
                    </span>
                  </div>
                  {n.accountKey && (
                    <div>
                      <span className="sub-detail-l">Cuenta</span>
                      <span className="sub-detail-v mono" title={n.accountKey}>
                        {n.accountKey.slice(0, 8)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
