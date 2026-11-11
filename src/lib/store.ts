// 全域狀態：存在 localStorage，變更時通知 React 與雲端同步模組
import { useSyncExternalStore } from 'react';
import { newAccount } from './engine';
import type { AppState, Settings } from './types';

const KEY = 'stocksim.state.v1';

/** 內建的 Firebase 專案（stocksim-e9205）。這些值不是機密，資料安全由 Firestore 安全規則保護。 */
export const DEFAULT_FIREBASE_CONFIG = JSON.stringify({
  apiKey: 'AIzaSyAn6Zbl5zCiyqjAbMn3o1i6Cwj4RYkPyWA',
  authDomain: 'stocksim-e9205.firebaseapp.com',
  projectId: 'stocksim-e9205',
  storageBucket: 'stocksim-e9205.firebasestorage.app',
  messagingSenderId: '42032864189',
  appId: '1:42032864189:web:c7cc00fff257f9eeb610d4',
}, null, 2);

export const DEFAULT_SETTINGS: Settings = {
  twFeeDiscount: 0.6,
  twMinFee: 20,
  usCommission: 0,
  redUp: true,
  initialTWD: 1_000_000,
  initialUSD: 30_000,
  refreshSec: 30,
  firebaseConfig: DEFAULT_FIREBASE_CONFIG,
  finmindToken: '',
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
      const settings = { ...DEFAULT_SETTINGS, ...s.settings };
      // 舊版沒有內建設定：沒填過、也沒主動關閉的話，自動套用內建專案
      if (!settings.firebaseConfig?.trim() && !settings.firebaseOptOut) settings.firebaseConfig = DEFAULT_FIREBASE_CONFIG;
      return { ...defaultState(), ...s, settings };
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
    state = { ...defaultState(), ...next, settings: { ...DEFAULT_SETTINGS, ...next.settings, firebaseConfig: state.settings.firebaseConfig, firebaseOptOut: state.settings.firebaseOptOut } };
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
