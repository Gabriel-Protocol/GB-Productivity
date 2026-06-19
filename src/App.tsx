/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  auth,
  getOrCreateUserConfig,
  getUserDays,
  UserConfig,
  DailyRecord,
  DEFAULT_CONFIG,
  logout,
  subscribeToSyncStatus,
  SyncStatus
} from "./lib/firebase";

// Components
import LoginScreen from "./components/LoginScreen";
import JamProduktifView from "./components/JamProduktifView";
import HabitsView from "./components/HabitsView";
import SettingsView from "./components/SettingsView";

// Icons
import { Clock, CheckSquare, Sliders, LogOut, ShieldCheck, Sparkles, AlertCircle, Database, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [daysData, setDaysData] = useState<Record<string, DailyRecord>>({});
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  // App state
  const [activeTab, setActiveTab] = useState<"productive" | "habits" | "settings">("productive");
  const [appLoading, setAppLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  // Sync state tracking subscription
  useEffect(() => {
    const unsubscribeSync = subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribeSync();
  }, []);

  // Monitor Google Authentication session
  useEffect(() => {
    // Check if we have a local session active first to allow offline local storage mode
    const localUserJson = localStorage.getItem("local_user_session");
    if (localUserJson) {
      try {
        const user = JSON.parse(localUserJson);
        setCurrentUser(user);
        
        // Fetch local offline configuration and logged status
        getOrCreateUserConfig(user.uid).then((config) => {
          setUserConfig(config);
        });
        
        getUserDays(user.uid).then((days) => {
          setDaysData(days);
        });
        
        setAppLoading(false);
        return;
      } catch (e) {
        console.error("Failed to parse local user session", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAppLoading(true);
      setNetworkError(false);
      try {
        if (user) {
          setCurrentUser(user);
          // Fetch settings & data from cloud
          const config = await getOrCreateUserConfig(user.uid);
          setUserConfig(config);

          const days = await getUserDays(user.uid);
          setDaysData(days);
        } else {
          setCurrentUser(null);
          setUserConfig(null);
          setDaysData({});
        }
      } catch (err) {
        console.error("Failed to bootstrap user config or logs:", err);
        setNetworkError(true);
      } finally {
        setAppLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Update values client-side to reflect dynamic changes and trigger recalculations instantly
  const handleHoursUpdated = (dateId: string, hours: number) => {
    setDaysData((prev) => {
      const existing = prev[dateId] || { hours: 0, completedHabits: [] };
      return {
        ...prev,
        [dateId]: {
          ...existing,
          hours
        }
      };
    });
  };

  const handleHabitsUpdated = (dateId: string, completedList: string[]) => {
    setDaysData((prev) => {
      const existing = prev[dateId] || { hours: 0, completedHabits: [] };
      return {
        ...prev,
        [dateId]: {
          ...existing,
          completedHabits: completedList
        }
      };
    });
  };

  // Safe logout handler
  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.warn("Google Drive signout warning ignored during local logout", e);
    }
    setCurrentUser(null);
    setUserConfig(null);
    setDaysData({});
    setActiveTab("productive");
  };

  // Render bootstrap spinner
  if (appLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-12 h-12 border-4 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" />
          <Sparkles className="w-5 h-5 text-brand-wine absolute animate-pulse" />
        </div>
        <span className="text-sm font-bold text-slate-500 animate-pulse">
          Memuat akun aman Anda...
        </span>
      </div>
    );
  }

  // Render network failure screen
  if (networkError) {
    return (
      <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 bg-rose-100/80 rounded-2xl flex items-center justify-center text-rose-600 mb-4 shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 mb-2">Masalah Koneksi Firestore</h2>
        <p className="text-xs text-slate-450 max-w-sm mb-6 leading-relaxed">
          Gagal mengunduh profil Anda. Silakan muat ulang halaman ini atau pastikan koneksi internet Anda sedang tidak terganggu.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-brand-teal hover:bg-brand-teal/90 text-white font-semibold text-xs rounded-xl shadow transition duration-150"
        >
          Muat Ulang Halaman
        </button>
      </div>
    );
  }

  // Unauthorised fallback screen
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  // Active theme layout (default "light")
  const theme = userConfig?.theme || "light";
  const isDark = theme === "dark";

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"
      }`}
    >
      {/* Dynamic Header */}
      <header
        className={`sticky top-0 z-40 transition-colors duration-200 border-b ${
          isDark
            ? "bg-slate-900/90 border-slate-800/80 backdrop-blur"
            : "bg-white/90 border-slate-100 backdrop-blur"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-brand-teal text-white rounded-lg flex items-center justify-center font-bold relative overflow-hidden">
              <span className="text-base z-10">GB</span>
              <div className="absolute inset-0 bg-gradient-to-r from-brand-wine/40 to-transparent" />
            </div>
            <div>
              <h1 className={`text-base font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-800"}`}>
                GB - Productivity
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-brand-teal font-extrabold tracking-wider uppercase">
                  WORKSPACE INDONESIA
                </span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold leading-none border ${
                  syncStatus === "synced"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
                    : syncStatus === "syncing"
                    ? "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400"
                    : syncStatus === "error"
                    ? "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400"
                    : "bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-900/40 dark:border-slate-800/50 dark:text-slate-400"
                }`}>
                  <span className={`w-1 h-1 rounded-full ${
                    syncStatus === "synced"
                      ? "bg-emerald-500 animate-pulse"
                      : syncStatus === "syncing"
                      ? "bg-amber-500 animate-spin"
                      : syncStatus === "error"
                      ? "bg-rose-500"
                      : "bg-slate-400"
                  }`} />
                  {syncStatus === "synced" && "Synced to Drive"}
                  {syncStatus === "syncing" && "Syncing..."}
                  {syncStatus === "error" && "Sync Error"}
                  {syncStatus === "idle" && "Offline Cache"}
                </span>
              </div>
            </div>
          </div>

          {/* Tab Selection Navigation bar */}
          <nav className="flex items-center bg-slate-100/70 dark:bg-slate-855 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab("productive")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                activeTab === "productive"
                  ? isDark
                    ? "bg-brand-teal text-white shadow-inner"
                    : "bg-white text-brand-teal shadow-sm border border-slate-100"
                  : isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-500 hover:text-brand-teal"
              }`}
              id="tab-productive"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Jam Produktif</span>
            </button>

            <button
              onClick={() => setActiveTab("habits")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                activeTab === "habits"
                  ? isDark
                    ? "bg-brand-teal text-white shadow-inner"
                    : "bg-white text-brand-teal shadow-sm border border-slate-100"
                  : isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-500 hover:text-brand-teal"
              }`}
              id="tab-habits"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Habits Pelacak</span>
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                activeTab === "settings"
                  ? isDark
                    ? "bg-brand-teal text-white shadow-inner"
                    : "bg-white text-brand-teal shadow-sm border border-slate-100"
                  : isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-500 hover:text-brand-teal"
              }`}
              id="tab-settings"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pengaturan</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container Wrapper */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div id="active-tab-container">
          {activeTab === "productive" && userConfig && (
            <JamProduktifView
              userId={currentUser.uid}
              config={userConfig}
              daysData={daysData}
              onDataUpdated={handleHoursUpdated}
            />
          )}

          {activeTab === "habits" && userConfig && (
            <HabitsView
              userId={currentUser.uid}
              config={userConfig}
              daysData={daysData}
              onDataUpdated={handleHabitsUpdated}
            />
          )}

          {activeTab === "settings" && userConfig && (
            <SettingsView
              userId={currentUser.uid}
              config={userConfig}
              onConfigUpdated={(updated) => setUserConfig(updated)}
              onLogout={handleLogout}
            />
          )}
        </div>
      </main>

      {/* Footer credits line */}
      <footer
        className={`mt-16 border-t font-mono text-[9px] text-center py-6 transition-colors duration-200 ${
          isDark ? "border-slate-900 bg-slate-950/40 text-slate-500" : "border-slate-100 bg-white text-slate-400"
        }`}
      >
        &copy; {new Date().getFullYear()} GB - Productivity Hub &bull; Terproteksi Google Firebase &bull; UTC {new Date().toISOString().substring(11, 19)}
      </footer>
    </div>
  );
}
