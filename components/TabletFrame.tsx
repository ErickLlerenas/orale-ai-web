import type { ReactNode } from "react";

/** Marco de tablet vertical compartido (hero y Pro). */
export default function TabletFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["tablet-bezel", className].filter(Boolean).join(" ")}>
      <div className="tablet-camera" />
      <div className="tablet-screen">{children}</div>
    </div>
  );
}
