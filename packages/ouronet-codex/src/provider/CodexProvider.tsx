/**
 * <CodexProvider> — Phase 7 full surface per spec §5.1.
 *
 * Provides:
 *   - Per-mount Zustand store + React Context (Phase 5 stub)
 *   - Auto-init with the supplied adapter (Phase 5 stub)
 *   - passwordCacheMinutes prop → seeds uiSettings.passwordCacheMinutes
 *   - initialUiSettings prop → first-boot override of UI settings
 *   - onCodexDirty callback → fires on clean→dirty transitions
 *   - signingClient prop → optional PactClient override (consumed by
 *     useSignTransaction via the provider's internal context)
 *   - SSR-safe shell: renders children with a no-op shell on the server
 *     (typeof window === 'undefined'); init runs only in the browser
 *
 * Why per-mount store (not module-level singleton): tests need isolation
 * across cases, and the architectural decision in spec §4 is "one
 * codex per app" — but that "one" lives inside the provider, not the
 * module. Two providers in the same React tree each get their own
 * store; hooks subscribe via the nearest context.
 *
 * Why an effect (not synchronous init): adapter.loadAll() is async.
 * Synchronous init would force consumers to gate every hook on a
 * "ready" flag they don't have access to yet. Initialising in an
 * effect exposes the same isReady/isLocked pair through useCodex() —
 * the rendering pattern consumers already know from auth-context
 * (`if (!isReady) return <Spinner />`).
 *
 * Why TWO contexts (store + signingClient): the store is universally
 * needed by every hook; the signingClient is consumed only by
 * useSignTransaction. Splitting them lets useSignTransaction stay
 * lazy-construct when no override is provided, without forcing every
 * hook to subscribe to client-related re-renders.
 */

import * as React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { ReactNode } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import type { PactClient } from "@stoachain/stoa-core/signing";
import type { CodexAdapter } from "../adapters/types.js";
import type { CodexStoreState } from "../state/store.js";
import { createCodexStore } from "../state/store.js";
import type {
  DeviceVariant,
  UiSettings,
} from "../types/entities.js";
import { MultiStepToastContainer } from "../zbom/toast/MultiStepToastContainer.js";

export interface CodexProviderProps {
  /** Storage backend for the codex. Required. Pass `new LocalStorageCodexAdapter()`
   *  for browser apps, `new MemoryCodexAdapter()` for tests/SSR. */
  adapter: CodexAdapter;

  /** Device-variant marker stamped on every touch(). Defaults to "dev"
   *  to match the store's initial state — Vite consumers usually pass
   *  `import.meta.env.VITE_APP_VARIANT` here. */
  deviceVariant?: DeviceVariant;

  /**
   * TTL in minutes for the unlocked password cache. Default: 1.
   * Applied AFTER adapter.loadAll() resolves — so any value already
   * persisted in uiSettings.passwordCacheMinutes overrides this on
   * subsequent loads (this prop is the FIRST-BOOT default).
   *
   * To force the TTL regardless of persisted state, the consumer can
   * call useCodex().uiSettings.passwordCacheMinutes themselves and
   * trigger updateUiSettings via useCodexAuth/useCodex actions.
   */
  passwordCacheMinutes?: number;

  /**
   * First-boot UI settings override. Merged into DEFAULT_UI_SETTINGS
   * if-and-only-if nothing has been persisted yet (schemaVersion === 0
   * after adapter.loadAll()). Useful for consumers that want different
   * defaults (e.g. a test environment with selectedNode: "node1").
   *
   * On second+ boots, the persisted uiSettings take precedence — this
   * is the DEFAULT for a brand-new codex, not a force-override.
   */
  initialUiSettings?: Partial<UiSettings>;

  /**
   * Callback fired when the codex transitions from clean (`dirty: false`)
   * to dirty (`dirty: true`). Useful for "Save to Drive?" prompts.
   * Does NOT fire on every mutation — only on the clean→dirty edge.
   * Does NOT fire on the initial false state.
   */
  onCodexDirty?: () => void;

  /**
   * Optional pre-configured Pact client. When provided, useSignTransaction
   * uses this client instead of constructing one from
   * `createClient(getPactUrl(KADENA_CHAIN_ID))`. Use this when:
   *   - Consumer routes Pact calls through a CF-worker proxy (production)
   *   - Test environments want a mock client
   *   - Custom failover / retry semantics outside what stoa-core/network provides
   *
   * When omitted (default), useSignTransaction builds the client lazily.
   */
  signingClient?: PactClient;

  children: ReactNode;
}

type CodexStore = UseBoundStore<StoreApi<CodexStoreState>>;

const CodexStoreContext = createContext<CodexStore | null>(null);

/**
 * Optional signing-client override context. Separate from the store so
 * useSignTransaction can fall back to its default lazy-construct path
 * when no override is provided.
 */
const SigningClientContext = createContext<PactClient | null>(null);

/**
 * Provider component. Place once at the app root inside your error
 * boundary but outside any code that uses codex hooks.
 *
 * ```tsx
 * <CodexProvider
 *   adapter={new LocalStorageCodexAdapter()}
 *   passwordCacheMinutes={5}
 *   onCodexDirty={() => toast.info("Save to Drive?")}
 * >
 *   <App />
 * </CodexProvider>
 * ```
 */
