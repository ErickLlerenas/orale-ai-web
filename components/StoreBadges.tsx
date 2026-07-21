const APPLE =
  "https://apps.apple.com/app/id6776390828";
const GOOGLE =
  "https://play.google.com/store/apps/details?id=com.oraleai.orale_ai";

export default function StoreBadges() {
  return (
    <div className="badges">
      <a
        className="badge badge-apple"
        href={APPLE}
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg className="badge-logo" viewBox="0 0 384 512" aria-hidden="true">
          <path
            fill="currentColor"
            d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
          />
        </svg>
        <span className="badge-text">
          <small>Descárgalo en la</small>App Store
        </span>
      </a>
      <a
        className="badge badge-google"
        href={GOOGLE}
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg className="badge-logo" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12 3.84 21.85C3.34 21.6 3 21.09 3 20.5m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m3.35-4.31c.34.27.59.69.59 1.19 0 .5-.25.92-.57 1.18l-2.29 1.32-2.5-2.5 2.29-1.32 2.48 1.13M6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z"
          />
        </svg>
        <span className="badge-text">
          <small>Disponible en</small>Google Play
        </span>
      </a>
    </div>
  );
}
