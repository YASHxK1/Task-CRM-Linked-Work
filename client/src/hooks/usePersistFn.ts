import { useRef } from "react";

export function usePersistFn<T extends (...args: any[]) => any>(fn: T): T {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const persistFn = useRef((...args: any[]) => fnRef.current(...args));
  return persistFn.current as T;
}