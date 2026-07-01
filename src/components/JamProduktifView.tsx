import React, { useState, useEffect } from "react";
import { DailyRecord, UserConfig } from "../types";
import { saveDailyRecord, saveProductivitySummary, calculateAndSaveSummary } from "../lib/firebase";
import { Clock, TrendingUp, AlertCircle, Info, CalendarDays, CheckCircle2, Save } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface JamProduktifViewProps {
  userId: string;
  config: UserConfig;
  daysData: Record<string, DailyRecord>;
  onDataUpdated: (dateId: string, hours: number) => void;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export default function JamProduktifView({
  userId,
  config,
  daysData,
  onDataUpdated
}: JamProduktifViewProps) {
  const isDark = config.theme === "dark";

  // Current month and year selectors
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 0-indexed

  // Save states for individual days
  const [savingStatus, setSavingStatus] = useState<Record<string, "idle" | "saving" | "saved">>({});
  const [tempHours, setTempHours] = useState<Record<string, string>>({});

  // Calculator widgets state
  const [calcMinutes, setCalcMinutes] = useState("");
  const [calcHours, setCalcHours] = useState("");

  const handleMinutesChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, "");
    setCalcMinutes(sanitized);
    const mins = parseFloat(sanitized);
    if (!isNaN(mins)) {
      setCalcHours((mins / 60).toFixed(2).replace(/\.00$/, ""));
    } else {
      setCalcHours("");
    }
  };

  const handleHoursChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.,]/g, "").replace(",", ".");
    setCalcHours(sanitized);
    const hrs = parseFloat(sanitized);
    if (!isNaN(hrs)) {
      setCalcMinutes(Math.round(hrs * 60).toString());
    } else {
      setCalcMinutes("");
    }
  };

  // Get total days in the selected month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const numDays = getDaysInMonth(selectedYear, selectedMonth);

  // Generate array of date keys e.g. ["2026-06-01", "2026-06-02", ...]
  const dateKeys = Array.from({ length: numDays }, (_, i) => {
    const dayNum = i + 1;
    const formattedDay = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
    const formattedMonth = selectedMonth + 1 < 10 ? `0${selectedMonth + 1}` : `${selectedMonth + 1}`;
    return `${selectedYear}-${formattedMonth}-${formattedDay}`;
  });

  // Pre-fill local tempHours state when month/year or raw daysData changes
  useEffect(() => {
    const newTempHours: Record<string, string> = {};
    dateKeys.forEach((dateKey) => {
      const hoursLogged = daysData[dateKey]?.hours;
      newTempHours[dateKey] = hoursLogged !== undefined && hoursLogged > 0 ? String(hoursLogged) : "";
    });
    setTempHours(newTempHours);
  }, [selectedMonth, selectedYear, daysData]);

  // Determine indicator label & formatting rules
  const getIndicator = (hours: number) => {
    const vBad = config.thresholdVeryBad;
    const bad = config.thresholdBad;
    const fair = config.thresholdFair;

    if (hours <= 0) return { label: "-", color: "bg-slate-50 text-slate-350 border-slate-100" };
    if (hours <= vBad) return { label: "Sangat Jelek", color: "bg-indicator-sj text-white border-transparent font-medium" };
    if (hours <= bad) return { label: "Jelek", color: "bg-indicator-j text-slate-800 border-transparent font-medium" };
    if (hours <= fair) return { label: "Cukup", color: "bg-indicator-c text-white border-transparent font-medium" };
    return { label: "Bagus", color: "bg-indicator-b text-white border-transparent font-semibold" };
  };

  // Quick stats calculations
  let totalHours = 0;
  let activeDaysCount = 0;
  const distributions = { veryBad: 0, bad: 0, fair: 0, good: 0 };

  dateKeys.forEach((key) => {
    const hrs = Number(tempHours[key] || "0");
    if (hrs > 0) {
      totalHours += hrs;
      activeDaysCount++;

      const vBad = config.thresholdVeryBad;
      const bad = config.thresholdBad;
      const fair = config.thresholdFair;

      if (hrs <= vBad) distributions.veryBad++;
      else if (hrs <= bad) distributions.bad++;
      else if (hrs <= fair) distributions.fair++;
      else distributions.good++;
    }
  });

  const averageHours = activeDaysCount > 0 ? (totalHours / activeDaysCount).toFixed(1) : "0.0";

  // Handle saving hours for a day
  const handleHoursSave = async (dateKey: string, inputVal: string) => {
    const parsedHours = parseFloat(inputVal);
    const resolvedHours = isNaN(parsedHours) || parsedHours < 0 ? 0 : Math.min(parsedHours, 24);

    // Update state to match clean representation
    setTempHours(prev => ({
      ...prev,
      [dateKey]: resolvedHours > 0 ? String(resolvedHours) : ""
    }));

    if ((daysData[dateKey]?.hours ?? 0) === resolvedHours) {
      // Avoid redundant saving
      return;
    }

    setSavingStatus((prev) => ({ ...prev, [dateKey]: "saving" }));
    try {
      const existingRecord = daysData[dateKey] || { hours: 0, completedHabits: [] };
      const updatedRecord = { ...existingRecord, hours: resolvedHours };

      await saveDailyRecord(userId, dateKey, updatedRecord);
      
      const mergedDaysData = {
        ...daysData,
        [dateKey]: updatedRecord
      };
      await calculateAndSaveSummary(userId, mergedDaysData, config, selectedYear, selectedMonth);

      onDataUpdated(dateKey, resolvedHours);

      setSavingStatus((prev) => ({ ...prev, [dateKey]: "saved" }));
      setTimeout(() => {
        setSavingStatus((prev) => ({ ...prev, [dateKey]: "idle" }));
      }, 1500);
    } catch (err) {
      console.error("Failed to save daily record hours:", err);
      setSavingStatus((prev) => ({ ...prev, [dateKey]: "idle" }));
    }
  };

  // Fast month shifting links
  const adjustMonth = (direction: number) => {
    let nextMonth = selectedMonth + direction;
    let nextYear = selectedYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    } else if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    }
    setSelectedMonth(nextMonth);
    setSelectedYear(nextYear);
  };

  return (
    <div className="space-y-6" id="productive-hours-view">
      {/* Month Navigator Toolbar */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border shadow-sm transition duration-150 ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-800"}`} id="month-navigator">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-teal/10 rounded-lg text-brand-teal">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${isDark ? "text-slate-100" : "text-slate-800"}`}>Pilih Waktu Catatan</h2>
            <p className="text-xs text-slate-400">Atur jam produktif harian Anda disini</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => adjustMonth(-1)}
            className={`p-2 border rounded-lg transition duration-150 outline-none hover:border-brand-teal cursor-pointer ${isDark ? "border-slate-800 text-slate-400 hover:bg-slate-800/40" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            id="prev-month-btn"
          >
            &larr;
          </button>

          <div className="flex gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className={`py-1.5 px-3 border font-semibold rounded-lg text-sm focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 outline-none cursor-pointer ${isDark ? "bg-slate-850 border-slate-755 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-700"}`}
              id="select-month"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`py-1.5 px-3 border font-semibold rounded-lg text-sm focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 outline-none cursor-pointer ${isDark ? "bg-slate-850 border-slate-755 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-700"}`}
              id="select-year"
            >
              {Array.from({ length: 6 }, (_, i) => today.getFullYear() - 3 + i).map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => adjustMonth(1)}
            className={`p-2 border rounded-lg transition duration-150 outline-none hover:border-brand-teal cursor-pointer ${isDark ? "border-slate-800 text-slate-400 hover:bg-slate-800/40" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            id="next-month-btn"
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Summary Insights Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="stats-summary-grid">
        {/* Total Hours Card */}
        <div className="bg-gradient-to-br from-brand-teal to-brand-teal/80 text-white p-5 rounded-2xl shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs text-brand-ice font-semibold block uppercase tracking-wider mb-1">
              Total Jam Sebulan
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold">{totalHours.toFixed(1)}</span>
              <span className="text-sm">jam</span>
            </div>
          </div>
          <div className="p-3 bg-white/10 rounded-xl">
            <Clock className="w-6 h-6 text-brand-ice" />
          </div>
        </div>

        {/* Avg hours per day Card */}
        <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-800"}`}>
          <div>
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider mb-1">
              Rata-rata Harian
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold">{averageHours}</span>
              <span className="text-xs text-slate-400 font-medium">jam/hari aktif</span>
            </div>
          </div>
          <div className="p-3 bg-brand-teal/5 rounded-xl text-brand-teal">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Active Days Counter */}
        <div className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-800"}`}>
          <div>
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider mb-1">
              Hari Terisi
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold">{activeDaysCount}</span>
              <span className="text-xs text-slate-400">/ {numDays} hari</span>
            </div>
          </div>
          <div className="p-3 bg-brand-ice/15 rounded-xl text-brand-teal">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Distribution mini dashboard */}
        <div className={`p-4 rounded-2xl border shadow-sm ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-800"}`}>
          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider mb-2">
            Penyebaran Indikator
          </span>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indicator-b" /> Bagus
              </span>
              <span className={`font-semibold ${isDark ? "text-slate-205" : "text-slate-700"}`}>{distributions.good} hari</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indicator-c" /> Cukup
              </span>
              <span className={`font-semibold ${isDark ? "text-slate-205" : "text-slate-700"}`}>{distributions.fair} hari</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indicator-j" /> Jelek
              </span>
              <span className={`font-semibold ${isDark ? "text-slate-205" : "text-slate-700"}`}>{distributions.bad} hari</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indicator-sj" /> Sangat Jelek
              </span>
              <span className={`font-semibold ${isDark ? "text-slate-205" : "text-slate-700"}`}>{distributions.veryBad} hari</span>
            </div>
          </div>
        </div>
      </div>

      {/* Time Conversion Calculator Widget */}
      <div className={`p-5 rounded-2xl border shadow-sm space-y-4 ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-800"}`} id="time-converter-calculator">
        <div className="flex items-center gap-2 pb-2">
          <Clock className="w-5 h-5 text-brand-teal shrink-0" />
          <div>
            <h3 className={`font-bold text-sm ${isDark ? "text-slate-100" : "text-slate-800"}`}>Kalkulator Konversi Waktu</h3>
            <p className="text-[10px] text-slate-400">Konversi nilai waktu Menit ke desimal Jam (misal: 150m = 2.5j) dan sebaliknya.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Minutes input */}
          <div className="space-y-1.5">
            <label className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Waktu dalam Menit (m)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="misal: 150"
                value={calcMinutes}
                onChange={(e) => handleMinutesChange(e.target.value)}
                className={`w-full py-1.5 px-3 rounded-lg border text-xs outline-none font-bold ${
                  isDark
                    ? "bg-slate-850 border-slate-700 text-slate-100 focus:border-brand-teal"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-brand-teal"
                }`}
              />
              <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold pointer-events-none">m</span>
            </div>
            <span className="text-[9px] text-slate-400 block italic">Nilai bulat (cth: 90)</span>
          </div>

          {/* Decimal Hours input */}
          <div className="space-y-1.5">
            <label className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Waktu dalam Jam Desimal (j)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="misal: 2.5"
                value={calcHours}
                onChange={(e) => handleHoursChange(e.target.value)}
                className={`w-full py-1.5 px-3 rounded-lg border text-xs outline-none font-bold ${
                  isDark
                    ? "bg-slate-850 border-slate-700 text-slate-100 focus:border-brand-teal"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-brand-teal"
                }`}
              />
              <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold pointer-events-none">j</span>
            </div>
            <span className="text-[9px] text-slate-400 block italic">Nilai desimal (cth: 1.5)</span>
          </div>
        </div>
      </div>

      {/* Guide explaining boundaries removed */}

      {/* Daily list / input grid */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`} id="days-input-table">
        <div className={`p-5 border-b ${isDark ? "border-slate-800 bg-slate-950/25" : "border-slate-100 bg-slate-55/30"}`}>
          <h3 className={`font-bold text-base ${isDark ? "text-slate-100" : "text-slate-800"}`}>Rincian Jam Produktif Harian</h3>
          <p className="text-xs text-slate-400">Silakan isi waktu produktif Anda (dalam bentuk jam) dan ketuk tombol simpan atau klik di luar kotak.</p>
        </div>

        <div className={`divide-y max-h-[500px] overflow-y-auto ${isDark ? "divide-slate-800" : "divide-slate-100"}`}>
          {dateKeys.map((dateKey) => {
            const dayNumber = parseInt(dateKey.split("-")[2]);
            const hoursVal = tempHours[dateKey] ?? "";
            const numHrs = Number(hoursVal || "0");
            const indicator = getIndicator(numHrs);
            const status = savingStatus[dateKey] || "idle";

            // Format date text to be highly friendly Indonesian: "Kamis, 18 Juni 2026"
            const dayDateObj = new Date(selectedYear, selectedMonth, dayNumber);
            const dayNameIndo = dayDateObj.toLocaleDateString("id-ID", { weekday: "long" });

            return (
              <div
                key={dateKey}
                className={`p-4 sm:px-6 transition duration-150 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${isDark ? "hover:bg-slate-950/20" : "hover:bg-slate-50/75"}`}
              >
                {/* Date string column */}
                <div className="flex items-center gap-4 min-w-[140px]">
                  <div className={`w-10 h-10 border rounded-xl flex flex-col items-center justify-center font-bold text-xs ${isDark ? "bg-slate-950/40 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-100 text-slate-600"}`}>
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">TGL</span>
                    <span className={`leading-none ${isDark ? "text-slate-100" : "text-slate-700"}`}>{dayNumber}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block tracking-wider uppercase">
                      {dayNameIndo}
                    </span>
                    <span className={`text-sm font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                      {dayNumber} {MONTH_NAMES[selectedMonth]} {selectedYear}
                    </span>
                  </div>
                </div>

                {/* Input with inline badge & save button */}
                <div className="flex items-center gap-3 justify-between sm:justify-end grow">
                  {/* Indicator badge */}
                  <div className="sm:mr-4">
                    {numHrs > 0 ? (
                      <span className={`px-3 py-1.5 rounded-full text-xs border ${indicator.color}`}>
                        {indicator.label}
                      </span>
                    ) : (
                      <span className={`px-3 py-1.5 rounded-full text-xs border ${isDark ? "border-slate-850 text-slate-500 bg-slate-950/20" : "border-slate-100 text-slate-350 bg-slate-50"}`}>
                        Belum terisi
                      </span>
                    )}
                  </div>

                  {/* Input container */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        placeholder="0"
                        value={hoursVal}
                        onWheel={(e) => {
                          e.currentTarget.blur();
                          e.stopPropagation();
                        }}
                        onChange={(e) =>
                          setTempHours((prev) => ({ ...prev, [dateKey]: e.target.value }))
                        }
                        onBlur={() => handleHoursSave(dateKey, hoursVal)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleHoursSave(dateKey, hoursVal);
                            const target = e.target as HTMLInputElement;
                            target.blur();
                          }
                        }}
                        className={`w-24 pl-3 pr-8 py-2 border rounded-xl text-center font-bold transition duration-150 outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                          isDark
                            ? "bg-slate-850 border-slate-700 text-slate-100 focus:bg-slate-950 focus:border-brand-teal"
                            : "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                        }`}
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold pointer-events-none">
                        j
                      </span>
                    </div>

                    {/* Action save indicator button */}
                    <button
                      onClick={() => handleHoursSave(dateKey, hoursVal)}
                      className={`p-2 rounded-xl border transition duration-150 outline-none cursor-pointer ${
                        status === "saving"
                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-500 cursor-wait"
                          : status === "saved"
                          ? "bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900 text-teal-600"
                          : isDark
                          ? "bg-slate-800 border-slate-700 hover:border-brand-teal text-slate-400 hover:text-brand-teal"
                          : "bg-white border-slate-200 hover:border-brand-teal text-slate-400 hover:text-brand-teal"
                      }`}
                      title="Simpan Jam Produktif"
                    >
                      {status === "saving" ? (
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      ) : status === "saved" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
