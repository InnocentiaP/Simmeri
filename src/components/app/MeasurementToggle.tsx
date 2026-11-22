import type { MeasurementSystem } from "@/lib/units/convert";

const OPTIONS: { value: MeasurementSystem; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "metric", label: "Metric" },
  { value: "us", label: "US" },
];

interface MeasurementToggleProps {
  value: MeasurementSystem;
  onChange: (value: MeasurementSystem) => void;
}

export function MeasurementToggle({ value, onChange }: MeasurementToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Show amounts in"
      className="inline-flex rounded-full border border-border bg-background p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1 text-xs ${
              active ? "bg-olive-deep text-primary-foreground" : "text-cocoa hover:bg-cream-deep/40"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
