/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Keep access token and Drive file stats in memory as mandated (no localStorage save of token)
let cachedAccessToken: string | null = null;
let cachedDriveFileId: string | null = null;
let isSigningIn = false;

// Sync status definition
export type SyncStatus = "idle" | "syncing" | "synced" | "error";
let currentSyncStatus: SyncStatus = "idle";
let syncStatusListeners: ((status: SyncStatus) => void)[] = [];

// Allow UI to subscribe to Google Drive sync states
export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

export function subscribeToSyncStatus(listener: (status: SyncStatus) => void) {
  syncStatusListeners.push(listener);
  listener(currentSyncStatus);
  return () => {
    syncStatusListeners = syncStatusListeners.filter(l => l !== listener);
  };
}

function updateSyncStatus(status: SyncStatus) {
  currentSyncStatus = status;
  syncStatusListeners.forEach(listener => {
    try {
      listener(status);
    } catch (e) {
      console.error(e);
    }
  });
}

// Data models
export interface HabitGroup {
  id: string;
  name: string;
  items: string[];
}

export interface UserConfig {
  theme: "light" | "dark";
  thresholdVeryBad: number;
  thresholdBad: number;
  thresholdFair: number;
  habitsConfig: HabitGroup[];
}

export interface DailyRecord {
  hours: number;
  completedHabits: string[]; // Stores strings like "habitId::itemName"
}

// Default settings
export const DEFAULT_CONFIG: UserConfig = {
  theme: "light",
  thresholdVeryBad: 2,
  thresholdBad: 4,
  thresholdFair: 6,
  habitsConfig: [
    {
      id: "h1",
      name: "Wellness & Kesehatan",
      items: ["Minum Air Putih 2L", "Olahraga Ringan 15 Menit", "Tidur Sebelum Jam 11 Malam"]
    },
    {
      id: "h2",
      name: "Belajar & Produktivitas",
      items: ["Membaca Buku 10 Halaman", "Belajar Coding / Skill Baru 1 Jam", "Evaluasi To-Do List Harian"]
    }
  ]
};

// Local storage backup definitions to survive page refresh
let cachedUserData: {
  userConfig: UserConfig;
  daysData: Record<string, DailyRecord>;
} = {
  userConfig: DEFAULT_CONFIG,
  daysData: {}
};

// Initialize cached memory with local backup if it exists
try {
  const backupConfig = localStorage.getItem("gd_backup_config");
  const backupDays = localStorage.getItem("gd_backup_days");
  if (backupConfig) cachedUserData.userConfig = JSON.parse(backupConfig);
  if (backupDays) cachedUserData.daysData = JSON.parse(backupDays);
} catch (e) {
  console.warn("Could not load local session backups from localStorage", e);
}

// Save backups to local storage to make the UI snappy and resilient
function saveLocalBackups() {
  try {
    localStorage.setItem("gd_backup_config", JSON.stringify(cachedUserData.userConfig));
    localStorage.setItem("gd_backup_days", JSON.stringify(cachedUserData.daysData));
  } catch (e) {
    console.error("Failed to write offline local backup data:", e);
  }
}

// --- Google Drive REST API requests ---

async function findDriveFile(accessToken: string): Promise<string | null> {
  const url = `https://www.googleapis.com/drive/v3/files?q=name='gd_productivity_data.json'+and+trashed=false&fields=files(id)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to list files: ${res.statusText}`);
  }
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

async function createDriveFile(accessToken: string, fileContent: any): Promise<string> {
  const metadata = {
    name: "gd_productivity_data.json",
    mimeType: "application/json"
  };
  
  const boundary = "314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  
  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(fileContent) +
    closeDelimiter;

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: body
  });
  
  if (!res.ok) {
    throw new Error(`Failed to create Google Drive file: ${res.statusText}`);
  }
  const data = await res.json();
  return data.id;
}

