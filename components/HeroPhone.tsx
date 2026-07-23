/** Mockup del POS: ancla visual del hero (sin captura real de la app). */
export default function HeroPhone() {
  return (
    <div className="hero-phone" aria-hidden="true">
      <div className="phone-bezel">
        <div className="phone-notch" />
        <div className="phone-screen">
          <header className="pos-top">
            <img src="/logo.png" alt="" className="pos-logo" />
            <div>
              <strong>Taquería El Guero</strong>
              <span>Mesa 4 · Abierta</span>
            </div>
          </header>

          <ul className="pos-items">
            <li>
              <span>2× Tacos al pastor</span>
              <b>$70</b>
            </li>
            <li>
              <span>1× Horchata</span>
              <b>$35</b>
            </li>
            <li className="pos-item-new">
              <span>1× Quesadilla</span>
              <b>$45</b>
            </li>
          </ul>

          <div className="pos-total">
            <span>Total</span>
            <strong>$150</strong>
          </div>

          <button type="button" className="pos-pay" tabIndex={-1}>
            Cobrar
          </button>
        </div>
      </div>
    </div>
  );
}
