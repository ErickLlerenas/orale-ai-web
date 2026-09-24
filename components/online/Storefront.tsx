"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CartLine, Checkout, Menu, Product } from "@/lib/online/types";
import {
  money,
  quoteCart,
  whatsappOrder,
  demoPhoneNumber,
} from "@/lib/online/cart";
import styles from "./storefront.module.css";

function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      className={styles.dialog}
      ref={ref}
      onCancel={close}
      aria-label={title}
    >
      <header className={styles.dialogHeader}>
        <h2>{title}</h2>
        <button className={styles.close} onClick={close} aria-label="Cerrar">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      <div className={styles.dialogBody}>{children}</div>
    </dialog>
  );
}
function ProductForm({
  product,
  add,
  close,
}: {
  product: Product;
  add: (line: CartLine) => void;
  close: () => void;
}) {
  const [variantId, setVariant] = useState(product.variants[0]?.id ?? "");
  const [choiceIds, setChoices] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const variant = product.variants.find((v) => v.id === variantId)!;
  const unit =
    variant.price +
    product.options
      .flatMap((o) => o.choices)
      .filter((c) => choiceIds.includes(c.id))
      .reduce((s, c) => s + c.price, 0);
  return (
    <Dialog title={product.name} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            product.options.some(
              (o) =>
                o.required && !o.choices.some((c) => choiceIds.includes(c.id)),
            )
          ) {
            setError("Selecciona las opciones obligatorias.");
            return;
          }
          add({ productId: product.id, variantId, choiceIds, quantity, notes });
        }}
      >
        {product.image && (
          <img
            className={styles.detailImage}
            src={product.image}
            alt={product.name}
          />
        )}
        {product.description && (
          <p className={styles.description}>{product.description}</p>
        )}
        {product.variants.length > 1 && (
          <fieldset>
            <legend>Presentación</legend>
            {product.variants.map((v) => (
              <label className={styles.option} key={v.id}>
                <span>
                  <input
                    type="radio"
                    name="variant"
                    checked={variantId === v.id}
                    onChange={() => setVariant(v.id)}
                  />
                  {v.name}
                </span>
                <b>{money(v.price)}</b>
              </label>
            ))}
          </fieldset>
        )}
        {product.options
          .filter((o) => o.choices.length)
          .map((o) => (
            <fieldset key={o.id}>
              <legend>
                {o.name}{" "}
                <small>
                  {o.required ? "Obligatorio" : "Opcional"}
                  {o.multiple ? " · Puedes elegir varios" : ""}
                </small>
              </legend>
              {!o.required && !o.multiple && (
                <label className={styles.option}>
                  <span>
                    <input
                      type="radio"
                      name={o.id}
                      checked={!o.choices.some((c) => choiceIds.includes(c.id))}
                      onChange={() =>
                        setChoices((ids) =>
                          ids.filter(
                            (id) => !o.choices.some((c) => c.id === id),
                          ),
                        )
                      }
                    />
                    Sin {o.name.toLowerCase()}
                  </span>
                </label>
              )}
              {o.choices.map((c) => (
                <label className={styles.option} key={c.id}>
                  <span>
                    <input
                      type={o.multiple ? "checkbox" : "radio"}
                      name={o.id}
                      checked={choiceIds.includes(c.id)}
                      onChange={(e) =>
                        setChoices((ids) => {
                          const next = o.multiple
                            ? ids.filter((id) => id !== c.id)
                            : ids.filter(
                                (id) => !o.choices.some((x) => x.id === id),
                              );
                          return e.target.checked ? [...next, c.id] : next;
                        })
                      }
                    />
                    {c.name}
                  </span>
                  <span>{c.price ? `+${money(c.price)}` : "Sin costo"}</span>
                </label>
              ))}
            </fieldset>
          ))}
        <label className={styles.field}>
          Notas para este producto
          <textarea
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Por ejemplo, sin cebolla"
          />
        </label>
        <label className={styles.field}>
          Cantidad
          <input
            type="number"
            min={1}
            max={Math.min(99, product.stock ?? 99)}
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <button className={styles.primary} type="submit">
          Agregar al carrito · {money(unit * quantity)}
        </button>
      </form>
    </Dialog>
  );
}

