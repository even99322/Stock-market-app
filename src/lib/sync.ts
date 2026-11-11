// Firebase 雲端同步（選用）：Email/密碼登入，資料存在 Firestore 的 users/{uid} 文件
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, type Auth,
} from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc, onSnapshot, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { store } from './store';
import type { AppState } from './types';

export type SyncStatus = 'off' | 'signed-out' | 'connecting' | 'synced' | 'syncing' | 'error';
interface SyncInfo { status: SyncStatus; email?: string; message?: string; lastSync?: number }

let info: SyncInfo = { status: 'off' };
const subs = new Set<() => void>();
function set(p: Partial<SyncInfo>) {
  info = { ...info, ...p };
  subs.forEach((f) => f());
}
export function useSync() {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => info);
}

const DEVICE_KEY = 'stocksim.deviceId';
const deviceId = localStorage.getItem(DEVICE_KEY) || Math.random().toString(36).slice(2);
localStorage.setItem(DEVICE_KEY, deviceId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let unsubSnap: Unsubscribe | null = null;
let unsubAuth: Unsubscribe | null = null;
let unsubLocal: (() => void) | null = null;
let pushTimer: any = null;
let uid: string | null = null;

/** 允許使用者貼上 Firebase 主控台給的整段 `const firebaseConfig = {...}` */
export function parseConfig(text: string): Record<string, string> | null {
  const t = text.trim();
  if (!t) return null;
  const body = t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1);
  try {
    return JSON.parse(body);
  } catch {
    try {
      // 物件字面值（key 沒有引號）轉 JSON
      const json = body
        .replace(/\/\/.*$/gm, '')
        .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/'/g, '"')
        .replace(/,\s*}/g, '}');
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}

function serialize(s: AppState) {
  const copy = { ...s, settings: { ...s.settings, firebaseConfig: '' } };
  return JSON.stringify(copy);
}

async function push() {
  if (!db || !uid) return;
  const s = store.get();
  set({ status: 'syncing' });
  try {
    await setDoc(doc(db, 'users', uid), { data: serialize(s), updatedAt: s.updatedAt, deviceId });
    set({ status: 'synced', lastSync: Date.now(), message: '' });
  } catch (e: any) {
    set({ status: 'error', message: '上傳失敗：' + (e?.code || e?.message || e) });
  }
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 1500);
}

async function attach(userId: string) {
  uid = userId;
  set({ status: 'connecting' });
  const ref = doc(db!, 'users', userId);
  try {
    const snap = await getDoc(ref);
    const local = store.get();
    if (snap.exists()) {
      const remote = snap.data() as { data: string; updatedAt: number };
      if (remote.updatedAt > local.updatedAt) store.replace(JSON.parse(remote.data));
      else if (local.updatedAt > remote.updatedAt) await push();
    } else {
      await push();
    }
    set({ status: 'synced', lastSync: Date.now(), message: '' });
  } catch (e: any) {
    set({ status: 'error', message: '讀取雲端資料失敗：' + (e?.code || e?.message || e) });
  }
  unsubSnap?.();
  unsubSnap = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      const r = snap.data() as { data: string; updatedAt: number; deviceId: string };
      if (r.deviceId !== deviceId && r.updatedAt > store.get().updatedAt) {
        store.replace(JSON.parse(r.data));
        set({ status: 'synced', lastSync: Date.now() });
      }
    },
    (e) => set({ status: 'error', message: '即時同步中斷：' + e.code }),
  );
  unsubLocal?.();
  unsubLocal = store.onLocalChange(schedulePush);
}

function detach() {
  unsubSnap?.(); unsubSnap = null;
  unsubLocal?.(); unsubLocal = null;
  uid = null;
}

export async function initSync() {
  detach();
  unsubAuth?.(); unsubAuth = null;
  if (app) { await deleteApp(app).catch(() => {}); app = null; auth = null; db = null; }
  const cfg = parseConfig(store.get().settings.firebaseConfig);
  if (!cfg) { set({ status: 'off', email: undefined, message: '' }); return; }
  try {
    app = initializeApp(cfg, 'stocksim');
    auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch (e: any) {
    set({ status: 'error', message: 'Firebase 設定錯誤：' + (e?.message || e) });
    return;
  }
  set({ status: 'signed-out', message: '' });
  unsubAuth = onAuthStateChanged(auth, (user) => {
    if (user) { set({ email: user.email || '' }); attach(user.uid); }
    else { detach(); set({ status: 'signed-out', email: undefined }); }
  });
}

const errMsg = (e: any) => {
  const c = e?.code || '';
  const map: Record<string, string> = {
    'auth/invalid-credential': '帳號或密碼錯誤',
    'auth/wrong-password': '密碼錯誤',
    'auth/user-not-found': '找不到此帳號',
    'auth/email-already-in-use': '此 Email 已註冊，請直接登入',
    'auth/weak-password': '密碼至少 6 個字元',
    'auth/invalid-email': 'Email 格式不正確',
    'auth/operation-not-allowed': '請到 Firebase 主控台啟用「電子郵件/密碼」登入',
    'auth/network-request-failed': '網路連線失敗',
  };
  return map[c] || c || String(e);
};

export async function login(email: string, pw: string, register = false) {
  if (!auth) throw new Error('尚未設定 Firebase');
  try {
    if (register) await createUserWithEmailAndPassword(auth, email, pw);
    else await signInWithEmailAndPassword(auth, email, pw);
  } catch (e) { throw new Error(errMsg(e)); }
}
export async function logout() { if (auth) await signOut(auth); }
export async function resetPassword(email: string) {
  if (!auth) throw new Error('尚未設定 Firebase');
  try { await sendPasswordResetEmail(auth, email); } catch (e) { throw new Error(errMsg(e)); }
}

/** 手動處理衝突 */
export async function forceUpload() { await push(); }
export async function forceDownload() {
  if (!db || !uid) return;
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) store.replace(JSON.parse((snap.data() as any).data));
}
