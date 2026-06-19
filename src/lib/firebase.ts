import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth & Firestore with specific DB id from config
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export { GoogleAuthProvider, signInWithPopup, signOut };

// Connection validation
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    // Attempt a cold server read to check connection path
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.warn("Firebase client reports as offline.");
      return false;
    }
    // Any other error means the connection is active but permissions denied (which is expected because of rules!)
    return true;
  }
}

// Types
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
  updatedAt?: any;
}

export interface DailyRecord {
  hours: number;
  completedHabits: string[]; // Stores strings like "habitId::itemIdx" or "habitId::itemName"
  updatedAt?: any;
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error details:", errInfo);
  throw new Error(JSON.stringify(errInfo));
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

/**
 * Fetch user configuration or return defaults if not exists to ensure seamless startup.
 */
export async function getOrCreateUserConfig(userId: string): Promise<UserConfig> {
  const configPath = `users/${userId}`;
  try {
    const configDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        theme: data.theme || "light",
        thresholdVeryBad: Number(data.thresholdVeryBad ?? 2),
        thresholdBad: Number(data.thresholdBad ?? 4),
        thresholdFair: Number(data.thresholdFair ?? 6),
        habitsConfig: data.habitsConfig || DEFAULT_CONFIG.habitsConfig,
      };
    } else {
      // Create defaults
      const initialConfig = { ...DEFAULT_CONFIG, updatedAt: new Date().toISOString() };
      await setDoc(configDocRef, initialConfig);
      return DEFAULT_CONFIG;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, configPath);
    return DEFAULT_CONFIG;
  }
}

/**
 * Save / update the user configuration
 */
export async function saveUserConfig(userId: string, config: Partial<UserConfig>): Promise<void> {
  const configPath = `users/${userId}`;
  try {
    const configDocRef = doc(db, "users", userId);
    await setDoc(configDocRef, {
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, configPath);
  }
}

/**
 * Fetch a user's daily record for a specific date
 */
export async function getDailyRecord(userId: string, dateId: string): Promise<DailyRecord> {
  const path = `users/${userId}/days/${dateId}`;
  try {
    const docRef = doc(db, "users", userId, "days", dateId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        hours: Number(data.hours ?? 0),
        completedHabits: data.completedHabits || []
      };
    } else {
      return { hours: 0, completedHabits: [] };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return { hours: 0, completedHabits: [] };
  }
}

/**
 * Fetch all logged days for a user to map locally
 */
export async function getUserDays(userId: string): Promise<Record<string, DailyRecord>> {
  const path = `users/${userId}/days`;
  try {
    const collRef = collection(db, "users", userId, "days");
    const snap = await getDocs(collRef);
    const records: Record<string, DailyRecord> = {};
    snap.forEach((doc) => {
      const data = doc.data();
      records[doc.id] = {
        hours: Number(data.hours ?? 0),
        completedHabits: data.completedHabits || []
      };
    });
    return records;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return {};
  }
}

/**
 * Save/overwrite a daily record
 */
export async function saveDailyRecord(userId: string, dateId: string, record: DailyRecord): Promise<void> {
  const path = `users/${userId}/days/${dateId}`;
  try {
    const docRef = doc(db, "users", userId, "days", dateId);
    await setDoc(docRef, {
      hours: Number(record.hours),
      completedHabits: record.completedHabits,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
