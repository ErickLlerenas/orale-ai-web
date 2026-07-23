"use client";

import { useEffect, useState } from "react";

export type Platform = "ios" | "android" | "windows" | "mac";

export const STORE = {
  apple: "https://apps.apple.com/app/id6776390828",
  mac: "macappstore://apps.apple.com/app/id6776390828",
  google:
    "https://play.google.com/store/apps/details?id=com.oraleai.orale_ai",
  microsoft:
    "https://apps.microsoft.com/detail/9mwh3bdnf0xt?hl=es-MX&gl=MX",
} as const;

const ORDER: Platform[] = ["ios", "android", "windows", "mac"];

const META: Record<
  Platform,
  {
    href: string;
    className: string;
    title: string;
    subtitle: string;
    short: string;
  }
> = {
  ios: {
    href: STORE.apple,
    className: "badge-apple",
    title: "App Store",
    subtitle: "Descárgalo en la",
    short: "iPhone / iPad",
  },
  android: {
    href: STORE.google,
    className: "badge-google",
    title: "Google Play",
    subtitle: "Disponible en",
    short: "Android",
  },
  windows: {
    href: STORE.microsoft,
    className: "badge-windows",
    title: "Windows",
    subtitle: "Microsoft Store",
    short: "Windows",
  },
  mac: {
    href: STORE.mac,
    className: "badge-mac",
    title: "Mac",
    subtitle: "App Store",
    short: "Mac",
  },
};

function Icon({ platform }: { platform: Platform }) {
  if (platform === "android") {
    return (
      <svg className="badge-logo" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12 3.84 21.85C3.34 21.6 3 21.09 3 20.5m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m3.35-4.31c.34.27.59.69.59 1.19 0 .5-.25.92-.57 1.18l-2.29 1.32-2.5-2.5 2.29-1.32 2.48 1.13M6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z"
        />
      </svg>
    );
  }
  if (platform === "windows") {
    return (
      <svg className="badge-logo" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5H11.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z"
        />
      </svg>
    );
  }
  return (
    <svg className="badge-logo" viewBox="0 0 384 512" aria-hidden="true">
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </svg>
  );
}

/** Detecta plataforma del visitante. iPad → App Store (ios). */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "ios";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iPhone|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ se reporta como Macintosh con touch.
  if (
    /iPad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  if (/Mac/i.test(ua)) return "mac";
  if (/Win/i.test(ua)) return "windows";
  return "ios";
}

function StoreLink({
  platform,
  size,
}: {
  platform: Platform;
  size: "lg" | "sm";
}) {
  const meta = META[platform];
  return (
    <a
      className={`badge ${meta.className}${size === "lg" ? " badge-lg" : " badge-sm"}`}
      href={meta.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icon platform={platform} />
      <span className="badge-text">
        <small>{meta.subtitle}</small>
        {meta.title}
      </span>
    </a>
  );
}

export default function StoreBadges() {
  const [platform, setPlatform] = useState<Platform>("ios");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const others = ORDER.filter((p) => p !== platform);

  return (
    <div className="store-download">
      <StoreLink platform={platform} size="lg" />
      <p className="also-on-label">También en</p>
      <div className="also-links">
        {others.map((p) => (
          <a
            key={p}
            className="also-link"
            href={META[p].href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon platform={p} />
            {META[p].short}
          </a>
        ))}
      </div>
    </div>
  );
}
