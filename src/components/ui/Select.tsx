import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type SelectSize = 'sm' | 'default' | 'lg';

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  selectSize?: SelectSize;
  invalid?: boolean;
}

const SIZE: Record<SelectSize, string> = {
  sm: 'h-8 pl-2.5 pr-8 text-[12px]',
  default: 'h-9 pl-3 pr-9 text-[12.5px]',
  lg: 'h-10 pl-3.5 pr-10 text-[13px]',
};

/** 오프라인 번들을 위한 네이티브 select 기반 공통 선택 컴포넌트. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ selectSize = 'default', invalid = false, disabled, className, children, ...props }, ref) => (
    <span className="relative flex w-full min-w-0">
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full appearance-none rounded border bg-white font-medium text-ink-dark',
          'transition-colors hover:border-line-warm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-white',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-light',
          invalid ? 'border-bad text-bad' : 'border-line',
          SIZE[selectSize],
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-mid"
      >
        <path d="m2.25 4.25 3.75 3.5 3.75-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </span>
  ),
);
Select.displayName = 'Select';

export const SelectOption = forwardRef<HTMLOptionElement, React.OptionHTMLAttributes<HTMLOptionElement>>(
  (props, ref) => <option ref={ref} {...props} />,
);
SelectOption.displayName = 'SelectOption';

export const SelectGroup = forwardRef<HTMLOptGroupElement, React.OptgroupHTMLAttributes<HTMLOptGroupElement>>(
  (props, ref) => <optgroup ref={ref} {...props} />,
);
SelectGroup.displayName = 'SelectGroup';

export default Select;
