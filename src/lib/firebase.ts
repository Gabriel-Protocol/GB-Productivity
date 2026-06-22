/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs,
  writeBatch
} from "firebase/firestore";
import defaultFirebaseConfig from "../../firebase-applet-config.json";

// Helper function to load Firebase Configuration (custom from localStorage or default)
export function getFirebaseConfig() {
  try {
    const custom = localStorage.getItem("custom_firebase_config");
    if (custom) {
      return JSON.parse(custom);
    }
  } catch (e) {
    console.warn("Failed to parse custom firebase config from localStorage", e);
  }
  return defaultFirebaseConfig;
}

const activeConfig = getFirebaseConfig();

// Initialize or retrieve the active Firebase App instance safely
function getActiveApp() {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(activeConfig);
}

const app = getActiveApp();

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(
  app, 
  activeConfig.firestoreDatabaseId || undefined
);

export { GoogleAuthProvider, signInWithPopup, signOut };

// Connection validation
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    const config = getFirebaseConfig();
    return !!config.apiKey && !!config.projectId;
  } catch {
    return false;
  }
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

// Default configurations
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

// --- Firestore Database operations ---

export async function getOrCreateUserConfig(userId: string): Promise<UserConfig> {
  try {
    const docRef = doc(db, "users", userId, "config", "main");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { 
        ...DEFAULT_CONFIG, 
        ...docSnap.data() 
      } as UserConfig;
    } else {
      // Create with default values if non-existent
      await setDoc(docRef, DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    console.warn("Failed to get config from Firestore, fallback to default", error);
    return DEFAULT_CONFIG;
  }
}

export async function saveUserConfig(userId: string, config: Partial<UserConfig>): Promise<void> {
  try {
    const docRef = doc(db, "users", userId, "config", "main");
    await setDoc(docRef, config, { merge: true });
  } catch (error) {
    console.error("Failed to save config to Firestore", error);
    throw error;
  }
}

export async function getDailyRecord(userId: string, dateId: string): Promise<DailyRecord> {
  try {
    const docRef = doc(db, "users", userId, "days", dateId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        hours: Number(data.hours || 0),
        completedHabits: data.completedHabits || []
      } as DailyRecord;
    }
  } catch (error) {
    console.warn(`Failed to fetch daily record for date ${dateId}`, error);
  }
  return { hours: 0, completedHabits: [] };
}

export async function getUserDays(userId: string): Promise<Record<string, DailyRecord>> {
  const result: Record<string, DailyRecord> = {};
  try {
    const colRef = collection(db, "users", userId, "days");
    const querySnapshot = await getDocs(colRef);
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      result[docSnap.id] = {
        hours: Number(data.hours || 0),
        completedHabits: data.completedHabits || []
      };
    });
  } catch (error) {
    console.warn("Failed to retrieve user days history", error);
  }
  return result;
}

export async function saveDailyRecord(userId: string, dateId: string, record: DailyRecord): Promise<void> {
  try {
    const docRef = doc(db, "users", userId, "days", dateId);
    await setDoc(docRef, {
      hours: Number(record.hours),
      completedHabits: record.completedHabits
    });
  } catch (error) {
    console.error(`Failed to preserve daily record for date ${dateId}`, error);
    throw error;
  }
}

export async function bulkSaveDailyRecords(userId: string, records: Record<string, DailyRecord>): Promise<void> {
  try {
    const keys = Object.keys(records);
    if (keys.length === 0) return;

    // Split keys into chunks of 400 (Firestore writeBatch maximum is 500)
    const chunkSize = 400;
    const chunks: string[][] = [];
    for (let i = 0; i < keys.length; i += chunkSize) {
      chunks.push(keys.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((dateKey) => {
        const record = records[dateKey];
        const docRef = doc(db, "users", userId, "days", dateKey);
        batch.set(docRef, {
          hours: Number(record.hours || 0),
          completedHabits: record.completedHabits || []
        });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error("Failed to perform bulk restore of daily records via batch", error);
    throw error;
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<User | null> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  return result.user;
};

export const logout = async () => {
  await signOut(auth);
};
