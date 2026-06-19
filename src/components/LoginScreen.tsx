/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { googleSignIn } from "../lib/firebase";
import { 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  CheckSquare, 
  Database,
  Terminal,
  RefreshCw,
  FolderLock
} from "lucide-react";
import { motion } from "motion/react";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDriveSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result?.user) {
        onLoginSuccess(result.user);
      }
    } catch (error: any) {
      console.error("Google Drive connection failure:", error);
      let desc = error.message || String(error);
      if (error.code === "auth/popup-blocked") {
        desc = "Pop-up login diblokir oleh browser. Harap ijinkan pop-up untuk domain ini dan coba lagi.";
      } else if (desc.includes("unauthorized-domain") || error.code === "auth/unauthorized-domain") {
        desc = "Hubungan Firebase Auth domain belum diotorisasi. Hubungi administrator atau pastikan setelan sudah benar.";
      }
      setErrorMessage(desc);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-brand-ice/50 selection:text-brand-wine">
      {/* Decorative gradient blur elements */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-teal/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-brand-wine/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative z-10"
        id="login-card"
      >
        {/* Sleek brand gradient top bar */}
        <div className="h-2 bg-gradient-to-r from-brand-teal via-brand-ice to-brand-wine" />

        <div className="p-8 flex flex-col items-center">
          {/* Main Google Drive / App logo */}
          <div className="w-16 h-16 bg-brand-teal/10 rounded-2xl flex items-center justify-center text-brand-teal mb-6 relative">
            <Database className="w-8 h-8" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-sm">
              GD
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight text-center mb-1">
            GP - Productivity
          </h1>
          <span className="text-[10px] text-brand-teal font-extrabold tracking-widest uppercase mb-4">
            Google Drive JSON Sync
          </span>

          <p className="text-xs text-slate-500 text-center max-w-sm mb-6 leading-relaxed">
            Pencatat waktu produktif harian dan pelacak kebiasaan (habits) yang menyimpan seluruh datanya secara pribadi langsung di **Google Drive** Anda sendiri.
          </p>

          {/* Sync Features Overview */}
          <div className="w-full space-y-3.5 mb-6 bg-slate-50/70 p-4 rounded-xl border border-slate-100/50">
            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-brand-teal/15 text-brand-teal mt-0.5">
                <FolderLock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-700">Penyimpanan Privat</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Data disimpan sebagai file terenkripsi <code className="bg-slate-250/20 px-1 rounded font-mono text-xs font-semibold">gd_productivity_data.json</code> di ruang privat Google Drive Anda.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-teal-100 text-teal-600 mt-0.5 animate-pulse">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-700">Sinkronisasi Instan</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Setiap jam produktif, checklist kebiasaan, maupun target yang diubah akan disinkronisasikan ke awan di latar belakang.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-indigo-50 text-indigo-500 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-700">Bebas Hambatan Domain</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Solusi pintar mengatasi limitasi domain dan pemblokiran database saat diakses dari GitHub Pages atau server statis.
                </p>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="w-full mb-6 p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex gap-2.5 text-rose-700 text-xs items-center leading-normal">
              <Terminal className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="flex-1 font-mono text-[10px] break-all">{errorMessage}</span>
            </div>
          )}

          {/* Official styled Google Sign In with Drive permissions button */}
          <button
            onClick={handleDriveSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-brand-teal hover:bg-brand-teal/90 text-white font-semibold py-3.5 px-4 rounded-xl transition duration-200 outline-none focus:ring-2 focus:ring-brand-teal/35 active:scale-[0.99] disabled:opacity-75 disabled:pointer-events-none text-xs shadow-sm cursor-pointer"
            id="drive-signin-btn"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.133 1 1.134 6 1.134 12s4.99 11 11.106 11c6.378 0 10.608-4.483 10.608-10.79 0-.727-.08-1.281-.176-1.925H12.24z"
                  />
                </svg>
                <span>Masuk & Sinkronkan ke Google Drive</span>
              </>
            )}
          </button>

          <div className="w-full text-center mt-6">
            <span className="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 inline" />
              Sertifikat Keamanan Workspace Terverifikasi
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
