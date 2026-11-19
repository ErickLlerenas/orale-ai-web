"use client";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CartLine, Checkout, Menu, Product, Catalog } from "@/lib/online/types";
import {
  checkoutPhone,
  money,
  missingRequiredOption,
  quoteCart,
  whatsappOrder,
  demoPhoneNumber,
  promotionActive,
  promotionLabel,
  promotionConditions,
  promotionSchedule,
  clock12,
  opensLabel,
  storeHours,
} from "@/lib/online/cart";
import {
  errorText,
  langStorageKey,
  translated,
  ui,
  type Lang,
} from "@/lib/online/i18n";
import styles from "./storefront.module.css";

const savedPhoneKey = "orale.menu.whatsapp";

const plusBadge = (
  <span className={styles.plus} aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  </span>
);

const smallWords: Record<Lang, Set<string>> = {
  es: new Set(["de", "del", "la", "las", "el", "los", "y", "e", "en", "con", "a"]),
  // En inglés quedan nombres en español («Tacos de Asada»): se respetan las dos.
  en: new Set([
    "of", "the", "and", "with", "in", "on", "or", "a", "an", "to", "for",
    "de", "del", "la", "las", "el", "los", "y", "al", "con",
  ]),
};
/** Textos escritos todo en mayúsculas (nombre, categorías, platillos,
 * opciones) se leen mejor así: «Menudo-Barbacoa-Birria de Borrego Don Gus».
 * Si el dueño usó mayúsculas y minúsculas, se respeta tal cual. El mensaje de
 * WhatsApp conserva los nombres como los escribió el dueño. */
function displayName(name: string, lang: Lang = "es") {
  const t = name.trim();
  if (t.length < 4 || t !== t.toUpperCase() || t === t.toLowerCase()) return t;
  return t
    .toLowerCase()
    .replace(/[\p{L}\p{N}]+/gu, (w, i: number) =>
      i > 0 && smallWords[lang].has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
    );
}

/** En qué idioma ve la página el comensal y cómo se dice cada cosa. */
type Words = {
  lang: Lang;
  /** Un texto fijo de la página. */
  t: (es: string, vars?: Record<string, string | number>) => string;
  /** Un texto del dueño (platillo, categoría, extra), traducido tal cual. */
  tr: (text: string) => string;
  /** Lo mismo, con mayúsculas legibles: para enseñarlo en pantalla. */
  name: (text: string) => string;
};
const spanish: Words = {
  lang: "es",
  t: (es, vars) => ui("es", es, vars),
  tr: (text) => text,
  name: (text) => displayName(text),
};
const WordsContext = createContext<Words>(spanish);
const useWords = () => useContext(WordsContext);
/** «INT.MERCADO MPAL. JESÚS MARÍA, AGS.LOCAL 4,5,8,» → sin coma final y con
 * espacio después de cada coma o punto. */
function cleanAddress(address: string) {
  return address
    .trim()
    .replace(/[\s,;.]+$/, "")
    .replace(/([,.])(?=[^\s\d])/g, "$1 ")
    .replace(/,(?=\d)/g, ", ")
    .replace(/\s+/g, " ");
}
const pinIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const deliveryIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="5.5" cy="18" r="2.5" />
    <circle cx="18.5" cy="18" r="2.5" />
    <path d="M8 18h8.5L13 4" />
    <path d="M11 4h4" />
    <path d="M3 13.5h7l1.5 4.5" />
  </svg>
);

const clockIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const pickupIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);


