/** Tailwind className concatenator (filters falsy). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Format number with thousands separator (Korean locale). */
export function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}