export default function Storefront({
  initialMenu,
  slug,
  preview = false,
}: {
  initialMenu: Menu;
  slug: string;
  preview?: boolean;
}) {
  const [menu, setMenu] = useState(initialMenu);
  const [selected, setSelected] = useState<Product | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState<Checkout>({
    name: "",
    fulfillment: "pickup",
    address: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demoPhone, setDemoPhone] = useState("");
  const [previewWhatsapp, setPreviewWhatsapp] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const catalog = menu.catalog;
  let quote: ReturnType<typeof quoteCart> | null = null;
  let cartError = "";
  try {
    if (lines.length) quote = quoteCart(catalog, lines);
  } catch (e) {
    cartError = e instanceof Error ? e.message : "Revisa tu carrito.";
  }
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  function changeLines(next: CartLine[]) {
    setLines(next);
    setWhatsapp(null);
    setError("");
  }
  async function prepare(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setWhatsapp(null);
    try {
      if (preview) {
        const result = whatsappOrder(
          { ...catalog, phone: demoPhoneNumber(demoPhone) },
          lines,
          checkout,
        );
        setPreviewWhatsapp(result.url);
        setPreviewMessage(result.message);
        setCartOpen(false);
        return;
      }
      const response = await fetch(`/api/menu/${slug}/pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: menu.revision, lines, checkout }),
      });
      const data = await response.json();
      if (data.menu) {
        setMenu(data.menu);
        if (
          checkout.fulfillment === "delivery" &&
          data.menu.catalog.acceptsDelivery !== true
        ) {
          setCheckout((current) => ({
            ...current,
            fulfillment: "pickup",
            address: "",
          }));
          throw new Error(
            "El negocio ahora solo acepta pedidos para recoger. Revisa tu pedido antes de continuar.",
          );
        }
      }
      if (!response.ok) throw new Error(data.error);
      // Navigation opens WhatsApp; the buyer still presses Send. Keep a
      // fallback link in case this browser cannot open the app.
      setWhatsapp(data.url);
      window.location.assign(data.url);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos preparar el pedido. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.store}>
      {preview && (
        <div className={styles.preview}>
          Vista previa · Menú de ejemplo · Prueba con tu propio WhatsApp
        </div>
      )}
      <header className={styles.header}>
        <div className={styles.eyebrow}>MENÚ EN LÍNEA</div>
        <h1>{catalog.name}</h1>
        {catalog.address && <p>{catalog.address}</p>}
        <div className={styles.intro}>
          Elige tus productos y envía tu pedido por WhatsApp.
        </div>
      </header>
      <nav className={styles.categories} aria-label="Categorías">
        {catalog.categories
          .filter((c) => catalog.products.some((p) => p.categoryId === c.id))
          .map((c) => (
            <a key={c.id} href={`#cat-${c.id}`}>
              {c.name}
            </a>
          ))}
      </nav>
      {!catalog.products.length && (
        <p className={styles.empty}>
          El negocio está preparando su menú. Vuelve pronto.
        </p>
      )}
      {catalog.categories.map((category) => {
        const products = catalog.products.filter(
          (p) => p.categoryId === category.id,
        );
        if (!products.length) return null;
        return (
          <section
            key={category.id}
            id={`cat-${category.id}`}
            className={styles.section}
          >
            <h2>{category.name}</h2>
            <div className={styles.products}>
              {products.map((p) => (
                <button
                  disabled={!p.available}
                  className={styles.product}
                  key={p.id}
                  onClick={() => setSelected(p)}
                  aria-label={`Elegir ${p.name}`}
                >
                  <div className={styles.productCopy}>
                    <h3>{p.name}</h3>
                    {p.description && <p>{p.description}</p>}
                    <strong>
                      {p.available
                        ? `${p.variants.length > 1 ? "Desde " : ""}${money(Math.min(...p.variants.map((v) => v.price)))}`
                        : "Agotado"}
                    </strong>
                  </div>
                  {(p.image || p.available) && (
                    <span
                      className={
                        p.image ? styles.productVisual : styles.productAction
                      }
                    >
                      {p.image && (
                        <img
                          src={p.image}
                          alt={p.name}
                          loading="lazy"
                          width={112}
                          height={112}
                        />
                      )}
                      {p.available && (
                        <span className={styles.plus} aria-hidden="true">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M12 5v14M5 12h14"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <footer className={styles.footer}>
        Menú creado con <a href="/">Órale AI</a>
        <p>
          El negocio confirma disponibilidad, pago y tiempo de entrega por
          WhatsApp.
        </p>
      </footer>
      {!!count && (
        <div className={styles.cartBar}>
          <button className={styles.primary} onClick={() => setCartOpen(true)}>
            <span>
              {count} {count === 1 ? "producto" : "productos"} · Ver carrito
            </span>
            <span>{quote ? money(quote.total) : "Revisar"}</span>
          </button>
        </div>
      )}
      {selected && (
        <ProductForm
          product={selected}
          close={() => setSelected(null)}
          add={(line) => {
            changeLines([...lines, line]);
            setSelected(null);
          }}
        />
      )}
      {cartOpen && (
        <Dialog title="Tu pedido" close={() => setCartOpen(false)}>
          <form onSubmit={prepare}>
            {!lines.length && <p>Tu carrito está vacío.</p>}
            {lines.map((line, index) => {
              const p = catalog.products.find((p) => p.id === line.productId);
              const v = p?.variants.find((v) => v.id === line.variantId);
              const options =
                p?.options
                  .flatMap((o) => o.choices)
                  .filter((c) => line.choiceIds.includes(c.id)) ?? [];
              return (
                <div className={styles.cartLine} key={index}>
                  <div>
                    <h3>{p?.name ?? "Producto no disponible"}</h3>
                    <p>
                      {v?.name}
                      {options.length
                        ? ` · ${options.map((c) => c.name).join(", ")}`
                        : ""}
                    </p>
                    {line.notes && <p>{line.notes}</p>}
                    <button
                      className={styles.remove}
                      type="button"
                      onClick={() =>
                        changeLines(lines.filter((_, i) => i !== index))
                      }
                    >
                      Quitar
                    </button>
                  </div>
                  <label>
                    Cantidad
                    <input
                      aria-label={`Cantidad de ${p?.name ?? "producto"}`}
                      type="number"
                      min={1}
                      max={99}
                      value={line.quantity}
                      onChange={(e) =>
                        changeLines(
                          lines.map((l, i) =>
                            i === index
                              ? { ...l, quantity: Number(e.target.value) }
                              : l,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              );
            })}
            {cartError && (
              <p role="alert" className={styles.error}>
                {cartError}
              </p>
            )}
            {quote && (
              <div className={styles.totals}>
                <p>
                  <span>Productos</span>
                  <span>{money(quote.subtotal)}</span>
                </p>
                {quote.discount > 0 && (
                  <p>
                    <span>{quote.promotion}</span>
                    <span>−{money(quote.discount)}</span>
                  </p>
                )}
                <p>
                  <strong>Total de productos</strong>
                  <strong>{money(quote.total)}</strong>
                </p>
                {checkout.fulfillment === "delivery" && (
                  <small>El negocio te confirmará el costo de envío.</small>
                )}
              </div>
            )}
            {!!lines.length && (
              <>
                {preview && (
                  <label className={styles.field}>
                    Tu WhatsApp de prueba
                    <input
                      type="tel"
                      autoComplete="tel"
                      required
                      maxLength={32}
                      placeholder="+52 5512345678"
                      value={demoPhone}
                      onChange={(e) => setDemoPhone(e.target.value)}
                      aria-describedby="demo-phone-hint"
                    />
                    <small id="demo-phone-hint">
                      Incluye el código de país. El pedido se dirigirá a este
                      número; no se guarda al salir de esta página.
                    </small>
                  </label>
                )}
                <label className={styles.field}>
                  Tu nombre
                  <input
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={checkout.name}
                    onChange={(e) => {
                      setCheckout({ ...checkout, name: e.target.value });
                      setWhatsapp(null);
                    }}
                  />
                </label>
                <fieldset>
                  <legend>
                    {catalog.acceptsDelivery === true
                      ? "¿Cómo quieres tu pedido?"
                      : "Pedido para recoger"}
                  </legend>
                  <div className={styles.fulfillment}>
                    {(catalog.acceptsDelivery === true
                      ? (["pickup", "delivery"] as const)
                      : (["pickup"] as const)
                    ).map((f) => (
                      <label key={f}>
                        <input
                          type="radio"
                          name="fulfillment"
                          checked={checkout.fulfillment === f}
                          onChange={() => {
                            setCheckout({ ...checkout, fulfillment: f });
                            setWhatsapp(null);
                          }}
                        />
                        {f === "pickup" ? "Pasar a recoger" : "A domicilio"}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {checkout.fulfillment === "delivery" && (
                  <label className={styles.field}>
                    Dirección y referencias
                    <textarea
                      autoComplete="street-address"
                      required
                      maxLength={500}
                      value={checkout.address}
                      onChange={(e) => {
                        setCheckout({ ...checkout, address: e.target.value });
                        setWhatsapp(null);
                      }}
                    />
                  </label>
                )}
                <p className={styles.notice}>
                  {preview
                    ? "Podrás revisar el mensaje y abrir WhatsApp con tu número de prueba. Presiona “Enviar” ahí para completar la prueba."
                    : "Tu pedido se envía cuando presionas “Enviar” en WhatsApp. Espera la confirmación del negocio."}
                </p>
                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                {whatsapp ? (
                  <a className={styles.whatsapp} href={whatsapp}>
                    Abrir WhatsApp y enviar pedido
                  </a>
                ) : (
                  <button
                    className={styles.primary}
                    type="submit"
                    disabled={busy || !!cartError}
                  >
                    {busy
                      ? "Revisando disponibilidad…"
                      : preview
                        ? "Ver mensaje de WhatsApp"
                        : "Continuar a WhatsApp"}
                  </button>
                )}
              </>
            )}
          </form>
        </Dialog>
      )}
      {preview && previewMessage && (
        <Dialog
          title="Así se vería en WhatsApp"
          close={() => {
            setPreviewMessage(null);
            setCartOpen(true);
          }}
        >
          <p className={styles.notice}>
            Pedido de ejemplo para tu número de prueba. Al abrir WhatsApp,
            presiona “Enviar” para mandarlo. En la tienda real, el destino será
            el WhatsApp del negocio.
          </p>
          <pre className={styles.messagePreview}>
            {previewMessage
              .split(/(\*[^*\n]+\*)/g)
              .map((part, index) =>
                part.startsWith("*") && part.endsWith("*") ? (
                  <strong key={index}>{part.slice(1, -1)}</strong>
                ) : (
                  part
                ),
              )}
          </pre>
          {previewWhatsapp && (
            <a
              className={styles.whatsapp}
              href={previewWhatsapp}
              target="_blank"
              rel="noreferrer"
            >
              Abrir WhatsApp con mi pedido
            </a>
          )}
          <button
            type="button"
            className={styles.previewBack}
            onClick={() => {
              setPreviewMessage(null);
              setCartOpen(true);
            }}
          >
            Volver a mi pedido
          </button>
        </Dialog>
      )}
    </main>
  );
}
