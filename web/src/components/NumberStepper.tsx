'use client';

type Variant = 'sales' | 'loss';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  variant?: Variant;
  min?: number;
  compact?: boolean;
  inputId?: string;
}

export default function NumberStepper({ value, onChange, variant = 'sales', min = 0, compact = false, inputId }: NumberStepperProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(value + 1);

  return (
    <div className={`num-stepper num-stepper--${variant} ${compact ? 'num-stepper--compact' : ''}`}>
      <button type="button" aria-label="減らす" onClick={dec} className="num-stepper-btn">
        −
      </button>
      <input
        id={inputId}
        type="number"
        min={min}
        inputMode="numeric"
        value={value}
        data-stepper={variant}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const all = Array.from(
              document.querySelectorAll<HTMLInputElement>(`input[data-stepper="${variant}"]`)
            );
            const idx = all.indexOf(e.currentTarget);
            const next = all[idx + 1];
            if (next) {
              next.focus();
              next.select();
            }
          }
        }}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="num-stepper-input"
      />
      <button type="button" aria-label="増やす" onClick={inc} className="num-stepper-btn">
        +
      </button>
    </div>
  );
}
