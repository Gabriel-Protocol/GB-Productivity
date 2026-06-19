import React, { useState } from "react";
import { UserConfig, HabitGroup } from "../types";
import { saveUserConfig, auth, signOut } from "../lib/firebase";
import { Sliders, CheckSquare, Sun, Moon, LogOut, Plus, Trash2, Edit2, Check, UserCircle2, Save, Sparkles, FolderEdit } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SettingsViewProps {
  userId: string;
  config: UserConfig;
  onConfigUpdated: (newConfig: UserConfig) => void;
  onLogout: () => void;
}

export default function SettingsView({
  userId,
  config,
  onConfigUpdated,
  onLogout
}: SettingsViewProps) {
  // Threshold States
  const [vBad, setVBad] = useState<number>(config.thresholdVeryBad);
  const [bad, setBad] = useState<number>(config.thresholdBad);
  const [fair, setFair] = useState<number>(config.thresholdFair);

  // New Habit Group form
  const [newGroupName, setNewGroupName] = useState("");
  // New Item states per group (mapped as groupId: text)
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});

  // Error/Success visual signals
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Sign out user logic
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onLogout();
    } catch (err) {
      console.error("Gagal keluar:", err);
    }
  };

  // Save the custom productive thresholds
  const handleSaveThresholds = async () => {
    if (vBad >= bad) {
      setStatusMsg({ type: "error", text: "Batas 'Sangat Jelek' harus lebih rendah dari 'Jelek'." });
      return;
    }
    if (bad >= fair) {
      setStatusMsg({ type: "error", text: "Batas 'Jelek' harus lebih rendah dari 'Cukup'." });
      return;
    }

    setSavingSettings(true);
    setStatusMsg(null);

    const updatedConfig: Partial<UserConfig> = {
      thresholdVeryBad: Number(vBad),
      thresholdBad: Number(bad),
      thresholdFair: Number(fair)
    };

    try {
      await saveUserConfig(userId, updatedConfig);
      onConfigUpdated({ ...config, ...updatedConfig });
      setStatusMsg({ type: "success", text: "Batas indikator jam produktif berhasil disimpan!" });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setStatusMsg({ type: "error", text: "Gagal menyimpan konfigurasi ke cloud." });
    } finally {
      setSavingSettings(false);
    }
  };

  // Toggle Theme between Light and Dark
  const handleToggleTheme = async (mode: "light" | "dark") => {
    try {
      await saveUserConfig(userId, { theme: mode });
      onConfigUpdated({ ...config, theme: mode });
    } catch (err) {
      console.error("Gagal memperbarui tema:", err);
    }
  };

  // Create a new Habit Group Panel
  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup: HabitGroup = {
      id: "g" + Date.now(),
      name: newGroupName.trim(),
      items: []
    };

    const newHabitsConfig = [...config.habitsConfig, newGroup];
    try {
      await saveUserConfig(userId, { habitsConfig: newHabitsConfig });
      onConfigUpdated({ ...config, habitsConfig: newHabitsConfig });
      setNewGroupName("");
      setStatusMsg({ type: "success", text: `Panel habits "${newGroup.name}" berhasil ditambahkan!` });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setStatusMsg({ type: "error", text: "Gagal menambahkan panel habits baru." });
    }
  };

  // Delete an entire Habit Group
  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    const isConfirmed = window.confirm(`Apakah Anda yakin ingin menghapus panel habits "${groupName}" beserta semua to-do list di dalamnya?`);
    if (!isConfirmed) return;

    const newHabitsConfig = config.habitsConfig.filter(g => g.id !== groupId);
    try {
      await saveUserConfig(userId, { habitsConfig: newHabitsConfig });
      onConfigUpdated({ ...config, habitsConfig: newHabitsConfig });
      setStatusMsg({ type: "success", text: "Panel habits berhasil dihapus." });
      setTimeout(() => setStatusMsg(null), 3050);
    } catch (err) {
      setStatusMsg({ type: "error", text: "Gagal menghapus panel habits." });
    }
  };

  // Add a task item to a specific Habit Group Panel
  const handleAddTaskItem = async (groupId: string) => {
    const textToAdd = newItemTexts[groupId]?.trim();
    if (!textToAdd) return;

    const updatedHabits = config.habitsConfig.map((group) => {
      if (group.id === groupId) {
        // Prevent duplicate items in the same panel
        if (group.items.includes(textToAdd)) return group;
        return {
          ...group,
          items: [...group.items, textToAdd]
        };
      }
      return group;
    });

    try {
      await saveUserConfig(userId, { habitsConfig: updatedHabits });
      onConfigUpdated({ ...config, habitsConfig: updatedHabits });

      // Clear text
      setNewItemTexts(prev => ({ ...prev, [groupId]: "" }));
    } catch (err) {
      console.error("Gagal menambahkan item:", err);
    }
  };

  // Delete a specific task item from a Habit Group Panel
  const handleDeleteTaskItem = async (groupId: string, itemToDelete: string) => {
    const updatedHabits = config.habitsConfig.map((group) => {
      if (group.id === groupId) {
        return {
          ...group,
          items: group.items.filter(item => item !== itemToDelete)
        };
      }
      return group;
    });

    try {
      await saveUserConfig(userId, { habitsConfig: updatedHabits });
      onConfigUpdated({ ...config, habitsConfig: updatedHabits });
    } catch (err) {
      console.error("Gagal menghapus item:", err);
    }
  };

  const userEmail = auth.currentUser?.email || "Pengguna Google";
  const userDisplayName = auth.currentUser?.displayName || "Tanpa Nama";
  const userPhotoUrl = auth.currentUser?.photoURL;

  return (
    <div className="space-y-6" id="settings-view">
      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold border flex gap-3 items-center ${
            statusMsg.type === "success"
              ? "bg-teal-50 border-teal-100 text-teal-800"
              : "bg-rose-50 border-rose-100 text-brand-wine"
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Grid: Indicators Configuration & Theme */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bounds management card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sliders className="w-5 h-5 text-brand-teal" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Batas Indikator Jam Produktif</h3>
              <p className="text-[10px] text-slate-400">Sesuaikan rentang waktu per hari</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 flex justify-between">
                <span>Batas Sangat Jelek (maksimal jam):</span>
                <span className="text-brand-wine font-extrabold">{vBad} Jam</span>
              </label>
              <input
                type="range"
                min="0"
                max="12"
                step="0.5"
                value={vBad}
                onChange={(e) => setVBad(parseFloat(e.target.value))}
                className="w-full accent-brand-wine h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">&#8804; {vBad} Jam adalah "Sangat Jelek"</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 flex justify-between">
                <span>Batas Jelek (maksimal jam):</span>
                <span className="text-amber-600 font-extrabold">{bad} Jam</span>
              </label>
              <input
                type="range"
                min="1"
                max="16"
                step="0.5"
                value={bad}
                onChange={(e) => setBad(parseFloat(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">{vBad + 0.1}-{bad} Jam adalah "Jelek"</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 flex justify-between">
                <span>Batas Cukup (maksimal jam):</span>
                <span className="text-brand-teal font-extrabold">{fair} Jam</span>
              </label>
              <input
                type="range"
                min="2"
                max="24"
                step="0.5"
                value={fair}
                onChange={(e) => setFair(parseFloat(e.target.value))}
                className="w-full accent-brand-teal h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">{bad + 0.1}-{fair} Jam adalah "Cukup" (&gt; {fair} Jam adalah "Bagus")</span>
            </div>

            <button
              onClick={handleSaveThresholds}
              disabled={savingSettings}
              className="w-full py-2.5 px-4 bg-brand-teal hover:bg-brand-teal/90 text-white font-semibold rounded-xl text-xs flex justify-center items-center gap-2 transition outline-none shadow-sm disabled:opacity-75"
              id="save-bounds-btn"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? "Menyimpan..." : "Simpan Batas Indikator"}</span>
            </button>
          </div>
        </div>

        {/* Theme Settings & Account Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sun className="w-5 h-5 text-brand-wine" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Gaya Tampilan Utama</h3>
                <p className="text-[10px] text-slate-400">Atur skema warna mode gelap / terang</p>
              </div>
            </div>

            {/* Light and dark toggle option blocks */}
            <div className="grid grid-cols-2 gap-3" id="theme-selector">
              <button
                onClick={() => handleToggleTheme("light")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition outline-none ${
                  config.theme === "light"
                    ? "border-brand-teal bg-brand-teal/5 text-brand-teal font-bold ring-1 ring-brand-teal/30"
                    : "border-slate-200 text-slate-450 hover:border-slate-300"
                }`}
                id="theme-light-btn"
              >
                <Sun className="w-5 h-5" />
                <span className="text-xs">Terang (Standard)</span>
              </button>

              <button
                onClick={() => handleToggleTheme("dark")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition outline-none ${
                  config.theme === "dark"
                    ? "border-brand-wine bg-brand-wine/5 text-brand-wine font-bold ring-1 ring-brand-wine/30"
                    : "border-slate-200 text-slate-450 hover:border-slate-300"
                }`}
                id="theme-dark-btn"
              >
                <Moon className="w-5 h-5" />
                <span className="text-xs">Gelap (Dark Mode)</span>
              </button>
            </div>
          </div>

          {/* User Account block */}
          <div className="bg-slate-50/70 p-4 border border-slate-100 rounded-xl flex items-center justify-between" id="account-card">
            <div className="flex items-center gap-3">
              {userPhotoUrl ? (
                <img
                  src={userPhotoUrl}
                  alt={userDisplayName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-brand-ice"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserCircle2 className="w-10 h-10 text-slate-400" />
              )}
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-800 truncate">{userDisplayName}</h4>
                <p className="text-[10px] text-slate-450 truncate">{userEmail}</p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="p-2 border border-rose-200 hover:border-rose-300 hover:bg-rose-50 text-rose-600 rounded-lg transition"
              title="Keluar dari Akun"
              id="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Habit Manager Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5" id="habit-panels-manager">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <CheckSquare className="w-5 h-5 text-brand-wine" />
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Kelola Panel Habits & To-Do List</h3>
            <p className="text-[10px] text-slate-400">Tambahkan kelompok habits baru dan kelola daftar kegiatannya</p>
          </div>
        </div>

        {/* Add new Group form */}
        <form onSubmit={handleAddGroup} className="flex gap-2 max-w-md">
          <input
            type="text"
            placeholder="Tambah nama panel baru (misal: Olahraga)"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="flex-1 py-1 px-3 border border-slate-200 rounded-xl text-xs focus:border-brand-teal outline-none"
          />
          <button
            type="submit"
            className="py-1 px-3 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </form>

        {/* Listing existing groups styled as small management cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.habitsConfig.map((group) => (
            <div key={group.id} className="bg-slate-50 border border-slate-100/50 rounded-xl p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-200">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FolderEdit className="w-3.5 h-3.5 text-brand-teal" />
                    {group.name}
                  </span>
                  <button
                    onClick={() => handleDeleteGroup(group.id, group.name)}
                    className="p-1 text-slate-350 hover:text-rose-600 transition"
                    title="Hapus Kelompok"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sub items under group */}
                <div className="mt-2 space-y-1">
                  {group.items.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">Belum ada daftar tugas dalam kelompok ini.</p>
                  ) : (
                    group.items.map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 text-[11px] text-slate-600"
                      >
                        <span className="truncate">{item}</span>
                        <button
                          onClick={() => handleDeleteTaskItem(group.id, item)}
                          className="text-slate-300 hover:text-rose-500 transition shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5 rotate-45 stroke-[2.5]" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add item input inside group */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Nama kebiasaan baru..."
                  value={newItemTexts[group.id] || ""}
                  onChange={(e) =>
                    setNewItemTexts((prev) => ({ ...prev, [group.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTaskItem(group.id);
                    }
                  }}
                  className="flex-1 py-1 px-2 pb-1.5 border border-slate-200 bg-white rounded-lg text-[11px] focus:border-brand-teal outline-none"
                />
                <button
                  onClick={() => handleAddTaskItem(group.id)}
                  className="p-1 px-2.5 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-lg text-xs"
                >
                  Tambahkan
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