export function CodexProvider({
  adapter,
  deviceVariant = "dev",
  passwordCacheMinutes,
  initialUiSettings,
  onCodexDirty,
  signingClient,
  children,
}: CodexProviderProps): React.JSX.Element {
  const storeRef = useRef<CodexStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createCodexStore();
  }
  const store = storeRef.current;

  // SSR detection — capture once so we don't re-run on every render.
  // The init effect skips entirely on the server (browser-only storage
  // adapters would crash on adapter.loadAll() anyway).
  const isBrowser = typeof window !== "undefined";

  // Stable refs for the callbacks/values consumed inside effects, so
  // we don't re-run init when the consumer passes a fresh closure
  // every render.
  const onCodexDirtyRef = useRef(onCodexDirty);
  onCodexDirtyRef.current = onCodexDirty;
  const passwordCacheMinutesRef = useRef(passwordCacheMinutes);
  passwordCacheMinutesRef.current = passwordCacheMinutes;
  const initialUiSettingsRef = useRef(initialUiSettings);
  initialUiSettingsRef.current = initialUiSettings;

  // Init effect — runs once. Loads adapter snapshot, applies
  // first-boot UI settings overrides if applicable, then settles the
  // store into the `ready` state.
  useEffect(() => {
    if (!isBrowser) return; // SSR — skip; consumer renders inert shell.

    let cancelled = false;
    (async () => {
      const actions = store.getState().actions;
      await actions.init(adapter, deviceVariant);
      if (cancelled) return;

      const state = store.getState();
      // First-boot UI settings overlay — only when nothing persisted yet
      // (schemaVersion === 0 means the adapter returned the empty
      // snapshot, not a previously-saved one).
      const isFreshBoot = state.schemaVersion === 0;
      const overrides: Partial<UiSettings> = {};
      if (isFreshBoot && initialUiSettingsRef.current) {
        Object.assign(overrides, initialUiSettingsRef.current);
      }
      if (passwordCacheMinutesRef.current !== undefined) {
        // passwordCacheMinutes always applied first-boot; persisted
        // value takes over on subsequent loads.
        if (isFreshBoot) {
          overrides.passwordCacheMinutes = passwordCacheMinutesRef.current;
        }
      }
      if (Object.keys(overrides).length > 0) {
        await actions.updateUiSettings(overrides);
        // Reset dirty flag — these first-boot overrides are bootstrap
        // defaults, not user-initiated changes.
        actions.clearDirty();
      }
    })().catch(() => {
      // Errors are captured by the store's initError slice; nothing
      // to do here. Consumers read state.initError via useCodex.
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, isBrowser]);

  // onCodexDirty subscription — fires when dirty flips false → true.
  // Subscribes via zustand's subscribe() (NOT via a hook selector,
  // because the provider itself doesn't re-render on every state
  // change, and we want stable subscription semantics).
  const prevDirtyRef = useRef(false);
  useEffect(() => {
    if (!isBrowser) return;
    const unsub = store.subscribe((state) => {
      const wasDirty = prevDirtyRef.current;
      const isDirty = state.dirty;
      if (!wasDirty && isDirty && onCodexDirtyRef.current) {
        onCodexDirtyRef.current();
      }
      prevDirtyRef.current = isDirty;
    });
    return unsub;
  }, [store, isBrowser]);

  // Memoise context values so children don't re-render on every
  // provider render.
  const storeValue = useMemo(() => store, [store]);

  // signingClient context — explicit null when no override, so
  // useSignTransaction can detect the absence cleanly.
  const clientValue = useMemo(
    () => signingClient ?? null,
    [signingClient]
  );

  return (
    <CodexStoreContext.Provider value={storeValue}>
      <SigningClientContext.Provider value={clientValue}>
        {children}
        {/* Transaction status cards ("cardboard") for the ZBOM operation
            modals. The modals push to the package's global toastStore via
            txPending(); without this host mounted, a tx would submit to chain
            but render no feedback. Mounted once here so every consumer gets it
            for free; self-portals to document.body (bottom-right), renders
            nothing when the store is empty. Browser-only — the provider is
            SSR-safe and createPortal needs document. */}
        {isBrowser && <MultiStepToastContainer />}
      </SigningClientContext.Provider>
    </CodexStoreContext.Provider>
  );
}

/**
 * Internal hook — returns the per-mount store. Used by every public
 * hook in this package to read/subscribe to codex state. NOT exported
 * as part of the public API; consumers go through the typed hooks in
 * @ouronet/ouronet-codex/hooks instead.
 *
 * Throws if called outside a <CodexProvider>.
 */
export function useCodexStore(): CodexStore {
  const store = useContext(CodexStoreContext);
  if (store === null) {
    throw new Error(
      "useCodexStore: missing <CodexProvider>. Wrap your app at the root, e.g. " +
        "<CodexProvider adapter={new LocalStorageCodexAdapter()}>{...}</CodexProvider>."
    );
  }
  return store;
}

/**
 * Internal hook — returns the optional signingClient override from
 * <CodexProvider signingClient={...}>. Returns null when no override
 * was supplied. Consumed by useSignTransaction to decide between the
 * override and the default lazy-construct path.
 *
 * Does NOT throw outside a CodexProvider (returns null) — the test for
 * provider presence belongs in useCodexStore.
 */
export function useSigningClientOverride(): PactClient | null {
  return useContext(SigningClientContext);
}
