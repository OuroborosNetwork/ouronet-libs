// @ouronet/ouronet-codex/provider
//
// <CodexProvider> — single root wrapper consumers place once at app root.
// Wires up the storage adapter and per-mount Zustand store; exposes both
// via React Context for the hooks/components subpaths to consume.
//
// Phase 5 (this version) ships the MINIMAL stub — adapter prop + init
// lifecycle + context exposure. Phase 7 adds the full surface from
// spec §5.1: passwordCacheMinutes, onCodexDirty, signingClient,
// auto-rendered PasswordModal, initialUiSettings, SSR placeholder.
//
// See: stoa-js/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md §5.1

export {
  CodexProvider,
  useCodexStore,
  useSigningClientOverride,
} from "./CodexProvider.js";
export type { CodexProviderProps } from "./CodexProvider.js";
