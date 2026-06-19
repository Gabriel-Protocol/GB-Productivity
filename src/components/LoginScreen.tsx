import React, { useState } from "react";
import { auth, signInWithPopup, GoogleAuthProvider } from "../lib/firebase";
import { LogIn, ShieldAlert, Sparkles, Clock, CheckSquare } from "lucide-react";
import { motion } from "motion/react";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    const provider = new GoogleAuthProvider();
    // Force account selection to avoid auto-signing into stale accounts
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        onLoginSuccess(result.user);
      }
    } catch (error: any) {
      console.error("Login Error:", error);
      setErrorMessage(
        error.message || "Gagal masuk menggunakan Google. Harap coba lagi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-brand-ice/50 selection:text-brand-wine">
      {/* Decorative gradient elements */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-teal/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-brand-wine/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative z-10"
        id="login-card"
      >
        {/* Colorful top bar matching the branding colors */}
        <div className="h-2 bg-gradient-to-r from-brand-teal via-brand-ice to-brand-wine" />

        <div className="p-8 flex flex-col items-center">
          {/* Logo icon representation */}
          <div className="w-16 h-16 bg-brand-teal/10 rounded-2xl flex items-center justify-center text-brand-teal mb-6">
            <Sparkles className="w-8 h-8" />
          </div>

          <h1 className="text-3xl font-bold text-slate-800 tracking-tight text-center mb-2">
            GB - Productivity
          </h1>
          <p className="text-sm text-slate-500 text-center max-w-sm mb-8 leading-relaxed">
            Pencatat waktu produktif harian dan pelacak kebiasaan (habits) yang
            aman, terkoneksi langsung dengan Google Cloud.
          </p>

          {/* Features Highlights */}
          <div className="w-full space-y-4 mb-8 bg-slate-50/70 p-4 rounded-xl border border-slate-100/50">
            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-brand-teal/15 text-brand-teal mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-700">Jam Produktif</h4>
                <p className="text-[11px] text-slate-500">
                  Pantau jam kerja produktif bulanan lengkap dengan indikator berkategori instan.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-brand-wine/15 text-brand-wine mt-0.5">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-700">Pelacak Kebiasaan (Habits)</h4>
                <p className="text-[11px] text-slate-500">
                  Panel interaktif to-do list untuk melatih disiplin harian terintegrasi kalender.
                </p>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="w-full mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-rose-700 text-xs items-center leading-normal">
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-brand-teal hover:bg-brand-teal/90 text-white font-medium py-3 px-4 rounded-xl transition duration-200 outline-none focus:ring-2 focus:ring-brand-teal/30 active:scale-[0.99] disabled:opacity-75 disabled:pointer-events-none"
            id="google-signin-btn"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.133 1 1.134 6 1.134 12s4.99 11 11.106 11c6.378 0 10.608-4.483 10.608-10.79 0-.727-.08-1.281-.176-1.925H12.24z"
                  />
                </svg>
                <span>Masuk dengan Google</span>
              </>
            )}
          </button>

          <p className="text-[10px] text-slate-400 mt-6 text-center">
            Dengan masuk, data Anda akan disimpan secara pribadi dan aman di Google Firestore Anda.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
