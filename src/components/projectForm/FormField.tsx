import { cn } from '@/lib/utils';

interface Props {
  label: string;
  required?: boolean;
  hint?: string;
  info?: string;
  children: React.ReactNode;
  className?: string;
}

/** 등록 폼의 라벨 + 인풋 + 힌트 한 묶음 */
export default function FormField({ label, required, hint, info, children, className }: Props) {
  return (
    <div className={cn('mb-3', className)}>
      <label className="block text-[11.5px] font-bold text-ink-dark mb-1.5">
        {label}
        {required && <span className="text-bad font-extrabold ml-1">*</span>}
        {info && <span className="text-[10.5px] font-medium text-ink-mid ml-2">{info}</span>}
      </label>
      {children}
      {hint && <div className="text-[10.5px] text-ink-mid mt-1.5">{hint}</div>}
    </div>
  );
}

/** 마우스 오버 시 예시를 보여주는 툴팁 (입력란을 감싸 disabled에서도 동작). */
function ExampleTooltip({ children, example }: { children: React.ReactNode; example?: string }) {
  if (!example) return <>{children}</>;
  return (
    <span className="group relative block">
      {children}
      <span className="pointer-events-none absolute left-0 top-full mt-1 z-40 hidden group-hover:block whitespace-pre-line bg-ink text-white text-[10.5px] font-medium leading-relaxed px-2.5 py-1.5 rounded shadow-lg max-w-[280px]">
        {example}
      </span>
    </span>
  );
}

export function Input({
  example,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { example?: string }) {
  return (
    <ExampleTooltip example={example}>
      <input
        {...props}
        className={cn(
          'w-full px-3 py-2 border border-line rounded bg-white text-[12.5px] focus:outline-none focus:border-brand-dark disabled:bg-surface-soft disabled:text-ink-mid',
          props.className,
        )}
      />
    </ExampleTooltip>
  );
}

export function Textarea({
  example,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { example?: string }) {
  return (
    <ExampleTooltip example={example}>
      <textarea
        {...props}
        className={cn(
          'w-full px-3 py-2 border border-line rounded bg-white text-[12.5px] focus:outline-none focus:border-brand-dark resize-y',
          props.className,
        )}
      />
    </ExampleTooltip>
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full px-3 py-2 border border-line rounded bg-white text-[12.5px] focus:outline-none focus:border-brand-dark',
        props.className,
      )}
    />
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 mb-3">{children}</div>;
}
