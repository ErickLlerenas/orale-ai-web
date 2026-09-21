import TabletFrame from "@/components/TabletFrame";

const products = [
  { name: "Tacos al pastor", price: "$35" },
  { name: "Horchata", price: "$35" },
  { name: "Quesadilla", price: "$45" },
];

/** Demostración ilustrativa: foto, importación con IA y primera venta. */
export default function HeroTablet() {
  return (
    <div className="hero-tablet" aria-hidden="true">
      <TabletFrame>
        <header className="pos-top">
          <img src="/logo.png" alt="" className="pos-logo" />
          <div><strong>Taquería El Güero</strong><span>Tu negocio, listo para vender</span></div>
        </header>
        <div className="menu-demo">
          <div className="demo-stage demo-photo">
            <span className="demo-label">1 · Fotografía tu menú</span>
            <div className="demo-paper">
              <small>TAQUERÍA EL GÜERO</small><h3>Menú</h3>
              {products.map((p) => <div key={p.name}><span>{p.name}</span><b>{p.price}</b></div>)}
              <span className="demo-scan" />
            </div>
            <p className="demo-caption">Una foto. Sin capturar todo a mano.</p>
          </div>
          <div className="demo-stage demo-import">
            <span className="demo-label">2 · La IA carga tus productos</span>
            <div className="demo-ai-status"><span>✦</span> Leyendo productos y precios…</div>
            <ul className="pos-items">
              {products.map((p, i) => <li className={`demo-product demo-product-${i}`} key={p.name}><span>{p.name}</span><b>{p.price}</b></li>)}
            </ul>
            <p className="demo-ready">✓ Menú cargado · Tú revisas</p>
          </div>
          <div className="demo-stage demo-sale">
            <span className="demo-label">3 · Empieza a cobrar</span>
            <ul className="pos-items">
              <li><span>2× Tacos al pastor</span><b>$70</b></li>
              <li><span>1× Horchata</span><b>$35</b></li>
              <li><span>1× Quesadilla</span><b>$45</b></li>
            </ul>
            <div className="pos-total"><span>Total</span><strong>$150</strong></div>
            <div className="pos-pay">Cobrar</div>
          </div>
        </div>
      </TabletFrame>
    </div>
  );
}
