import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';
import { cn } from '@/lib/utils';

type TabsOrientation = 'horizontal' | 'vertical';

interface TabsContextValue {
  baseId: string;
  value: string;
  setValue: (value: string) => void;
  orientation: TabsOrientation;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`${component} must be used within Tabs`);
  return context;
}

function valueId(value: string): string {
  return encodeURIComponent(value).replaceAll('%', '-');
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      value: controlledValue,
      defaultValue = '',
      onValueChange,
      orientation = 'horizontal',
      className,
      ...props
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const generatedId = useId();
    const value = controlledValue ?? internalValue;
    const context = useMemo<TabsContextValue>(
      () => ({
        baseId: `tabs-${generatedId.replaceAll(':', '')}`,
        value,
        orientation,
        setValue: (nextValue) => {
          if (controlledValue === undefined) setInternalValue(nextValue);
          onValueChange?.(nextValue);
        },
      }),
      [controlledValue, generatedId, onValueChange, orientation, value],
    );

    return (
      <TabsContext.Provider value={context}>
        <div ref={ref} className={cn('w-full', className)} {...props} />
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = 'Tabs';

export const TabsList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, onKeyDown, ...props }, ref) => {
    const { orientation } = useTabsContext('TabsList');

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      const triggers = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
      );
      const currentIndex = triggers.indexOf(document.activeElement as HTMLButtonElement);
      if (currentIndex < 0 || triggers.length === 0) return;

      const previousKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
      const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
      let targetIndex: number | null = null;

      if (event.key === previousKey) targetIndex = (currentIndex - 1 + triggers.length) % triggers.length;
      if (event.key === nextKey) targetIndex = (currentIndex + 1) % triggers.length;
      if (event.key === 'Home') targetIndex = 0;
      if (event.key === 'End') targetIndex = triggers.length - 1;

      if (targetIndex !== null) {
        event.preventDefault();
        triggers[targetIndex]?.focus();
        triggers[targetIndex]?.click();
      }
    };

    return (
      <div
        ref={ref}
        role="tablist"
        aria-orientation={orientation}
        className={cn(
          'inline-flex border-b border-line bg-white',
          orientation === 'vertical' && 'flex-col border-b-0 border-r',
          className,
        )}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  },
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, disabled, className, onClick, ...props }, ref) => {
    const context = useTabsContext('TabsTrigger');
    const active = context.value === value;
    const id = valueId(value);

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${context.baseId}-trigger-${id}`}
        aria-controls={`${context.baseId}-content-${id}`}
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        disabled={disabled}
        className={cn(
          'relative min-h-9 border-b-2 border-transparent px-3.5 py-2 text-[12px] font-bold text-ink-mid',
          'transition-colors hover:bg-surface hover:text-ink-dark',
          'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45',
          active && 'border-brand text-brand',
          context.orientation === 'vertical' && 'justify-start border-b-0 border-r-2 text-left',
          className,
        )}
        onClick={(event) => {
          context.setValue(value);
          onClick?.(event);
        }}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, forceMount = false, className, ...props }, ref) => {
    const context = useTabsContext('TabsContent');
    const active = context.value === value;
    const id = valueId(value);

    if (!active && !forceMount) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${context.baseId}-content-${id}`}
        aria-labelledby={`${context.baseId}-trigger-${id}`}
        tabIndex={0}
        hidden={!active}
        className={cn(
          'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
          className,
        )}
        {...props}
      />
    );
  },
);
TabsContent.displayName = 'TabsContent';

export default Tabs;
