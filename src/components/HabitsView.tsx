import React, { useState, useMemo } from "react";
import { DailyRecord, UserConfig, HabitGroup } from "../types";
import { saveDailyRecord } from "../lib/firebase";
import { CheckSquare, Calendar, ChevronLeft, ChevronRight, Award, Flame, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HabitsViewProps {
  userId: string;
  config: UserConfig;
  daysData: Record<string, DailyRecord>;
  onDataUpdated: (dateId: string, completed: string[]) => void;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const WEEKDAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function HabitsView({
  userId,
  config,
  daysData,
  onDataUpdated
}: HabitsViewProps) {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 0-indexed

  // Format YYYY-MM-DD
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const r = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${r}`;
  };

  const [activeDateStr, setActiveDateStr] = useState<string>(formatLocalDate(today));

  // Extract only active/enabled groups and items
  const activeHabitsConfig = useMemo(() => {
    return (config.habitsConfig || [])
      .filter(g => g.enabled !== false)
      .map(g => {
        const rawItems = g.items || [];
        const activeItems = rawItems.map((item, index) => {
          if (typeof item === "string") {
            return {
              id: "item_legacy_" + index + "_" + encodeURIComponent(item),
              name: item,
              description: "",
              enabled: true
            };
          }
          return {
            id: item.id || `item_${index}`,
            name: item.name || "",
            description: item.description || "",
            enabled: item.enabled !== false
          };
        }).filter(it => it.enabled);

        return {
          ...g,
          items: activeItems
        };
      });
  }, [config.habitsConfig]);

  // Set first group as expanded initially
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(
    activeHabitsConfig.length > 0 ? activeHabitsConfig[0].id : null
  );

  // Total possible active habits defined
  const totalHabitsAvailable = useMemo(() => {
    return activeHabitsConfig.reduce((acc, group) => acc + group.items.length, 0);
  }, [activeHabitsConfig]);

  // Calendar calculations
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const numDays = getDaysInMonth(selectedYear, selectedMonth);
  const firstDayOffset = getFirstDayOffset(selectedYear, selectedMonth);

  const daysArray = Array.from({ length: numDays }, (_, i) => i + 1);
  const blankDaysArray = Array.from({ length: firstDayOffset }, (_, i) => i);

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(v => v - 1);
    } else {
      setSelectedMonth(v => v - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(v => v + 1);
    } else {
      setSelectedMonth(v => v + 1);
    }
  };

  // Check if a habit item is completed on a date (support old and new id checks)
  const isHabitCompleted = (dateStr: string, groupId: string, item: any) => {
    const completed = daysData[dateStr]?.completedHabits || [];
    const itemId = typeof item === "string" ? item : item.id;
    const itemName = typeof item === "string" ? item : item.name;

    const keyWithId = `${groupId}::${itemId}`;
    const keyWithLegacy = `${groupId}::${itemName}`;

    return completed.includes(keyWithId) || completed.includes(keyWithLegacy);
  };

  // Toggle record completion status
  const handleToggleHabit = async (groupId: string, item: any) => {
    const itemId = typeof item === "string" ? item : item.id;
    const itemName = typeof item === "string" ? item : item.name;

    const keyWithId = `${groupId}::${itemId}`;
    const keyWithLegacy = `${groupId}::${itemName}`;

    const existingCompleted = daysData[activeDateStr]?.completedHabits || [];
    const hasId = existingCompleted.includes(keyWithId);
    const hasLegacy = existingCompleted.includes(keyWithLegacy);

    let newCompleted: string[];
    if (hasId || hasLegacy) {
      // Remove references
      newCompleted = existingCompleted.filter(k => k !== keyWithId && k !== keyWithLegacy);
    } else {
      // Add id reference
      newCompleted = [...existingCompleted, keyWithId];
    }

    try {
      const existingRecord = daysData[activeDateStr] || { hours: 0, completedHabits: [] };
      const updatedRecord = { ...existingRecord, completedHabits: newCompleted };

      await saveDailyRecord(userId, activeDateStr, updatedRecord);
      onDataUpdated(activeDateStr, newCompleted);
    } catch (err) {
      console.error("Gagal mengubah penyelesaian habit:", err);
    }
  };

  // Selected date statistics
  const activeDayCompletedCount = useMemo(() => {
    return activeHabitsConfig.reduce((acc, group) => {
      const completedList = group.items.filter(item =>
        isHabitCompleted(activeDateStr, group.id, item)
      );
      return acc + completedList.length;
    }, 0);
  }, [activeDateStr, daysData, activeHabitsConfig]);

  const renderActiveDateFriendly = () => {
    const parts = activeDateStr.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  // Calculate current active streak on any habit
  const calculateStreak = () => {
    let streak = 0;
    const tempDate = new Date();
    while (true) {
      const dateStr = formatLocalDate(tempDate);
      const completes = daysData[dateStr]?.completedHabits || [];
      
      // Filter completes to match only currently active habits
      const hasAnyActiveComplete = activeHabitsConfig.some(g => 
        g.items.some(item => isHabitCompleted(dateStr, g.id, item))
      );

      if (hasAnyActiveComplete) {
        streak++;
        tempDate.setDate(tempDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const currentStreak = calculateStreak();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="habits-view-container">
      {/* LEFT COLUMN: Calendar (7 Cols) */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="habit-calendar-card">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-teal" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Kalender Habits</h3>
                <p className="text-[11px] text-slate-400">Ketuk tanggal untuk mencatat pencapaian</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition"
                id="cal-prev-month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-700 min-w-[120px] text-center">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition"
                id="cal-next-month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {/* Weekdays Row */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">
              {WEEKDAY_NAMES.map(name => (
                <div key={name}>{name}</div>
              ))}
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 gap-2" id="dates-grid">
              {blankDaysArray.map(offsetIdx => (
                <div key={`blank-${offsetIdx}`} className="aspect-square bg-slate-50/30 rounded-xl" />
              ))}

              {daysArray.map((day) => {
                const dayStr = String(day).padStart(2, "0");
                const monthStr = String(selectedMonth + 1).padStart(2, "0");
                const fullDateKey = `${selectedYear}-${monthStr}-${dayStr}`;

                const isSelected = activeDateStr === fullDateKey;

                // Group color completions for this specific cell
                const colorDetails = activeHabitsConfig.map(g => {
                  const completedCount = g.items.filter(it =>
                    isHabitCompleted(fullDateKey, g.id, it)
                  ).length;
                  return {
                    id: g.id,
                    name: g.name,
                    color: g.color || "teal",
                    count: completedCount
                  };
                }).filter(d => d.count > 0);

                const totalCompleted = colorDetails.reduce((sum, d) => sum + d.count, 0);

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => setActiveDateStr(fullDateKey)}
                    className={`min-h-[64px] p-2 rounded-xl border flex flex-col justify-between items-center transition relative group ${
                      isSelected
                        ? "border-brand-wine bg-brand-wine/5 shadow-inner ring-1 ring-brand-wine/25"
                        : "border-slate-100 bg-white hover:border-brand-teal/50"
                    }`}
                  >
                    {/* Top Row inside cell: Day number and total completed count badge */}
                    <div className="w-full flex items-center justify-between">
                      <span className={`text-xs font-bold ${
                        isSelected ? "text-brand-wine font-extrabold" : "text-slate-700"
                      }`}>
                        {day}
                      </span>
                      
                      {totalCompleted > 0 && (
                        <span className="text-[9px] font-extrabold text-slate-755 bg-slate-100 px-1 rounded-md leading-none py-0.5" title="Total tugas selesai hari ini">
                          {totalCompleted}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row inside cell: Category color pill badges */}
                    {totalCompleted > 0 ? (
                      <div className="flex flex-wrap justify-center gap-0.5 mt-2 w-full">
                        {colorDetails.map(detail => {
                          const bgColors: Record<string, string> = {
                            teal: "bg-teal-500 text-teal-50",
                            emerald: "bg-emerald-500 text-emerald-50",
                            indigo: "bg-indigo-500 text-indigo-50",
                            rose: "bg-rose-500 text-rose-50",
                            amber: "bg-amber-500 text-amber-950",
                            purple: "bg-purple-500 text-purple-50",
                            slate: "bg-slate-500 text-slate-50",
                          };
                          const badgeColor = bgColors[detail.color] || "bg-teal-500 text-teal-50";

                          return (
                            <span 
                              key={detail.id}
                              className={`text-[8px] font-extrabold h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0 ${badgeColor}`}
                              title={`${detail.name}: ${detail.count} selesai`}
                            >
                              {detail.count}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-slate-300 transition mt-auto mb-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Streak & Metrics overview */}
        <div className="grid grid-cols-2 gap-4" id="habit-highlights">
          <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="p-3.5 bg-rose-50 text-brand-wine rounded-xl">
              <Flame className="w-6 h-6 fill-brand-wine/20" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                Rantai Kebiasaan
              </span>
              <h4 className="text-xl font-extrabold text-slate-800 leading-tight">
                {currentStreak} Hari Beruntun
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Hari aktif berturut-turut</p>
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="p-3.5 bg-brand-teal/10 text-brand-teal rounded-xl">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                Hari Ini ({today.getDate()} {MONTH_NAMES[today.getMonth()]})
              </span>
              <h4 className="text-xl font-extrabold text-slate-800 leading-tight">
                {daysData[formatLocalDate(today)]?.completedHabits?.length || 0} / {totalHabitsAvailable}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Habits aktif terselesaikan</p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Habits checklists (5 Cols) */}
      <div className="lg:col-span-12 xl:col-span-5 space-y-4">
        <div className="bg-brand-teal/10 border border-brand-teal/20 p-4 rounded-xl flex items-center justify-between">
          <div className="text-xs">
            <span className="text-slate-450 block font-bold uppercase tracking-wider">Mencatat Kebiasaan</span>
            <span className="text-brand-teal font-extrabold text-sm block mt-0.5">{renderActiveDateFriendly()}</span>
          </div>
          <span className="text-xs px-2.5 py-1 bg-brand-teal/25 text-brand-teal rounded-full font-bold">
            {activeDayCompletedCount} Selesai
          </span>
        </div>

        {/* Habit Groups Loop list */}
        <div className="space-y-3" id="habit-groups-list">
          {activeHabitsConfig.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
              <CheckSquare className="w-12 h-12 text-slate-350 mx-auto mb-3" />
              <h4 className="text-slate-700 font-bold mb-1">Belum ada panel habits aktif</h4>
              <p className="text-xs text-slate-450 leading-relaxed">
                Silakan tambahkan panel habits baru, isi daftar kebiasaan, dan pastikan status panel serta tugas dicentang **aktif** di tab **Pengaturan**.
              </p>
            </div>
          ) : (
            activeHabitsConfig.map((group) => {
              const isExpanded = expandedGroupId === group.id;
              const groupItems = group.items;
              const completedInGroup = groupItems.filter(item =>
                isHabitCompleted(activeDateStr, group.id, item)
              );
              const groupDoneCount = completedInGroup.length;
              const isGroupCompleted = groupItems.length > 0 && groupDoneCount === groupItems.length;
              const groupColor = group.color || "teal";

              return (
                <div
                  key={group.id}
                  className={`bg-white rounded-xl border transition-all duration-150 shadow-sm overflow-hidden ${
                    isExpanded ? "border-brand-teal ring-2 ring-brand-teal/10" : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  {/* Category Header */}
                  <button
                    onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                    className="w-full text-left p-4 flex items-center justify-between outline-none cursor-pointer"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full bg-${groupColor}-500 inline-block`} />
                        {group.name}
                        {isGroupCompleted && (
                          <span className="p-0.5 bg-emerald-50 text-emerald-600 rounded-full">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {groupDoneCount} dari {groupItems.length} selesai
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isGroupCompleted
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {groupItems.length > 0 ? Math.round((groupDoneCount / groupItems.length) * 100) : 0}%
                      </span>
                      <span className="text-slate-400 text-xs transition-transform transform duration-150" style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}>
                        &rarr;
                      </span>
                    </div>
                  </button>

                  {/* Tasks list checklist */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100 bg-slate-50/25 divide-y divide-slate-100"
                      >
                        {groupItems.length === 0 ? (
                          <p className="p-4 text-xs text-slate-400 text-center italic">
                            Tidak ada item kebiasaan aktif dalam kelompok ini.
                          </p>
                        ) : (
                          groupItems.map((item) => {
                            const isChecked = isHabitCompleted(activeDateStr, group.id, item);

                            return (
                              <button
                                key={item.id}
                                onClick={() => handleToggleHabit(group.id, item)}
                                className="w-full text-left p-3.5 sm:px-5 flex items-start gap-3 transition-colors hover:bg-white outline-none group/item cursor-pointer"
                              >
                                <div className="shrink-0 mt-0.5">
                                  {isChecked ? (
                                    <div className={`w-4.5 h-4.5 rounded bg-${groupColor}-500 text-white flex items-center justify-center transition`}>
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    </div>
                                  ) : (
                                    <div className={`w-4.5 h-4.5 rounded border-2 border-slate-300 group-hover/item:border-${groupColor}-500 transition`} />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <span className={`text-xs font-bold block leading-snug ${
                                    isChecked ? "text-slate-400 line-through decoration-slate-300 opacity-60" : "text-slate-700"
                                  }`}>
                                    {item.name}
                                  </span>
                                  {item.description ? (
                                    <span className="text-[10px] text-slate-450 block mt-0.5 leading-relaxed">
                                      {item.description}
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