function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const { t } = useWords();
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      className={styles.dialog}
      ref={ref}
      onCancel={close}
      aria-label={title}
    >
      <div className={styles.dialogPanel}>
        <header className={styles.dialogHeader}>
          <h2>{title}</h2>
          <button className={styles.close} onClick={close} aria-label={t("Cerrar")}>
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
      </div>
    </dialog>
  );
}
function QuantityStepper({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) {
  const { t } = useWords();
  const cap = Math.max(1, Math.min(99, max));
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        aria-label={t("Disminuir")}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M4 9h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label={t("Aumentar")}
        disabled={value >= cap}
        onClick={() => onChange(value + 1)}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M9 4v10M4 9h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function ProductPromotions({ catalog, productId, now, detail = false }: {
  catalog: Catalog;
  productId: string;
  now: Date | null;
  detail?: boolean;
}) {
  const { lang, t, tr } = useWords();
  const offers = catalog.promotions.filter((p) =>
    p.productIds.includes(productId)
  );
  if (!offers.length) return null;
  return (
    <div className={styles.offers}>
      {offers.map((p) => {
        const active = now ? promotionActive(catalog, p, now) : null;
        return (
          <span className={`${styles.offer}${active === false ? ` ${styles.offerScheduled}` : ""}`} key={p.id}>
            <span className={styles.offerTitle}>
              {promotionLabel(p, lang)} · {tr(p.name)}
            </span>
            <span className={styles.offerTerms}>
              {detail
                ? promotionConditions(catalog, p, lang, tr)
                : promotionSchedule(p, lang)}
            </span>
            <span className={styles.offerStatus}>
              {active === null
                ? t("Consulta los días y horario")
                : active
                ? t("Disponible ahora")
                : t("Fuera de días u horario de promoción")}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function ProductForm({
  catalog,
  now,
  product,
  add,
  close,
}: {
  catalog: Catalog;
  now: Date | null;
  product: Product;
  add: (line: CartLine) => void;
  close: () => void;
}) {
  const { t, tr, name } = useWords();
  const [variantId, setVariant] = useState(product.variants[0]?.id ?? "");
  const [choiceIds, setChoices] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  // La opción obligatoria que faltó: se marca, se lleva a la vista y el aviso
  // sale junto al botón. Antes el aviso quedaba hasta abajo de la lista, fuera
  // de la vista, y parecía que el botón no hacía nada.
  const [missing, setMissing] = useState<string | null>(null);
  const [nudges, setNudges] = useState(0);
  const groups = useRef(new Map<string, HTMLFieldSetElement>());
  const variant = product.variants.find((v) => v.id === variantId)!;
  const unit =
    variant.price +
    product.options
      .flatMap((o) => o.choices)
      .filter((c) => choiceIds.includes(c.id))
      .reduce((s, c) => s + c.price, 0);
  return (
    <Dialog title={name(product.name)} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const option = missingRequiredOption(product, choiceIds);
          if (option) {
            setMissing(option.id);
            setError(
              t("Elige una opción de {name}", { name: name(option.name) }),
            );
            setNudges((n) => n + 1);
            const calm = window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            ).matches;
            groups.current.get(option.id)?.scrollIntoView({
              behavior: calm ? "auto" : "smooth",
              block: "start",
            });
            return;
          }
          add({ productId: product.id, variantId, choiceIds, quantity, notes });
        }}
      >
        {product.image && (
          <img
            className={styles.detailImage}
            src={product.image}
            alt={tr(product.name)}
          />
        )}
        {product.description && (
          <p className={styles.description}>{name(product.description)}</p>
        )}
        <ProductPromotions catalog={catalog} productId={product.id} now={now} detail />
        {product.variants.length > 1 && (
          <fieldset>
            <legend>{t("Presentación")}</legend>
            {product.variants.map((v) => (
              <label className={styles.option} key={v.id}>
                <span>
                  <input
                    type="radio"
                    name="variant"
                    checked={variantId === v.id}
                    onChange={() => setVariant(v.id)}
                  />
                  {name(v.name)}
                </span>
                <b>{money(v.price)}</b>
              </label>
            ))}
          </fieldset>
        )}
        {product.options
          .filter((o) => o.choices.length)
          .map((o) => (
            <fieldset
              key={o.id}
              ref={(el) => {
                if (el) groups.current.set(o.id, el);
                else groups.current.delete(o.id);
              }}
              className={missing === o.id ? styles.missing : undefined}
            >
              <legend>
                {name(o.name)}{" "}
                <small>
                  {o.required ? t("Obligatorio") : t("Opcional")}
                  {o.multiple ? ` · ${t("Puedes elegir varios")}` : ""}
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
                    {t("Sin {name}", { name: tr(o.name).toLowerCase() })}
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
                      onChange={(e) => {
                        if (e.target.checked && missing === o.id) {
                          setMissing(null);
                          setError("");
                        }
                        setChoices((ids) => {
                          const next = o.multiple
                            ? ids.filter((id) => id !== c.id)
                            : ids.filter(
                                (id) => !o.choices.some((x) => x.id === id),
                              );
                          return e.target.checked ? [...next, c.id] : next;
                        });
                      }}
                    />
                    {name(c.name)}
                  </span>
                  <span>{c.price ? `+${money(c.price)}` : t("Sin costo")}</span>
                </label>
              ))}
            </fieldset>
          ))}
        <label className={styles.field}>
          {t("Notas para este producto")}
          <textarea
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("Por ejemplo, sin cebolla")}
          />
        </label>
        {/* Fijo abajo: en un platillo con muchas opciones el botón quedaba
            hasta el final y había que bajar todo para encontrarlo. El aviso
            vive aquí por lo mismo. */}
        <div className={styles.formFooter}>
          {error && (
            <p role="alert" className={styles.footerAlert} key={`a${nudges}`}>
              {error}
            </p>
          )}
          <QuantityStepper
            value={quantity}
            max={product.stock ?? 99}
            label={t("Cantidad de {name}", { name: tr(product.name) })}
            onChange={setQuantity}
          />
          <button
            className={`${styles.primary}${nudges ? ` ${styles.shake}` : ""}`}
            type="submit"
            key={`b${nudges}`}
          >
            {t("Agregar · {price}", { price: money(unit * quantity) })}
          </button>
        </div>
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
    phone: "",
  });
  // El WhatsApp del último pedido a domicilio en este celular: el cliente no
  // lo vuelve a escribir. Sin acceso al almacenamiento, el campo sale vacío.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(savedPhoneKey) ?? "";
      if (saved) setCheckout((c) => (c.phone ? c : { ...c, phone: saved }));
    } catch {}
  }, []);
  // Idioma del comensal. Abre siempre en español; si antes eligió inglés en
  // este celular, se recuerda. La vista previa del dueño no cambia de idioma.
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    if (preview) return;
    try {
      if (window.localStorage.getItem(langStorageKey) === "en") setLang("en");
    } catch {}
  }, [preview]);
  function chooseLang(next: Lang) {
    setLang(next);
    try {
      window.localStorage.setItem(langStorageKey, next);
    } catch {}
  }
  // Para que el navegador no ofrezca traducir una página que ya está en inglés.
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "es-MX";
    return () => {
      document.documentElement.lang = "es-MX";
    };
  }, [lang]);
  // Los textos del dueño en inglés: «texto en español» → «texto en inglés».
  // El servidor los traduce la primera vez; mientras termina (pending) se
  // vuelve a pedir, y lo que falte se ve en español.
  const [translations, setTranslations] = useState<Record<string, unknown>>({});
  const [translating, setTranslating] = useState(false);
  const revision = menu.revision;
  useEffect(() => {
    if (lang !== "en" || preview) return;
    let cancelled = false;
    let timer = 0;
    const load = async (attempt: number) => {
      try {
        const response = await fetch(`/api/menu/${slug}/traduccion`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (cancelled) return;
        if (
          data?.translations &&
          typeof data.translations === "object" &&
          !Array.isArray(data.translations)
        ) {
          setTranslations(data.translations);
        }
        if (data?.pending === true && attempt < 3) {
          timer = window.setTimeout(() => load(attempt + 1), 4000);
          return;
        }
      } catch {}
      if (!cancelled) setTranslating(false);
    };
    setTranslating(true);
    load(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setTranslating(false);
    };
  }, [lang, preview, slug, revision]);
  const words = useMemo<Words>(() => {
    const tr = (text: string) => translated(lang, translations, text);
    return {
      lang,
      t: (es, vars) => ui(lang, es, vars),
      tr,
      name: (text) => displayName(tr(text), lang),
    };
  }, [lang, translations]);
  const { t, tr, name } = words;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [demoPhone, setDemoPhone] = useState("");
  const [previewWhatsapp, setPreviewWhatsapp] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const catalog = menu.catalog;
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  // Horario del dueño. Sin hora del cliente todavía (render del servidor) se
  // toma como abierto: el servidor igual rechaza un pedido fuera de horario.
  const hours = now ? storeHours(catalog, now) : null;
  const closedText = hours && !hours.open && now ? opensLabel(catalog, hours, now, lang) : null;
  // Categoría en pantalla: se resalta y su botón se centra en la barra.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categoryBar = useRef<HTMLElement>(null);
  useEffect(() => {
    // La activa es la última sección cuyo inicio ya pasó bajo la barra de
    // categorías; arriba del todo, la primera.
    let frame = 0;
    const update = () => {
      frame = 0;
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>("section[data-category]"),
      );
      if (!sections.length) return;
      const line = (categoryBar.current?.getBoundingClientRect().bottom ?? 0) + 24;
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section;
        else break;
      }
      setActiveCategory(current.getAttribute("data-category"));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [catalog]);
  useEffect(() => {
    const bar = categoryBar.current;
    const chip = activeCategory
      ? bar?.querySelector<HTMLElement>(`[data-chip="${activeCategory}"]`)
      : null;
    if (!bar || !chip) return;
    bar.scrollTo({
      left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2,
      behavior: "smooth",
    });
  }, [activeCategory]);
  let quote: ReturnType<typeof quoteCart> | null = null;
  let cartError = "";
  try {
    if (lines.length) quote = quoteCart(catalog, lines, now ?? new Date());
  } catch (e) {
    cartError = errorText(lang, e, tr, "Revisa tu carrito.");
  }
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  function changeLines(next: CartLine[]) {
    setLines(next);
    setWhatsapp(null);
    setError(null);
  }
  const orderRequest = useRef<{fingerprint: string; key: string} | null>(null);
  async function prepare(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
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
      // Las mismas reglas que el servidor, aquí, para que el comprador vea qué
      // corregir («Escribe tu WhatsApp a 10 dígitos.»). El servidor solo
      // regresa un aviso general.
      whatsappOrder(catalog, lines, checkout, now ?? new Date());
      const fingerprint = JSON.stringify({revision: menu.revision, lines, checkout});
      if (orderRequest.current?.fingerprint !== fingerprint) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        orderRequest.current = {fingerprint, key: Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")};
      }
      const response = await fetch(`/api/menu/${slug}/pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: menu.revision, lines, checkout, requestKey: orderRequest.current.key }),
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
      const phone = checkoutPhone(checkout);
      if (phone) {
        try {
          window.localStorage.setItem(savedPhoneKey, phone);
        } catch {}
      }
      // Navigation opens WhatsApp; the buyer still presses Send. Keep a
      // fallback link in case this browser cannot open the app.
      setWhatsapp(data.url);
      window.location.assign(data.url);
    } catch (e) {
      // Se guarda el aviso, no su texto: se enseña en el idioma del momento.
      setError(e instanceof Error ? e : new Error(""));
    } finally {
      setBusy(false);
    }
  }
  return (
    <WordsContext.Provider value={words}>
    <main className={styles.store}>
      {preview && (
        <div className={styles.preview}>
          Vista previa · Menú de ejemplo · Prueba con tu propio WhatsApp
        </div>
      )}
      <header className={styles.header}>
        <div className={styles.brand}>
          {catalog.logoImage && (
            <img className={styles.logo} src={catalog.logoImage} alt="" />
          )}
          <h1>{displayName(catalog.name)}</h1>
          {!preview && (
            <div className={styles.langSwitch} role="group" aria-label={t("Idioma")}>
              {(["es", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  lang={code}
                  aria-pressed={lang === code}
                  className={lang === code ? styles.langActive : undefined}
                  onClick={() => chooseLang(code)}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.infoChips}>
          {catalog.address.trim() && (
            <a
              className={styles.infoChip}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${catalog.name}, ${catalog.address}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              {pinIcon}
              <span>{displayName(cleanAddress(catalog.address))}</span>
            </a>
          )}
          <span className={styles.infoChip}>
            {catalog.acceptsDelivery === true ? deliveryIcon : pickupIcon}
            {catalog.acceptsDelivery === true
              ? t("Envío a domicilio")
              : t("Solo para recoger")}
          </span>
          {catalog.hours && hours ? (
            <span className={hours.open ? styles.infoChip : `${styles.infoChip} ${styles.closedChip}`}>
              {clockIcon}
              <span>
                {hours.open
                  ? hours.closesAt == null
                    ? t("Abierto todo el día")
                    : lang === "en"
                      ? t("Abierto · Cierra a {time}", { time: clock12(hours.closesAt, "en") })
                      : `Abierto · Cierra a la${clock12(hours.closesAt).startsWith("1:") ? "" : "s"} ${clock12(hours.closesAt)}`
                  : t("Cerrado · {opens}", { opens: closedText ?? "" })}
              </span>
            </span>
          ) : null}
        </div>
        {lang === "en" && translating && (
          <p className={styles.translating} role="status">
            {t("Traduciendo el menú…")}
          </p>
        )}
      </header>
      <nav className={styles.categories} aria-label={t("Categorías")} ref={categoryBar}>
        {catalog.categories
          .filter((c) => catalog.products.some((p) => p.categoryId === c.id))
          .map((c) => (
            <a
              key={c.id}
              href={`#cat-${c.id}`}
              data-chip={c.id}
              className={activeCategory === c.id ? styles.activeCategory : undefined}
              aria-current={activeCategory === c.id ? "true" : undefined}
              onClick={(event) => {
                const section = document.getElementById(`cat-${c.id}`);
                if (!section) return;
                event.preventDefault();
                const reduce = window.matchMedia(
                  "(prefers-reduced-motion: reduce)",
                ).matches;
                section.scrollIntoView({
                  behavior: reduce ? "auto" : "smooth",
                  block: "start",
                });
              }}
            >
              {name(c.name)}
            </a>
          ))}
      </nav>
      {!catalog.products.length && (
        <p className={styles.empty}>
          {t("El negocio está preparando su menú. Vuelve pronto.")}
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
            data-category={category.id}
            className={styles.section}
          >
            <h2>{name(category.name)}</h2>
            <div className={styles.products}>
              {products.map((p) => (
                <button
                  disabled={!p.available}
                  // Cada platillo es su propia tarjeta. Sin foto, la tarjeta
                  // se encoge: antes ocupaba un cuadro con la inicial que
                  // parecía una imagen que no cargó.
                  className={
                    p.image
                      ? styles.product
                      : `${styles.product} ${styles.compact}`
                  }
                  key={p.id}
                  onClick={() => setSelected(p)}
                  aria-label={t("Elegir {name}", { name: tr(p.name) })}
                >
                  <div className={styles.productCopy}>
                    <h3>{name(p.name)}</h3>
                    {p.description && <p>{name(p.description)}</p>}
                    <strong>
                      {p.available
                        ? p.variants.length > 1
                          ? t("Desde {price}", { price: money(Math.min(...p.variants.map((v) => v.price))) })
                          : money(Math.min(...p.variants.map((v) => v.price)))
                        : t("Agotado")}
                    </strong>
                    {catalog.promotions.some(offer => offer.productIds.includes(p.id)) && <span className={styles.individualPrice}>{t("Precio individual")}</span>}
                    <ProductPromotions catalog={catalog} productId={p.id} now={now} />
                  </div>
                  {p.image ? (
                    <span className={styles.productVisual}>
                      <img
                        src={p.image}
                        alt={tr(p.name)}
                        loading="lazy"
                        width={104}
                        height={104}
                      />
                      {p.available && plusBadge}
                    </span>
                  ) : (
                    p.available && (
                      <span className={styles.productAction}>{plusBadge}</span>
                    )
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <footer className={styles.footer}>
        {t("Menú creado con")} <a href="/">Órale AI</a>
        <p>
          {t("El negocio confirma disponibilidad, pago y tiempo de entrega por WhatsApp.")}
        </p>
      </footer>
      {!!count && (
        <div className={styles.cartBar}>
          <button className={styles.primary} onClick={() => setCartOpen(true)}>
            <span>
              {t(
                count === 1
                  ? "{count} producto · Ver carrito"
                  : "{count} productos · Ver carrito",
                { count },
              )}
            </span>
            <span>{quote ? money(quote.total) : t("Revisar")}</span>
          </button>
        </div>
      )}
      {selected && (
        <ProductForm
          catalog={catalog}
          now={now}
          product={selected}
          close={() => setSelected(null)}
          add={(line) => {
            changeLines([...lines, line]);
            setSelected(null);
          }}
        />
      )}
      {cartOpen && (
        <Dialog title={t("Tu pedido")} close={() => setCartOpen(false)}>
          <form onSubmit={prepare}>
            {!lines.length && <p>{t("Tu carrito está vacío.")}</p>}
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
                    <h3>{p ? name(p.name) : t("Producto no disponible")}</h3>
                    <p>
                      {v ? name(v.name) : ""}
                      {options.length
                        ? ` · ${options.map((c) => name(c.name)).join(", ")}`
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
                      {t("Quitar")}
                    </button>
                  </div>
                  <QuantityStepper
                    value={line.quantity}
                    max={p?.stock ?? 99}
                    label={t("Cantidad de {name}", {
                      name: p ? tr(p.name) : t("producto"),
                    })}
                    onChange={(quantity) =>
                      changeLines(
                        lines.map((l, i) =>
                          i === index ? { ...l, quantity } : l,
                        ),
                      )
                    }
                  />
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
                  <span>{t("Productos")}</span>
                  <span>{money(quote.subtotal)}</span>
                </p>
                {quote.discount > 0 && (
                  <p>
                    <span>{tr(quote.promotion)}</span>
                    <span>−{money(quote.discount)}</span>
                  </p>
                )}
                <p>
                  <strong>{t("Total de productos")}</strong>
                  <strong>{money(quote.total)}</strong>
                </p>
                {checkout.fulfillment === "delivery" && (
                  <small>{t("El negocio te confirmará el costo de envío.")}</small>
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
                  {t("Tu nombre")}
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
                      ? t("¿Cómo quieres tu pedido?")
                      : t("Pedido para recoger")}
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
                        {f === "pickup" ? t("Pasar a recoger") : t("A domicilio")}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {checkout.fulfillment === "delivery" && (
                  <label className={styles.field}>
                    {t("Dirección y referencias")}
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
                {checkout.fulfillment === "delivery" && (
                  <label className={styles.field}>
                    {t("Tu WhatsApp")}
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      required
                      maxLength={20}
                      placeholder={t("10 dígitos")}
                      value={checkout.phone ?? ""}
                      onChange={(e) => {
                        setCheckout({ ...checkout, phone: e.target.value });
                        setWhatsapp(null);
                      }}
                      aria-describedby="buyer-phone-hint"
                    />
                    <small id="buyer-phone-hint">
                      {t("Va en tu pedido para que el negocio te contacte si hace falta.")}
                    </small>
                  </label>
                )}
                <p className={styles.notice}>
                  {preview
                    ? "Podrás revisar el mensaje y abrir WhatsApp con tu número de prueba. Presiona “Enviar” ahí para completar la prueba."
                    : t("Tu pedido se envía cuando presionas “Enviar” en WhatsApp. Espera la confirmación del negocio.")}
                </p>
                {error && (
                  <p className={styles.error} role="alert">
                    {errorText(lang, error, tr)}
                  </p>
                )}
                {closedText && !preview ? (
                  <p className={styles.error} role="status">
                    {t("El negocio está cerrado. {opens}", { opens: closedText })}
                  </p>
                ) : null}
                {whatsapp ? (
                  <a className={styles.whatsapp} href={whatsapp}>
                    {t("Abrir WhatsApp y enviar pedido")}
                  </a>
                ) : (
                  <button
                    className={styles.primary}
                    type="submit"
                    disabled={busy || !!cartError || (!!closedText && !preview)}
                  >
                    {busy
                      ? t("Revisando disponibilidad…")
                      : preview
                        ? "Ver mensaje de WhatsApp"
                        : t("Continuar a WhatsApp")}
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
    </WordsContext.Provider>
  );
}
