import { useEffect, useState } from "react";
import { timeLeft } from "@/lib/rvbid";
import { cn } from "@/lib/utils";

export function Countdown({
  endsAt,
  className,
  showLabel = true,
}: {
  endsAt: string | null;
  className?: string;
  showLabel?: boolean;
}) {
  const [state, setState] = useState(() => timeLeft(endsAt));

  useEffect(() => {
    setState(timeLeft(endsAt));
    const id = setInterval(() => setState(timeLeft(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display tabular-nums",
        state.urgent ? "text-live" : "text-foreground",
        className,
      )}
    >
      {showLabel && <span className="live-dot" aria-hidden />}
      {state.label}
    </span>
  );
}
