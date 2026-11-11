// 全域狀態：存在 localStorage，變更時通知 React 與雲端同步模組
import { useSyncExternalStore } from 'react';
import { newAccount } from './engine';
import type { AppState, Settings } from './types';

const KEY = 'stocksim.state.v1';

export const DEFAULT_SETTINGS: Settings = {
  twFeeDiscount: 0.6,
  twMinFee: 20,
  usCommission: 0,
  redUp: true,
  initialTWD: 1_000_000,
  initialUSD: 30_000,
  refreshSec: 30,
  firebaseConfig: '',
};

export function defaultState(): AppState {
  return {
    version: 1,
    account: newAccount(DEFAULT_SETTINGS),
    replays: [],
    watchlist: ['^TWII', '2330.TW', '0050.TW', '2317.TW', '^GSPC', 'AAPL', 'NVDA', 'TSM'],
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: 0,
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      return { ...defaultState(), ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings } };
    }
  } catch { /* ignore */ }
  return defaultState();
}

let state: AppState = load();
const listeners = new Set<() => void>();
const changeHooks = new Set<(s: AppState) => void>();

function emit() {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** 本機修改：更新時間戳並觸發同步上傳 */
  update(fn: (s: AppState) => AppState) {
    state = { ...fn(state), updatedAt: Date.now() };
    emit();
    changeHooks.forEach((h) => h(state));
  },
  /** 套用雲端資料（不觸發上傳） */
  replace(next: AppState) {
    state = { ...defaultState(), ...next, settings: { ...DEFAULT_SETTINGS, ...next.settings, firebaseConfig: state.settings.firebaseConfig } };
    emit();
  },
  onLocalChange(h: (s: AppState) => void) {
    changeHooks.add(h);
    return () => changeHooks.delete(h);
  },
};

export function useApp(): AppState {
  return useSyncExternalStore(store.subscribe, store.get);
}
