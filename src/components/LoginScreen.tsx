/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { googleSignIn, getFirebaseConfig } from "../lib/firebase";
import { 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  CheckSquare, 
  Database,
  Terminal,
  RefreshCw,
  FolderLock,
  Settings,
  X,
  Check,
  ChevronRight,
  Info,
  ExternalLink,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // Custom configuration states
  const [currentConfigText, setCurrentConfigText] = useState("");
  const [hasCustomConfig, setHasCustomConfig] = useState(false);
  const [configSuccessMessage, setConfigSuccessMessage] = useState<string | null>(null);

  // Load current active config on mount
  useEffect(() => {
    const config = getFirebaseConfig();
    setCurrentConfigText(JSON.stringify(config, null, 2));
    setHasCustomConfig(!!localStorage.getItem("custom_firebase_config"));
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const user = await googleSignIn();
      if (user) {
        onLoginSuccess(user);
      }
    } catch (error: any) {
      console.error("Google Auth connection failure:", error);
      let desc = error.message || String(error);
      if (error.code === "auth/popup-blocked") {
        desc = "Pop-up login diblokir oleh browser. Harap ijinkan pop-up untuk situs ini dan coba lagi.";
      } else if (desc.includes("unauthorized-domain") || error.code === "auth/unauthorized-domain") {
        desc = "Domain ini belum diotorisasi (unauthorized-domain) di Firebase Console Anda. Harap tambahkan domain pratinjau ini ke Authorized Domains di setelan Authentication Anda.";
      }
      setErrorMessage(desc);
    } finally {
      setLoading(false);
    }
  };

  // Safe parsing and validating of Firebase Config JSON
  const handleSaveConfig = () => {
    setErrorMessage(null);
    setConfigSuccessMessage(null);
    try {
      const parsed = JSON.parse(currentConfigText);
      
      // Simple validation for critical keys
      if (!parsed.apiKey || !parsed.projectId || !parsed.authDomain) {
        throw new Error("Format tidak valid! Minimal harus berisi 'apiKey', 'authDomain', dan 'projectId'.");
      }
      
      localStorage.setItem("custom_firebase_config", JSON.stringify(parsed, null, 2));
      setHasCustomConfig(true);
      setConfigSuccessMessage("Konfigurasi disimpan! Memuat ulang sistem...");
      
      // Reload page immediately to apply the new Firebase app instance
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengurai JSON. Pastikan format JSON sudah benar.");
    }
  };

  // Clear custom config and fallback to system default
  const handleResetConfig = () => {
    localStorage.removeItem("custom_firebase_config");
    setHasCustomConfig(false);
    const defaultConfig = getFirebaseConfig();
    setCurrentConfigText(JSON.stringify(defaultConfig, null, 2));
    setConfigSuccessMessage("Kembali ke konfigurasi default. Memuat ulang...");
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 selection:bg-brand-ice/50 selection:text-brand-wine relative overflow-x-hidden">
      {/* Soft background glow circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-teal/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-wine/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden relative z-10"
        id="login-card-clean"
      >
        <div className="h-2 bg-gradient-to-r from-brand-teal via-brand-ice to-brand-wine" />

        <div className="p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              {/* identity and small settings toggler */}
              <div className="w-12 h-12 bg-brand-teal/10 rounded-2xl flex items-center justify-center text-brand-teal">
                <Database className="w-6 h-6 animate-pulse" />
              </div>
              <button
                onClick={() => setShowConfigModal(true)}
                className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition duration-150 relative cursor-pointer"
                title="Atur Firebase Sendiri"
                id="open-config-btn"
              >
                <Settings className={`w-5 h-5 ${hasCustomConfig ? "text-brand-teal animate-spin-slow" : ""}`} />
                {hasCustomConfig && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-brand-teal border-2 border-white rounded-full" />
                )}
              </button>
            </div>

            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-4">
              GB - Productivity
            </h1>

            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Selamat datang kembali! Masuk aman menggunakan Google Sign-In untuk mengelola seluruh pencatatan jam produktif dan kebiasaan harian Anda.
            </p>

            {/* Error alerts */}
            {errorMessage && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3 text-rose-700 text-xs items-start leading-normal">
                <Terminal className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block mb-1">Terjadi Masalah Otorisasi / Koneksi:</span>
                  <span className="font-mono text-[10px] break-all block">{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Success message */}
            {configSuccessMessage && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3 text-emerald-700 text-xs items-center leading-normal">
                <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="font-semibold">{configSuccessMessage}</span>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2">
            {/* Direct Firebase Authorized Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-brand-teal hover:bg-brand-teal/90 text-white font-semibold py-3.5 px-4 rounded-2xl transition duration-200 outline-none focus:ring-2 focus:ring-brand-teal/35 active:scale-[0.99] disabled:opacity-75 disabled:pointer-events-none text-xs shadow-sm cursor-pointer"
              id="google-signin-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                    <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.133 1 1.134 6 1.134 12s4.99 11 11.106 11c6.378 0 10.608-4.483 10.608-10.79 0-.727-.08-1.281-.176-1.925H12.24z"/>
                  </svg>
                  <span>Masuk dengan Akun Google</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Slide-Up Custom Config Modal / Section */}
      <AnimatePresence>
        {showConfigModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            id="json-config-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden"
              id="json-config-dialog"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-brand-teal animate-spin-slow" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 leading-none">Konfigurasi Firebase Sendiri</h3>
                    <span className="text-[9px] text-slate-400 font-mono">Simpan kredensial privat di browser Anda</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-400 hover:text-slate-600 transition"
                  id="close-config-modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tempelkan objek konfigurasi Web App Firebase yang Anda peroleh dari Firebase Console (format JSON lengkap). Data ini disimpan secara lokal di mesin Anda dan tidak dikirim ke server luar manapun.
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Firebase Config JSON:
                  </label>
                  <textarea
                    value={currentConfigText}
                    onChange={(e) => setCurrentConfigText(e.target.value)}
                    rows={8}
                    className="w-full p-3 font-mono text-[10px] bg-slate-900 text-emerald-400 border border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-teal leading-relaxed select-all"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex gap-2 items-start font-mono text-[10px]">
                    <Terminal className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {configSuccessMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs flex gap-2 items-center font-medium">
                    <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span>{configSuccessMessage}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 justify-between pt-2 border-t border-slate-100">
                  {hasCustomConfig ? (
                    <button
                      onClick={handleResetConfig}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold hover:underline cursor-pointer"
                      id="reset-config-btn"
                    >
                      Hapus Custom Config
                    </button>
                  ) : (
                    <div />
                  )}
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowConfigModal(false)}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-xl text-xs transition cursor-pointer"
                      id="cancel-save-config"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveConfig}
                      className="px-5 py-2.5 bg-brand-teal hover:bg-brand-teal/90 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center gap-1.5"
                      id="save-config-btn"
                    >
                      <Check className="w-4 h-4" />
                      Simpan & Muat Ulang
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
