import TabletFrame from "@/components/TabletFrame";

/** Animación Pro: caja + celulares de meseros + 2 impresoras de red. */
export default function ProSyncVisual() {
  return (
    <div className="pro-sync" aria-hidden="true">
      <div className="pro-net">
        <div className="pro-wifi" title="WiFi del local">
          <span className="wifi-arc a1" />
          <span className="wifi-arc a2" />
          <span className="wifi-arc a3" />
          <span className="wifi-dot" />
        </div>
        <span className="pro-net-label">Red del local</span>
      </div>

      <div className="pro-sync-top">
        <Printer label="Cocina" delayClass="p-delay-0" />

        <div className="pro-pad caja">
          <TabletFrame className="pro-caja-tablet">
            <div className="caja-head">
              <strong>Caja</strong>
              <span className="caja-live">En vivo</span>
            </div>
            <ul className="caja-orders">
              <li className="order o1">
                <span>Mesa 3 · 2 pastor</span>
                <b>Llegó</b>
              </li>
              <li className="order o2">
                <span>Mesa 7 · 1 horchata</span>
                <b>Llegó</b>
              </li>
              <li className="order o3">
                <span>Mesa 5 · 3 suadero</span>
                <b>Llegó</b>
              </li>
            </ul>
          </TabletFrame>
          <span className="pro-pad-caption">Tu tablet en caja</span>
        </div>

        <Printer label="Barra" delayClass="p-delay-1" />
      </div>

      <div className="pro-sync-flow">
        <span className="pro-sync-dot d1" />
        <span className="pro-sync-dot d2" />
        <span className="pro-sync-dot d3" />
      </div>

      <div className="pro-sync-meseros">
        {[
          { mesa: "Mesa 3", item: "2 pastor" },
          { mesa: "Mesa 7", item: "1 horchata" },
          { mesa: "Mesa 5", item: "3 suadero" },
        ].map((m, i) => (
          <div key={m.mesa} className={`pro-pad mesero delay-${i}`}>
            <div className="pro-pad-bezel">
              <div className="pro-pad-cam" />
              <div className="pro-pad-screen">
                <span className="pro-pad-title">{m.mesa}</span>
                <span className="pro-pad-item">{m.item}</span>
                <span className="pro-pad-chip">Enviar</span>
              </div>
            </div>
            <span className="pro-pad-caption">Mesero</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Printer({
  label,
  delayClass,
}: {
  label: string;
  delayClass: string;
}) {
  return (
    <div className={`pro-printer ${delayClass}`}>
      <div className="printer-body">
        <div className="printer-light" />
        <div className="printer-slot" />
        <div className="printer-ticket">
          <span className="ticket-lines" />
          <span className="ticket-lines short" />
          <span className="ticket-lines" />
        </div>
      </div>
      <span className="pro-pad-caption">{label}</span>
    </div>
  );
}