async function readDriveFile(accessToken: string, fileId: string): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to read productivity file: ${res.statusText}`);
  }
  return await res.json();
}

async function updateDriveFile(accessToken: string, fileId: string, fileContent: any): Promise<void> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fileContent)
  });
  if (!res.ok) {
    throw new Error(`Failed to update Google Drive file: ${res.statusText}`);
  }
}

// Queue writes to Google Drive with debounce/throttle protection
let activeSyncPromise: Promise<void> | null = null;
let syncTimeout: any = null;

export function triggerSyncToDrive() {
  saveLocalBackups();
  
  if (!cachedAccessToken || !cachedDriveFileId) {
    console.warn("No active Google Drive session loaded. Saved data offline on local cache.");
    updateSyncStatus("idle");
    return;
  }
  
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  
  updateSyncStatus("syncing");
  
  syncTimeout = setTimeout(() => {
    const runSync = async () => {
      try {
        await updateDriveFile(cachedAccessToken!, cachedDriveFileId!, cachedUserData);
        updateSyncStatus("synced");
      } catch (err) {
        console.error("Google Drive sync failed:", err);
        updateSyncStatus("error");
      }
    };
    
    if (activeSyncPromise) {
      activeSyncPromise = activeSyncPromise.then(runSync);
    } else {
      activeSyncPromise = runSync();
    }
  }, 1000);
}

// --- Auth State Handler & Google Drive Loader ---

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        cachedDriveFileId = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      cachedDriveFileId = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Drive scopes
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    updateSyncStatus("syncing");
    
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/drive.file");
    provider.setCustomParameters({ prompt: "select_account" });
    
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get Google Access Token from authentication result");
    }

    cachedAccessToken = credential.accessToken;
    
    // Find or create the JSON data backup file on Drive
    let fileId = await findDriveFile(cachedAccessToken);
    if (fileId) {
      try {
        const cloudData = await readDriveFile(cachedAccessToken, fileId);
        cachedUserData = {
          userConfig: {
            ...DEFAULT_CONFIG,
            ...(cloudData.userConfig || {})
          },
          daysData: cloudData.daysData || {}
        };
        saveLocalBackups();
      } catch (e) {
        console.error("Cloud document parsing failed, fallback to local backup:", e);
      }
      cachedDriveFileId = fileId;
    } else {
      // Create new file
      const newFileId = await createDriveFile(cachedAccessToken, cachedUserData);
      cachedDriveFileId = newFileId;
    }
    
    updateSyncStatus("synced");
    
    // Save a lightweight token sign-in indicator for app reloading states
    const localUserSession = {
      uid: result.user.uid,
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL
    };
    localStorage.setItem("local_user_session", JSON.stringify(localUserSession));
    
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Google Drive connection and initialization failed:", error);
    updateSyncStatus("error");
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("SignOut warning captured", e);
  }
  cachedAccessToken = null;
  cachedDriveFileId = null;
  cachedUserData = { userConfig: DEFAULT_CONFIG, daysData: {} };
  
  localStorage.removeItem("local_user_session");
  localStorage.removeItem("gd_backup_config");
  localStorage.removeItem("gd_backup_days");
  
  updateSyncStatus("idle");
};

// --- Compatibility Getters and Setters matching your exact UI layout ---

export async function getOrCreateUserConfig(userId: string): Promise<UserConfig> {
  return cachedUserData.userConfig;
}

export async function saveUserConfig(userId: string, config: Partial<UserConfig>): Promise<void> {
  cachedUserData.userConfig = {
    ...cachedUserData.userConfig,
    ...config
  };
  triggerSyncToDrive();
}

export async function getDailyRecord(userId: string, dateId: string): Promise<DailyRecord> {
  return cachedUserData.daysData[dateId] || { hours: 0, completedHabits: [] };
}

export async function getUserDays(userId: string): Promise<Record<string, DailyRecord>> {
  return cachedUserData.daysData;
}

export async function saveDailyRecord(userId: string, dateId: string, record: DailyRecord): Promise<void> {
  cachedUserData.daysData = {
    ...cachedUserData.daysData,
    [dateId]: {
      hours: Number(record.hours),
      completedHabits: record.completedHabits
    }
  };
  triggerSyncToDrive();
}

export async function testFirebaseConnection(): Promise<boolean> {
  return true;
}

export { GoogleAuthProvider, signInWithPopup, signOut };
