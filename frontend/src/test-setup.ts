import "@testing-library/jest-dom";
import { vi } from "vitest";

// vitest 4 + jsdom 29 produces a broken localStorage when --localstorage-file
// is provided without a valid path. Replace it with a working in-memory stub
// before any test module (e.g. useStore) reads localStorage at import time.
const _storage: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => _storage[key] ?? null,
  setItem: (key: string, value: string) => { _storage[key] = String(value); },
  removeItem: (key: string) => { delete _storage[key]; },
  clear: () => { Object.keys(_storage).forEach((k) => delete _storage[k]); },
  get length() { return Object.keys(_storage).length; },
  key: (index: number) => Object.keys(_storage)[index] ?? null,
});
