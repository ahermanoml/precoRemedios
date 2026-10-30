"use client";

// Tiny localStorage-backed stores shared across components (UF escolhida,
// favoritos). useSyncExternalStore keeps every subscriber in sync and renders
// the server default during hydration.
import { useSyncExternalStore } from "react";

function createStore<T>(key: string, fallback: T, isValid: (v: unknown) => v is T) {
  const listeners = new Set<() => void>();
  let cached: { raw: string | null; value: T } | null = null;

  function read(): T {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      // storage blocked (private mode etc.)
    }
    if (cached && cached.raw === raw) return cached.value;
    let value = fallback;
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (isValid(parsed)) value = parsed;
      } catch {
        // ignore malformed values
      }
    }
    cached = { raw, value };
    return value;
  }

  function write(value: T) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      cached = { raw: JSON.stringify(value), value };
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, read, () => fallback);
  }

  return { read, write, useValue };
}

export { createStore };
