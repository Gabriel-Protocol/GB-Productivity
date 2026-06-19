import React, { useState } from "react";
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

  // Currently inspected date for habit checking (formatted YYYY-MM-DD), defaulting to today
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const r = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${r}`;
  };

  const [activeDateStr, setActiveDateStr] = useState<string>(formatLocalDate(today));
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(
    config.habitsConfig.length > 0 ? config.habitsConfig[0].id : null
  );

  // Total possible habits defined in settings
  const totalHabitsAvailable = config.habitsConfig.reduce(
    (acc, group) => acc + group.items.length,
    0
  );

  // Calendar calculations
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    // 0: Sunday, 1: Monday, etc.
    return new Date(year, month, 1).getDay();
  };

  const numDays = getDaysInMonth(selectedYear, selectedMonth);
  const firstDayOffset = getFirstDayOffset(selectedYear, selectedMonth);

  // Generate date list for rendering
  const daysArray = Array.from({ length: numDays }, (_, i) => i + 1);
  const blankDaysArray = Array.from({ length: firstDayOffset }, (_, i) => i);

  // Quick month shifting
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

  // Check if a specific habit item is completed on a specific date
  const isHabitCompleted = (dateStr: string, habitUniqueKey: string) => {
    const completed = daysData[dateStr]?.completedHabits || [];
    return completed.includes(habitUniqueKey);
  };

  // Toggle habit item check state for the currently activeDateStr
  const handleToggleHabit = async (groupId: string, itemName: string) => {
    const habitUniqueKey = `${groupId}::${itemName}`;
    const existingCompleted = daysData[activeDateStr]?.completedHabits || [];

    let newCompleted: string[];
    if (existingCompleted.includes(habitUniqueKey)) {
      newCompleted = existingCompleted.filter(k => k !== habitUniqueKey);
    } else {
      newCompleted = [...existingCompleted, habitUniqueKey];
    }

    // Save to Firestore
    try {
      const existingRecord = daysData[activeDateStr] || { hours: 0, completedHabits: [] };
      const updatedRecord = { ...existingRecord, completedHabits: newCompleted };

      await saveDailyRecord(userId, activeDateStr, updatedRecord);
      onDataUpdated(activeDateStr, newCompleted);
    } catch (err) {
      console.error("Failed to toggle habit completion:", err);
    }
  };

  // Calculate stats for selected date
  const activeDayRecord = daysData[activeDateStr];
  const activeDayCompletedCount = activeDayRecord?.completedHabits?.length || 0;

  // Render a friendly format of active tracking date
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

  // Streak calculation (simple current streak of any habit completed)
  const calculateStreak = () => {
    let streak = 0;
    const tempDate = new Date();
    while (true) {
      const dateStr = formatLocalDate(tempDate);
      const completes = daysData[dateStr]?.completedHabits || [];
      if (completes.length > 0) {
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
      {/* LEFT COLUMN: Calendar & Micro-stats (7 Cols) */}
      <div className="lg:col-span-7 space-y-6">
        {/* Simple calendar panel */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="habit-calendar-card">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-teal" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Kalender Habits</h3>
                <p className="text-[11px] text-slate-400">Ketuk tanggal untuk mencatat habits</p>
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
            {/* Weekdays row */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              {WEEKDAY_NAMES.map(name => (
                <div key={name}>{name}</div>
              ))}
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Blank spacers for day of week offset */}
              {blankDaysArray.map(offsetIdx => (
                <div key={`blank-${offsetIdx}`} className="aspect-square bg-slate-50/50 rounded-xl" />
              ))}

              {/* Day cells */}
              {daysArray.map((day) => {
                const dayStr = String(day).padStart(2, "0");
                const monthStr = String(selectedMonth + 1).padStart(2, "0");
                const fullDateKey = `${selectedYear}-${monthStr}-${dayStr}`;

                const record = daysData[fullDateKey];
                const count = record?.completedHabits?.length || 0;
                const isSelected = activeDateStr === fullDateKey;

                // Color coding based on completions
                let cellBadgeStyle = "";
                if (count > 0) {
                  if (totalHabitsAvailable > 0 && count === totalHabitsAvailable) {
                    // 100% completed!
                    cellBadgeStyle = "bg-indicator-b text-white font-bold ring-2 ring-indicator-b/20";
                  } else if (count >= 3) {
                    // Many completed
                    cellBadgeStyle = "bg-indicator-c text-white font-semibold";
                  } else {
                    // Small completions
                    cellBadgeStyle = "bg-indicator-j text-slate-800 font-semibold";
                  }
                }

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => setActiveDateStr(fullDateKey)}
                    className={`aspect-square p-1.5 rounded-xl border flex flex-col justify-between items-center transition relative group ${
                      isSelected
                        ? "border-brand-wine bg-brand-wine/5 shadow-inner ring-1 ring-brand-wine/25"
                        : "border-slate-100 bg-white hover:border-brand-teal/50"
                    }`}
                  >
                    {/* Day number */}
                    <span className={`text-xs font-bold ${
                      isSelected ? "text-brand-wine font-extrabold" : "text-slate-700"
                    }`}>
                      {day}
                    </span>

                    {/* Completion Tag */}
                    {count > 0 ? (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md leading-none ${cellBadgeStyle}`} title={`${count} habit selesai`}>
                        {count}
                      </span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-slate-300 transition" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Streak & Highlights block */}
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
              <p className="text-[10px] text-slate-400 mt-0.5">Habits terselesaikan</p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Habit Panels & Accompanying Tasks (5 Cols) */}
      <div className="lg:col-span-5 space-y-4">
        {/* Date Context Display */}
        <div className="bg-brand-teal/10 border border-brand-teal/20 p-4 rounded-xl flex items-center justify-between">
          <div className="text-xs">
            <span className="text-slate-400 block font-semibold uppercase tracking-wider">Mencatat Kebiasaan</span>
            <span className="text-brand-teal font-bold text-sm block mt-0.5">{renderActiveDateFriendly()}</span>
          </div>
          <span className="text-xs px-2.5 py-1 bg-brand-teal/20 text-brand-teal rounded-full font-bold">
            {activeDayCompletedCount} Selesai
          </span>
        </div>

        {/* Habit Groups Loop */}
        <div className="space-y-3" id="habit-groups-list">
          {config.habitsConfig.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
              <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-slate-700 font-bold mb-1">Belum Ada Panel Habits</h4>
              <p className="text-xs text-slate-400">
                Silakan tambahkan panel habits baru beserta daftar to-do list kebiasaan di tab **Pengaturan**.
              </p>
            </div>
          ) : (
            config.habitsConfig.map((group) => {
              const isExpanded = expandedGroupId === group.id;

              // Calculate completions inside this group
              const groupItems = group.items;
              const completedInGroup = groupItems.filter(item =>
                isHabitCompleted(activeDateStr, `${group.id}::${item}`)
              );
              const groupDoneCount = completedInGroup.length;
              const isGroupCompleted = groupItems.length > 0 && groupDoneCount === groupItems.length;

              return (
                <div
                  key={group.id}
                  className={`bg-white rounded-xl border transition-all duration-200 shadow-sm overflow-hidden ${
                    isExpanded ? "border-brand-teal ring-2 ring-brand-teal/10" : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  {/* Accordion header panel */}
                  <button
                    onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                    className="w-full text-left p-4 flex items-center justify-between outline-none"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        {group.name}
                        {isGroupCompleted && (
                          <span className="p-0.5 bg-emerald-50 text-emerald-600 rounded-full">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-450 mt-0.5">
                        {groupDoneCount} dari {groupItems.length} kebiasaan selesai
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Percent badge */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isGroupCompleted
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {groupItems.length > 0 ? Math.round((groupDoneCount / groupItems.length) * 100) : 0}%
                      </span>
                      <span className="text-slate-400 text-xs">&nbsp;&rarr;&nbsp;</span>
                    </div>
                  </button>

                  {/* To-Do List of items */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-slate-50 bg-slate-50/25 divide-y divide-slate-100"
                      >
                        {groupItems.length === 0 ? (
                          <p className="p-4 text-xs text-slate-400 text-center">
                            Tidak ada item kebiasaan. Silakan tambahkan daftar di Pengaturan.
                          </p>
                        ) : (
                          groupItems.map((item) => {
                            const uniqueKey = `${group.id}::${item}`;
                            const isChecked = isHabitCompleted(activeDateStr, uniqueKey);

                            return (
                              <button
                                key={item}
                                onClick={() => handleToggleHabit(group.id, item)}
                                className="w-full text-left p-3.5 sm:px-5 flex items-center gap-3 transition-colors hover:bg-white outline-none group/item"
                              >
                                {/* Custom Checkbox */}
                                <div className="shrink-0">
                                  {isChecked ? (
                                    <div className="w-5 h-5 rounded-md bg-brand-teal text-white flex items-center justify-center transition">
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-md border-2 border-slate-300 group-hover/item:border-brand-teal transition" />
                                  )}
                                </div>

                                <span className={`text-xs font-medium tracking-tight ${
                                  isChecked ? "text-slate-405 line-through decoration-slate-300 opacity-60" : "text-slate-700"
                                }`}>
                                  {item}
                                </span>
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
