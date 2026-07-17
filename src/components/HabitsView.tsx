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
  const isDark = config.theme === "dark";
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

  // Selected date statistics (Strictly using currently active configurations)
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
    const dayNameStr = d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    return dayNameStr;
  };

  // Calculate current active streak on any habit
  const calculateStreak = () => {
    let streak = 0;
    const tempDate = new Date();
    while (true) {
      const dateStr = formatLocalDate(tempDate);
      
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

  // Strict metric today completed habits counting ONLY active checklist setups
  const todayDateStr = formatLocalDate(today);
  const todayCompletedCount = useMemo(() => {
    return activeHabitsConfig.reduce((acc, group) => {
      const completedList = group.items.filter(item =>
        isHabitCompleted(todayDateStr, group.id, item)
      );
      return acc + completedList.length;
    }, 0);
  }, [todayDateStr, daysData, activeHabitsConfig]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="habits-view-container">
      {/* LEFT COLUMN: Calendar (7 Cols) */}
      <div className="lg:col-span-7 space-y-6">
        <div className={`rounded-2xl border shadow-sm overflow-hidden transition ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`} id="habit-calendar-card">
          <div className={`p-5 border-b flex items-center justify-between transition ${isDark ? "bg-slate-950/25 border-slate-805" : "border-slate-100 bg-slate-50/20"}`}>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-teal" />
              <div>
                <h3 className={`font-bold text-sm ${isDark ? "text-slate-100" : "text-slate-800"}`}>Kalender Habits</h3>
                <p className="text-[11px] text-slate-400">Ketuk tanggal untuk mencatat pencapaian</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className={`p-1.5 border rounded-lg transition cursor-pointer ${isDark ? "border-slate-800 text-slate-400 hover:bg-slate-800/40" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                id="cal-prev-month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className={`text-xs font-bold min-w-[120px] text-center ${isDark ? "text-slate-100" : "text-slate-700"}`}>
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              <button
                onClick={nextMonth}
                className={`p-1.5 border rounded-lg transition cursor-pointer ${isDark ? "border-slate-800 text-slate-400 hover:bg-slate-800/40" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                id="cal-next-month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {/* Weekdays Row */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-extrabold uppercase tracking-widest mb-3">
              {WEEKDAY_NAMES.map((name, idx) => {
                const isWeekend = idx === 0 || idx === 6;
                return (
                  <div
                    key={name}
                    className={isWeekend ? "text-rose-500 dark:text-rose-400 font-bold" : "text-slate-400"}
                  >
                    {name}
                  </div>
                );
              })}
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 gap-2" id="dates-grid">
              {blankDaysArray.map(offsetIdx => (
                <div key={`blank-${offsetIdx}`} className={`aspect-square rounded-xl ${isDark ? "bg-slate-950/25" : "bg-slate-50/30"}`} />
              ))}

              {daysArray.map((day) => {
                const dayStr = String(day).padStart(2, "0");
                const monthStr = String(selectedMonth + 1).padStart(2, "0");
                const fullDateKey = `${selectedYear}-${monthStr}-${dayStr}`;

                const isSelected = activeDateStr === fullDateKey;

                const dayDateObj = new Date(selectedYear, selectedMonth, day);
                const dayOfWeek = dayDateObj.getDay(); // 0 = Sunday, 6 = Saturday
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                // Group color completions for this specific cell (strictly using active settings)
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
                    className={`min-h-[64px] p-2 rounded-xl border flex flex-col justify-between items-center transition relative group cursor-pointer ${
                      isSelected
                        ? isDark 
                          ? "border-rose-500 bg-rose-950/30 text-rose-100 ring-1 ring-rose-500/20 shadow-inner"
                          : "border-brand-wine bg-brand-wine/5 shadow-inner ring-1 ring-brand-wine/25 text-brand-wine font-extrabold"
                        : isDark
                          ? isWeekend
                            ? "border-rose-950/40 bg-rose-950/10 hover:border-brand-teal/40 text-slate-300"
                            : "border-slate-800 bg-slate-950/40 hover:border-brand-teal/40 text-slate-300"
                          : isWeekend
                            ? "border-rose-100 bg-rose-50/20 hover:border-brand-teal/50 text-slate-700"
                            : "border-slate-100 bg-white hover:border-brand-teal/50 text-slate-700"
                    }`}
                  >
                    {/* Top Row inside cell: Day number and total completed count badge */}
                    <div className="w-full flex items-start justify-between gap-1">
                      <span className={`text-[11px] font-bold ${
                        isSelected 
                          ? isDark ? "text-rose-450 font-extrabold" : "text-brand-wine font-extrabold" 
                          : isWeekend
                            ? "text-rose-500 dark:text-rose-400 font-extrabold"
                            : isDark ? "text-slate-300" : "text-slate-700"
                      }`}>
                        {day}
                      </span>
                      
                      {totalCompleted > 0 && (
                        <span className={`text-[8px] font-extrabold px-1 rounded-md leading-none py-0.5 shrink-0 select-none ${
                          isDark ? "text-slate-300 bg-slate-800" : "text-slate-600 bg-slate-100"
                        }`} title="Total tugas selesai hari ini">
                          {totalCompleted}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row inside cell: Category color pill badges */}
                    {totalCompleted > 0 ? (
                      <div className="flex flex-wrap justify-center gap-0.5 mt-2 w-full">
                        {colorDetails.map(detail => {
                          const isHex = detail.color.startsWith("#");
                          const inlineStyle = isHex ? { backgroundColor: detail.color, color: "#fff" } : undefined;
                          
                          const bgColors: Record<string, string> = {
                            teal: "bg-teal-500 text-teal-50",
                            emerald: "bg-emerald-500 text-emerald-50",
                            indigo: "bg-indigo-500 text-indigo-50",
                            rose: "bg-rose-500 text-rose-50",
                            amber: "bg-amber-500 text-amber-950",
                            purple: "bg-purple-500 text-purple-50",
                            slate: "bg-slate-500 text-slate-50",
                          };
                          const badgeColor = isHex ? "" : (bgColors[detail.color] || "bg-teal-500 text-teal-50");

                          return (
                            <span 
                              key={detail.id}
                              style={inlineStyle}
                              className={`text-[8px] font-extrabold h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0 ${badgeColor}`}
                              title={`${detail.name}: ${detail.count} selesai`}
                            >
                              {detail.count}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full transition mt-auto mb-1 ${isDark ? "bg-slate-800 group-hover:bg-slate-700" : "bg-slate-200 group-hover:bg-slate-300"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Streak & Metrics overview */}
        <div className="grid grid-cols-2 gap-4" id="habit-highlights">
          {/* Flame Card: dynamic display sizes to prevent Mobile-Portrait boundary break */}
          <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-800"}`}>
            <div className={`p-2.5 sm:p-3.5 rounded-xl shrink-0 w-fit ${isDark ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-brand-wine"}`}>
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 fill-current/20" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold block uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">
                Rantai Kebiasaan
              </span>
              <h4 className="text-xs sm:text-base md:text-lg font-extrabold leading-tight truncate">
                {currentStreak} Hari Beruntun
              </h4>
              <p className="text-[8px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Hari aktif berturut-turut</p>
            </div>
          </div>

          {/* Active completed habits badge (Strict calculation, dynamic sizing) */}
          <div className={`p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-800"}`}>
            <div className={`p-2.5 sm:p-3.5 rounded-xl shrink-0 w-fit ${isDark ? "bg-teal-950/40 text-brand-teal" : "bg-brand-teal/10 text-brand-teal"}`}>
              <Award className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold block uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">
                Hari Ini ({today.getDate()} {MONTH_NAMES[today.getMonth()]})
              </span>
              <h4 className="text-xs sm:text-base md:text-lg font-extrabold leading-tight truncate">
                {todayCompletedCount} / {totalHabitsAvailable}
              </h4>
              <p className="text-[8px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Habits aktif terselesaikan</p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Habits checklists (5 Cols) */}
      <div className="lg:col-span-12 xl:col-span-5 space-y-4">
        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-xs ${isDark ? "bg-slate-950/20 border-slate-800" : "bg-brand-teal/10 border-brand-teal/20"}`}>
          <div className="text-xs">
            <span className="text-slate-400 dark:text-slate-500 block font-bold uppercase tracking-wider">Mencatat Kebiasaan</span>
            <span className="text-brand-teal font-extrabold text-sm block mt-0.5">{renderActiveDateFriendly()}</span>
          </div>
          <span className="text-xs px-2.5 py-1 bg-brand-teal text-white rounded-full font-bold">
            {activeDayCompletedCount} Selesai
          </span>
        </div>

        {/* Habit Groups Loop list */}
        <div className="space-y-3" id="habit-groups-list">
          {activeHabitsConfig.length === 0 ? (
            <div className={`rounded-2xl p-8 border text-center ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
              <CheckSquare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className={`font-bold mb-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>Belum ada panel habits aktif</h4>
              <p className="text-xs text-slate-405 leading-relaxed">
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
              const isHexColor = groupColor.startsWith("#");

              return (
                <div
                  key={group.id}
                  className={`rounded-xl border transition-all duration-150 shadow-sm overflow-hidden ${
                    isExpanded 
                      ? isDark 
                        ? "border-brand-teal ring-2 ring-brand-teal/20 bg-slate-900/60" 
                        : "border-brand-teal ring-2 ring-brand-teal/10 bg-white" 
                      : isDark 
                        ? "border-slate-800 bg-slate-900 hover:border-slate-755" 
                        : "border-slate-100 bg-white hover:border-slate-200"
                  }`}
                >
                  {/* Category Header */}
                  <button
                    onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                    className="w-full text-left p-4 flex items-center justify-between outline-none cursor-pointer"
                  >
                    <div>
                      <h4 className={`font-bold text-sm flex items-center gap-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                        <span 
                          className={`w-2.5 h-2.5 rounded-full inline-block ${isHexColor ? "" : `bg-${groupColor}-500`}`} 
                          style={isHexColor ? { backgroundColor: groupColor } : undefined}
                        />
                        {group.name}
                        {isGroupCompleted && (
                          <span className={`p-0.5 rounded-full ${isDark ? "bg-emerald-950/40 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </h4>
                      {group.description && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {group.description}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {groupDoneCount} dari {groupItems.length} selesai
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isGroupCompleted
                          ? isDark ? "bg-emerald-950/40 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                          : isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
                      }`}>
                        {groupItems.length > 0 ? Math.round((groupDoneCount / groupItems.length) * 100) : 0}%
                      </span>
                      <span className="text-slate-450 text-xs transition-transform transform duration-150" style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}>
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
                        className={`border-t divide-y ${isDark ? "border-slate-800 bg-slate-950/20 divide-slate-800" : "border-slate-100 bg-slate-50/25 divide-slate-100"}`}
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
                                className={`w-full text-left p-3.5 sm:px-5 flex items-start gap-3 transition-colors outline-none group/item cursor-pointer ${
                                  isDark ? "hover:bg-slate-850/45" : "hover:bg-white"
                                }`}
                              >
                                <div className="shrink-0 mt-0.5">
                                  {isChecked ? (
                                    <div 
                                      className={`w-4.5 h-4.5 rounded text-white flex items-center justify-center transition ${isHexColor ? "" : `bg-${groupColor}-500`}`}
                                      style={isHexColor ? { backgroundColor: groupColor } : undefined}
                                    >
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    </div>
                                  ) : (
                                    <div className={`w-4.5 h-4.5 rounded border-2 transition ${
                                      isDark 
                                        ? `border-slate-700 group-hover/item:border-brand-teal` 
                                        : `border-slate-350 group-hover/item:border-${groupColor}-500`
                                    }`} />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <span className={`text-xs font-bold block leading-snug ${
                                    isChecked 
                                      ? "text-slate-505 dark:text-slate-500 line-through decoration-slate-300 opacity-60" 
                                      : isDark ? "text-slate-200" : "text-slate-700"
                                  }`}>
                                    {item.name}
                                  </span>
                                  {item.description ? (
                                    <span className="text-[10px] text-slate-400 block mt-0.5 leading-relaxed">
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
