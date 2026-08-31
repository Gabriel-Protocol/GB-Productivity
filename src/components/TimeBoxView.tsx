/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { DailyRecord, TimeBoxPriority, TimeBoxTask, UserConfig } from "../types";
import { saveTimeBoxRecord } from "../lib/firebase";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  ClipboardPaste,
  Clock,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  CheckCircle2,
  Circle,
  Sparkles,
  Award,
  Layers,
  RotateCcw,
  X,
  Check,
  SlidersHorizontal,
  Command
} from "lucide-react";

interface TimeBoxViewProps {
  userId: string;
  config: UserConfig;
  daysData: Record<string, DailyRecord>;
  onDataUpdated: (dateId: string, tasks: TimeBoxTask[], score: string | number) => void;
}

export type TimeBoxSortMode = "time" | "priority" | "duration" | "manual";

const PRIORITY_CONFIG: Record<
  TimeBoxPriority,
  {
    label: string;
    rank: number;
    badgeBgLight: string;
    badgeTextLight: string;
    badgeBgDark: string;
    badgeTextDark: string;
    borderLight: string;
    borderDark: string;
    dotColor: string;
  }
> = {
  do: {
    label: "Do",
    rank: 1,
    badgeBgLight: "bg-rose-50",
    badgeTextLight: "text-rose-700",
    badgeBgDark: "bg-rose-950/40",
    badgeTextDark: "text-rose-300",
    borderLight: "border-rose-200",
    borderDark: "border-rose-900/50",
    dotColor: "bg-rose-500"
  },
  decide: {
    label: "Decide",
    rank: 2,
    badgeBgLight: "bg-teal-50",
    badgeTextLight: "text-teal-700",
    badgeBgDark: "bg-teal-950/40",
    badgeTextDark: "text-teal-300",
    borderLight: "border-teal-200",
    borderDark: "border-teal-900/50",
    dotColor: "bg-teal-500"
  },
  delegate: {
    label: "Delegate",
    rank: 3,
    badgeBgLight: "bg-amber-50",
    badgeTextLight: "text-amber-700",
    badgeBgDark: "bg-amber-950/40",
    badgeTextDark: "text-amber-300",
    borderLight: "border-amber-200",
    borderDark: "border-amber-900/50",
    dotColor: "bg-amber-500"
  },
  delete: {
    label: "Delete",
    rank: 4,
    badgeBgLight: "bg-slate-100",
    badgeTextLight: "text-slate-700",
    badgeBgDark: "bg-slate-800",
    badgeTextDark: "text-slate-300",
    borderLight: "border-slate-200",
    borderDark: "border-slate-700",
    dotColor: "bg-slate-400"
  }
};

const INDO_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const INDO_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Ags", "Sep", "Okt", "Nov", "Des"
];

const INDO_DAYS = [
  "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
];

const DEFAULT_PANEL_WIDTH = 340;
const DEFAULT_PANEL_HEIGHT = 440; // Default height for task content container

// Helper to format date to "YYYY-MM-DD"
function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Helper to get Monday of the week for a given date
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Calculate duration between startTime and endTime in minutes
function getDurationMinutes(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

// Calculate duration string in human-readable format
function calculateDuration(start?: string, end?: string): string | null {
  const minsTotal = getDurationMinutes(start, end);
  if (minsTotal <= 0) return null;
  const hours = Math.floor(minsTotal / 60);
  const mins = minsTotal % 60;

  if (hours > 0 && mins > 0) return `${hours}j ${mins}m`;
  if (hours > 0) return `${hours} jam`;
  return `${mins} mnt`;
}

// Get minutes from 00:00 for sorting
function getStartMinutes(start?: string): number {
  if (!start || !start.includes(":")) return 9999;
  const [sh, sm] = start.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm)) return 9999;
  return sh * 60 + sm;
}

// Sorter helper for tasks based on selected mode
function sortTasksList(tasks: TimeBoxTask[], mode: TimeBoxSortMode): TimeBoxTask[] {
  const list = [...tasks];

  if (mode === "time") {
    return list.sort((a, b) => {
      const timeA = getStartMinutes(a.startTime);
      const timeB = getStartMinutes(b.startTime);
      if (timeA !== timeB) return timeA - timeB;
      return (a.order || 0) - (b.order || 0);
    });
  }

  if (mode === "priority") {
    return list.sort((a, b) => {
      const rankA = PRIORITY_CONFIG[a.priority]?.rank || 99;
      const rankB = PRIORITY_CONFIG[b.priority]?.rank || 99;
      if (rankA !== rankB) return rankA - rankB;
      const timeA = getStartMinutes(a.startTime);
      const timeB = getStartMinutes(b.startTime);
      if (timeA !== timeB) return timeA - timeB;
      return (a.order || 0) - (b.order || 0);
    });
  }

  if (mode === "duration") {
    return list.sort((a, b) => {
      const durA = getDurationMinutes(a.startTime, a.endTime);
      const durB = getDurationMinutes(b.startTime, b.endTime);
      if (durA !== durB) return durB - durA; // Longest duration first
      const timeA = getStartMinutes(a.startTime);
      const timeB = getStartMinutes(b.startTime);
      if (timeA !== timeB) return timeA - timeB;
      return (a.order || 0) - (b.order || 0);
    });
  }

  // mode === "manual"
  return list.sort((a, b) => (a.order || 0) - (b.order || 0));
}

interface ActiveTimePickerState {
  dateKey: string;
  taskId: string;
  taskText: string;
  startTime: string;
  endTime: string;
}

export default function TimeBoxView({
  userId,
  config,
  daysData,
  onDataUpdated
}: TimeBoxViewProps) {
  // Current anchor date (used to calculate the active 7-day week)
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());

  // Sorting Mode State - DEFAULT: "time" (Waktu)
  const [sortMode, setSortMode] = useState<TimeBoxSortMode>(() => {
    try {
      const saved = localStorage.getItem("gb_timebox_sort_mode");
      if (saved === "time" || saved === "priority" || saved === "duration" || saved === "manual") {
        return saved;
      }
      return "time"; // Default by time
    } catch {
      return "time";
    }
  });

  // Selected Day & Selected Task for Keyboard Navigation & Ctrl+C / Ctrl+V
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => formatDateKey(new Date()));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Individual panel widths and heights stored per dateKey or default
  const [panelWidths, setPanelWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("gb_timebox_panel_widths");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [panelHeights, setPanelHeights] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("gb_timebox_panel_heights");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // State for active Time Picker Pop-up
  const [activeTimePicker, setActiveTimePicker] = useState<ActiveTimePickerState | null>(null);

  // Clipboard for task copying
  const [clipboard, setClipboard] = useState<{
    type: "single" | "day";
    tasks: TimeBoxTask[];
    sourceDateLabel?: string;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dragging state for panel resize
  const [resizingDateKey, setResizingDateKey] = useState<string | null>(null);
  const [resizeMode, setResizeMode] = useState<"width" | "height" | "both" | null>(null);

  const resizeRef = useRef<{
    dateKey: string;
    mode: "width" | "height" | "both";
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const isDark = config.theme === "dark";
  const todayKey = formatDateKey(new Date());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  };

  // Change sort mode and persist
  const handleSetSortMode = (mode: TimeBoxSortMode) => {
    setSortMode(mode);
    try {
      localStorage.setItem("gb_timebox_sort_mode", mode);
    } catch {
      // ignore
    }
    const label =
      mode === "time"
        ? "Waktu (00:00 - 23:59)"
        : mode === "priority"
        ? "Prioritas (Do → Decide → Delegate → Delete)"
        : mode === "duration"
        ? "Lama Durasi (Terpanjang → Terpendek)"
        : "Manual (Urutan Panah)";
    showToast(`Disortir berdasarkan: ${label}`);
  };

  // Drag Resizer Handlers per Panel (Width / Height / Corner)
  const handleStartResize = (
    dateKey: string,
    mode: "width" | "height" | "both",
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const currentWidth = panelWidths[dateKey] || DEFAULT_PANEL_WIDTH;
    const currentHeight = panelHeights[dateKey] || DEFAULT_PANEL_HEIGHT;

    resizeRef.current = {
      dateKey,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: currentWidth,
      startHeight: currentHeight
    };
    setResizingDateKey(dateKey);
    setResizeMode(mode);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const { startX, startY, startWidth, startHeight, dateKey: activeKey, mode: activeMode } = resizeRef.current;

      if (activeMode === "width" || activeMode === "both") {
        const deltaX = moveEvent.clientX - startX;
        // Min 260px, Max 800px
        const newWidth = Math.max(260, Math.min(800, Math.round(startWidth + deltaX)));
        setPanelWidths((prev) => ({ ...prev, [activeKey]: newWidth }));
      }

      if (activeMode === "height" || activeMode === "both") {
        const deltaY = moveEvent.clientY - startY;
        // Min 220px, Max 1200px
        const newHeight = Math.max(220, Math.min(1200, Math.round(startHeight + deltaY)));
        setPanelHeights((prev) => ({ ...prev, [activeKey]: newHeight }));
      }
    };

    const handleMouseUp = () => {
      if (resizeRef.current) {
        setPanelWidths((latestW) => {
          localStorage.setItem("gb_timebox_panel_widths", JSON.stringify(latestW));
          return latestW;
        });
        setPanelHeights((latestH) => {
          localStorage.setItem("gb_timebox_panel_heights", JSON.stringify(latestH));
          return latestH;
        });
      }
      resizeRef.current = null;
      setResizingDateKey(null);
      setResizeMode(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor =
      mode === "width" ? "col-resize" : mode === "height" ? "row-resize" : "nwse-resize";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleResetPanelDimensions = (dateKey: string) => {
    setPanelWidths((prev) => {
      const next = { ...prev };
      delete next[dateKey];
      localStorage.setItem("gb_timebox_panel_widths", JSON.stringify(next));
      return next;
    });
    setPanelHeights((prev) => {
      const next = { ...prev };
      delete next[dateKey];
      localStorage.setItem("gb_timebox_panel_heights", JSON.stringify(next));
      return next;
    });
    showToast("Ukuran panel dikembalikan ke default.");
  };

  const handleResetAllDimensions = () => {
    setPanelWidths({});
    setPanelHeights({});
    localStorage.removeItem("gb_timebox_panel_widths");
    localStorage.removeItem("gb_timebox_panel_heights");
    showToast("Semua ukuran panel direset ke default.");
  };

  // Calculate the 7 days of the currently selected week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const monday = getMonday(anchorDate);
    const days: {
      date: Date;
      dateKey: string;
      dayName: string;
      dayNum: number;
      monthName: string;
      isToday: boolean;
      isWeekend: boolean;
    }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dayOfWeek = d.getDay();
      const dateKey = formatDateKey(d);

      days.push({
        date: d,
        dateKey,
        dayName: INDO_DAYS[dayOfWeek],
        dayNum: d.getDate(),
        monthName: INDO_MONTHS_SHORT[d.getMonth()],
        isToday: dateKey === todayKey,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      });
    }

    return days;
  }, [anchorDate, todayKey]);

  // Week header range display (e.g. "17 - 23 Agustus 2026")
  const weekRangeText = useMemo(() => {
    if (weekDays.length < 7) return "";
    const first = weekDays[0].date;
    const last = weekDays[6].date;

    const firstMonth = INDO_MONTHS[first.getMonth()];
    const lastMonth = INDO_MONTHS[last.getMonth()];
    const firstYear = first.getFullYear();
    const lastYear = last.getFullYear();

    if (firstYear !== lastYear) {
      return `${first.getDate()} ${firstMonth} ${firstYear} - ${last.getDate()} ${lastMonth} ${lastYear}`;
    }
    if (first.getMonth() !== last.getMonth()) {
      return `${first.getDate()} ${firstMonth} - ${last.getDate()} ${lastMonth} ${firstYear}`;
    }
    return `${first.getDate()} - ${last.getDate()} ${firstMonth} ${firstYear}`;
  }, [weekDays]);

  // Navigation handlers
  const handlePrevWeek = () => {
    const prev = new Date(anchorDate);
    prev.setDate(prev.getDate() - 7);
    setAnchorDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(anchorDate);
    next.setDate(next.getDate() + 7);
    setAnchorDate(next);
  };

  const handleCurrentWeek = () => {
    setAnchorDate(new Date());
  };

  // Retrieve raw tasks & score for a specific date
  const getRawDayData = (dateKey: string) => {
    const rec = daysData[dateKey];
    return {
      tasks: (rec?.timeboxTasks || []).slice(),
      score: rec?.timeboxScore !== undefined ? rec.timeboxScore : ""
    };
  };

  // Retrieve sorted tasks & score for a specific date
  const getDayData = (dateKey: string) => {
    const { tasks, score } = getRawDayData(dateKey);
    const sorted = sortTasksList(tasks, sortMode);
    return {
      tasks: sorted,
      score
    };
  };

  // Helper to commit changes to state & Firestore
  const updateAndSave = (dateKey: string, newTasks: TimeBoxTask[], newScore: string | number) => {
    onDataUpdated(dateKey, newTasks, newScore);
    saveTimeBoxRecord(userId, dateKey, newTasks, newScore).catch((err) => {
      console.error(`Gagal menyimpan Time Box untuk tanggal ${dateKey}:`, err);
    });
  };

  // TASK OPERATIONS
  const handleAddTask = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    const { tasks, score } = getDayData(dateKey);
    const newId = "tb_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

    let defaultStart = "08:00";
    let defaultEnd = "09:00";
    if (tasks.length > 0) {
      const lastTask = tasks[tasks.length - 1];
      if (lastTask.endTime) {
        defaultStart = lastTask.endTime;
        const [h, m] = defaultStart.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          const nextH = (h + 1) % 24;
          defaultEnd = `${String(nextH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }
      }
    }

    const newTask: TimeBoxTask = {
      id: newId,
      text: "",
      completed: false,
      startTime: defaultStart,
      endTime: defaultEnd,
      priority: "do",
      order: tasks.length + 1
    };

    const updatedTasks = [...tasks, newTask];
    updateAndSave(dateKey, updatedTasks, score);
    setSelectedTaskId(newId);
  };

  const handleToggleTask = (dateKey: string, taskId: string) => {
    setSelectedDateKey(dateKey);
    setSelectedTaskId(taskId);
    const { tasks, score } = getRawDayData(dateKey);
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    updateAndSave(dateKey, updatedTasks, score);
  };

  const handleUpdateTaskText = (dateKey: string, taskId: string, text: string) => {
    const { tasks, score } = getRawDayData(dateKey);
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, text } : t
    );
    updateAndSave(dateKey, updatedTasks, score);
  };

  const handleUpdateTaskPriority = (
    dateKey: string,
    taskId: string,
    priority: TimeBoxPriority
  ) => {
    setSelectedDateKey(dateKey);
    setSelectedTaskId(taskId);
    const { tasks, score } = getRawDayData(dateKey);
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, priority } : t
    );
    updateAndSave(dateKey, updatedTasks, score);
  };

  const handleUpdateTaskTimes = (
    dateKey: string,
    taskId: string,
    startTime: string,
    endTime: string
  ) => {
    setSelectedDateKey(dateKey);
    setSelectedTaskId(taskId);
    const { tasks, score } = getRawDayData(dateKey);
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, startTime, endTime } : t
    );
    updateAndSave(dateKey, updatedTasks, score);
  };

  const handleDeleteTask = (dateKey: string, taskId: string) => {
    const { tasks, score } = getRawDayData(dateKey);
    const updatedTasks = tasks
      .filter((t) => t.id !== taskId)
      .map((t, idx) => ({ ...t, order: idx + 1 }));
    updateAndSave(dateKey, updatedTasks, score);
    if (activeTimePicker?.taskId === taskId) {
      setActiveTimePicker(null);
    }
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
    showToast("Tugas telah dihapus.");
  };

  const handleMoveTask = (dateKey: string, index: number, direction: "up" | "down") => {
    setSelectedDateKey(dateKey);
    // When moving tasks manually, auto-switch to manual mode if not already
    if (sortMode !== "manual") {
      setSortMode("manual");
      try {
        localStorage.setItem("gb_timebox_sort_mode", "manual");
      } catch {
        // ignore
      }
    }

    const { tasks, score } = getDayData(dateKey);
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === tasks.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const reordered = [...tasks];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const normalized = reordered.map((t, idx) => ({ ...t, order: idx + 1 }));
    updateAndSave(dateKey, normalized, score);
    setSelectedTaskId(temp.id);
  };

  // COPY & PASTE OPERATIONS
  const handleCopySingleTask = (task: TimeBoxTask) => {
    setClipboard({
      type: "single",
      tasks: [{ ...task, completed: false }]
    });
    showToast(`Tugas "${task.text || 'Tugas'}" disalin (Ctrl+C)!`);
  };

  const handleCopyDayTasks = (dateKey: string, dayName: string) => {
    setSelectedDateKey(dateKey);
    const { tasks } = getDayData(dateKey);
    if (tasks.length === 0) {
      showToast("Tidak ada tugas pada hari ini untuk disalin.");
      return;
    }
    setClipboard({
      type: "day",
      tasks: tasks.map((t) => ({ ...t, completed: false })),
      sourceDateLabel: `${dayName} (${tasks.length} tugas)`
    });
    showToast(`${tasks.length} tugas dari ${dayName} disalin (Ctrl+C)!`);
  };

  const handlePasteTasks = (targetDateKey: string) => {
    setSelectedDateKey(targetDateKey);
    if (!clipboard || clipboard.tasks.length === 0) {
      showToast("Clipboard masih kosong. Salin tugas terlebih dahulu (Ctrl+C).");
      return;
    }

    const { tasks: currentTasks, score } = getRawDayData(targetDateKey);
    const newPastedTasks: TimeBoxTask[] = clipboard.tasks.map((t, idx) => ({
      ...t,
      id: "tb_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).substring(2, 6),
      completed: false,
      order: currentTasks.length + idx + 1
    }));

    const merged = [...currentTasks, ...newPastedTasks];
    updateAndSave(targetDateKey, merged, score);
    if (newPastedTasks.length > 0) {
      setSelectedTaskId(newPastedTasks[0].id);
    }
    showToast(`${newPastedTasks.length} tugas berhasil ditempel (Ctrl+V)!`);
  };

  // KEYBOARD SHORTCUTS LISTENER: Ctrl+C and Ctrl+V for selected task or selected day panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) {
        if (e.key === "Escape") {
          setSelectedTaskId(null);
        }
        return;
      }

      const activeEl = document.activeElement;
      const isInputActive =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable);

      // --- Handle Ctrl + C (Copy) ---
      if (e.key === "c" || e.key === "C") {
        // If user has highlighted characters inside an active input, let native browser copy text
        const selectionText = window.getSelection()?.toString();
        if (isInputActive && selectionText && selectionText.trim().length > 0) {
          return;
        }

        // If a single task is selected
        if (selectedTaskId && selectedDateKey) {
          const { tasks } = getRawDayData(selectedDateKey);
          const taskToCopy = tasks.find((t) => t.id === selectedTaskId);
          if (taskToCopy) {
            e.preventDefault();
            handleCopySingleTask(taskToCopy);
            return;
          }
        }

        // If no task selected, but a day panel is active
        if (selectedDateKey && !selectedTaskId) {
          const dayObj = weekDays.find((d) => d.dateKey === selectedDateKey);
          const dayName = dayObj ? dayObj.dayName : selectedDateKey;
          const { tasks } = getDayData(selectedDateKey);
          if (tasks.length > 0) {
            e.preventDefault();
            handleCopyDayTasks(selectedDateKey, dayName);
          }
        }
      }

      // --- Handle Ctrl + V (Paste) ---
      if (e.key === "v" || e.key === "V") {
        // If typing inside an active input field, let native browser paste text
        if (isInputActive) {
          return;
        }

        // If clipboard contains timebox tasks
        if (clipboard && clipboard.tasks.length > 0) {
          const targetDate = selectedDateKey || todayKey;
          e.preventDefault();
          handlePasteTasks(targetDate);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTaskId, selectedDateKey, clipboard, daysData, weekDays, todayKey]);

  // SCORE (NILAI) OPERATION
  const handleScoreChange = (dateKey: string, value: string) => {
    const { tasks } = getRawDayData(dateKey);
    updateAndSave(dateKey, tasks, value);
  };

  // Clear completed tasks in a day
  const handleClearCompleted = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    const { tasks, score } = getRawDayData(dateKey);
    const uncompleted = tasks
      .filter((t) => !t.completed)
      .map((t, idx) => ({ ...t, order: idx + 1 }));
    updateAndSave(dateKey, uncompleted, score);
    showToast("Tugas yang sudah selesai dibersihkan.");
  };

  // Total summary across the 7 days of this week
  const weekStats = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let priorityCounts = { do: 0, decide: 0, delegate: 0, delete: 0 };
    let validScores: number[] = [];

    weekDays.forEach(({ dateKey }) => {
      const { tasks, score } = getRawDayData(dateKey);
      totalTasks += tasks.length;
      tasks.forEach((t) => {
        if (t.completed) completedTasks++;
        if (priorityCounts[t.priority] !== undefined) {
          priorityCounts[t.priority]++;
        }
      });
      if (score !== "" && score !== undefined) {
        const num = Number(score);
        if (!isNaN(num)) validScores.push(num);
      }
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const avgScore = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : "-";

    return {
      totalTasks,
      completedTasks,
      completionRate,
      priorityCounts,
      avgScore
    };
  }, [weekDays, daysData]);

  const hasCustomDimensions = Object.keys(panelWidths).length > 0 || Object.keys(panelHeights).length > 0;

  return (
    <div className="space-y-6" id="timebox-view">
      {/* Toast notification pill */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-teal" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top Header & Controls */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border shadow-sm transition-colors duration-200 ${
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className={`text-base sm:text-lg font-extrabold tracking-tight ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                Time Box & To-Do Mingguan
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Pilih tugas/panel lalu gunakan shortcut <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-brand-teal border border-slate-300 dark:border-slate-700">Ctrl+C</kbd> & <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-brand-teal border border-slate-300 dark:border-slate-700">Ctrl+V</kbd>
              </p>
            </div>
          </div>

          {/* Navigation and Sort Controls */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Sort Mode Dropdown (Default: Waktu) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-brand-teal" />
                <span className="hidden sm:inline">Urutkan:</span>
              </span>
              <div className="relative inline-flex items-center">
                <select
                  value={sortMode}
                  onChange={(e) => handleSetSortMode(e.target.value as TimeBoxSortMode)}
                  className={`text-xs font-bold px-3 py-2 pr-7 rounded-xl border outline-none cursor-pointer transition appearance-none ${
                    isDark
                      ? "bg-slate-950/80 border-slate-800 text-brand-teal focus:border-brand-teal"
                      : "bg-teal-50/60 border-teal-200 text-teal-800 focus:border-teal-400 shadow-2xs"
                  }`}
                  title="Pilih mode pengurutan tugas (Default: Waktu)"
                >
                  <option value="time">⏰ Waktu (00:00 - 23:59) - Default</option>
                  <option value="priority">🎯 Prioritas (Do → Decide → Delegate → Delete)</option>
                  <option value="duration">⏳ Lama Durasi (Terlama)</option>
                  <option value="manual">↕️ Urutan Manual</option>
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-brand-teal">
                  ▼
                </span>
              </div>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevWeek}
                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                  isDark
                    ? "border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                }`}
                title="Minggu Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={handleCurrentWeek}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  isDark
                    ? "border-brand-teal/40 bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal"
                    : "border-brand-teal/30 bg-teal-50 hover:bg-teal-100 text-brand-teal"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Minggu Ini</span>
              </button>

              <button
                onClick={handleNextWeek}
                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                  isDark
                    ? "border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"
                }`}
                title="Minggu Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Formatted Date Range Pill */}
            <div
              className={`px-3 py-2 rounded-xl border text-xs font-bold tracking-wide ${
                isDark
                  ? "border-slate-800 bg-slate-950 text-slate-200"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {weekRangeText}
            </div>

            {/* Reset All Panel Dimensions button if customized */}
            {hasCustomDimensions && (
              <button
                onClick={handleResetAllDimensions}
                title="Reset ukuran lebar dan tinggi semua panel ke default"
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  isDark
                    ? "border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                <RotateCcw className="w-3 h-3 text-slate-400" />
                <span className="hidden sm:inline">Reset Ukuran</span>
              </button>
            )}
          </div>
        </div>

        {/* Weekly Metric Summary Bar */}
        <div className={`mt-5 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 ${
          isDark ? "border-slate-800/80" : "border-slate-100"
        }`}>
          {/* Total Tasks */}
          <div className={`p-2.5 rounded-xl border ${isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Tugas</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-base font-extrabold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                {weekStats.totalTasks}
              </span>
              <span className="text-[10px] text-slate-400">tugas</span>
            </div>
          </div>

          {/* Completed Rate */}
          <div className={`p-2.5 rounded-xl border ${isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Selesai</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-extrabold text-brand-teal">
                {weekStats.completedTasks}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">({weekStats.completionRate}%)</span>
            </div>
          </div>

          {/* Quadrant: Do */}
          <div className={`p-2.5 rounded-xl border ${isDark ? "bg-rose-950/15 border-rose-900/30" : "bg-rose-50/50 border-rose-100"}`}>
            <span className="text-[10px] uppercase font-bold text-rose-500 block">Do</span>
            <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">
              {weekStats.priorityCounts.do}
            </span>
          </div>

          {/* Quadrant: Decide */}
          <div className={`p-2.5 rounded-xl border ${isDark ? "bg-teal-950/15 border-teal-900/30" : "bg-teal-50/50 border-teal-100"}`}>
            <span className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400 block">Decide</span>
            <span className="text-base font-extrabold text-teal-600 dark:text-teal-400">
              {weekStats.priorityCounts.decide}
            </span>
          </div>

          {/* Quadrant: Delegate */}
          <div className={`p-2.5 rounded-xl border ${isDark ? "bg-amber-950/15 border-amber-900/30" : "bg-amber-50/50 border-amber-100"}`}>
            <span className="text-[10px] uppercase font-bold text-amber-500 block">Delegate</span>
            <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
              {weekStats.priorityCounts.delegate}
            </span>
          </div>

          {/* Average Score */}
          <div className={`p-2.5 rounded-xl border ${isDark ? "bg-indigo-950/15 border-indigo-900/30" : "bg-indigo-50/50 border-indigo-100"}`}>
            <span className="text-[10px] uppercase font-bold text-indigo-500 block">Rerata Nilai</span>
            <div className="flex items-center gap-1 mt-0.5">
              <Award className="w-4 h-4 text-indigo-500" />
              <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                {weekStats.avgScore}
              </span>
            </div>
          </div>
        </div>

        {/* In-app Clipboard status if item copied */}
        {clipboard && (
          <div className={`mt-4 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
            isDark ? "bg-slate-950 border-brand-teal/30 text-slate-200" : "bg-teal-50/70 border-teal-200 text-slate-700"
          }`}>
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-brand-teal" />
              <span>
                Clipboard: <strong>{clipboard.tasks.length} Tugas</strong> tersimpan{" "}
                {clipboard.sourceDateLabel ? `dari ${clipboard.sourceDateLabel}` : ""}.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                Pilih panel hari lalu tekan <kbd className="font-bold text-brand-teal">Ctrl+V</kbd> atau klik ikon tempel.
              </span>
              <button
                onClick={() => setClipboard(null)}
                className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
              >
                Hapus Clipboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 7 Day Panels Container with Dynamic Drag-to-Resize on Each Panel */}
      <div className="flex flex-wrap gap-4.5 items-start justify-start w-full">
        {weekDays.map(({ dateKey, dayName, dayNum, monthName, isToday, isWeekend }) => {
          const { tasks, score } = getDayData(dateKey);
          const completedCount = tasks.filter((t) => t.completed).length;
          const totalCount = tasks.length;
          const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const panelWidth = panelWidths[dateKey] || DEFAULT_PANEL_WIDTH;
          const panelHeight = panelHeights[dateKey] || DEFAULT_PANEL_HEIGHT;
          const isThisResizing = resizingDateKey === dateKey;
          const isPanelSelected = selectedDateKey === dateKey;

          return (
            <div
              key={dateKey}
              onClick={() => setSelectedDateKey(dateKey)}
              style={{
                width: `${panelWidth}px`,
                flex: `0 0 ${panelWidth}px`,
                maxWidth: "100%",
                minWidth: "260px"
              }}
              className={`rounded-2xl border shadow-sm flex flex-col transition-all duration-150 relative select-text cursor-default ${
                isThisResizing
                  ? "ring-2 ring-brand-teal shadow-lg"
                  : isPanelSelected
                  ? isDark
                    ? "bg-slate-900 border-teal-500/80 ring-2 ring-teal-500/30 shadow-md"
                    : "bg-white border-brand-teal ring-2 ring-teal-400/30 shadow-md"
                  : isToday
                  ? isDark
                    ? "bg-slate-900 border-brand-teal ring-1 ring-brand-teal/40"
                    : "bg-white border-brand-teal ring-2 ring-brand-teal/20"
                  : isWeekend
                  ? isDark
                    ? "bg-rose-950/10 border-rose-900/30"
                    : "bg-rose-50/20 border-rose-100/80"
                  : isDark
                  ? "bg-slate-900 border-slate-800"
                  : "bg-white border-slate-100"
              }`}
            >
              {/* DRAGGABLE RESIZER HANDLE ON RIGHT BORDER (WIDTH) */}
              <div
                onMouseDown={(e) => handleStartResize(dateKey, "width", e)}
                onDoubleClick={() => handleResetPanelDimensions(dateKey)}
                title="Tarik untuk mengubah lebar panel ini. Klik 2x untuk reset."
                className={`absolute top-0 right-0 bottom-3 w-3 -mr-1.5 cursor-col-resize z-20 group/resizer flex items-center justify-center transition-all ${
                  isThisResizing && (resizeMode === "width" || resizeMode === "both") ? "opacity-100" : "opacity-0 hover:opacity-100"
                }`}
              >
                <div className={`w-1 h-12 rounded-full transition-colors ${
                  isThisResizing && (resizeMode === "width" || resizeMode === "both") ? "bg-brand-teal" : "bg-slate-300 dark:bg-slate-600 group-hover/resizer:bg-brand-teal"
                }`} />
              </div>

              {/* DRAGGABLE RESIZER HANDLE ON BOTTOM BORDER (HEIGHT) */}
              <div
                onMouseDown={(e) => handleStartResize(dateKey, "height", e)}
                onDoubleClick={() => handleResetPanelDimensions(dateKey)}
                title="Tarik untuk meninggikan/memendekkan panel ini. Klik 2x untuk reset."
                className={`absolute bottom-0 left-0 right-3 h-3 -mb-1.5 cursor-row-resize z-20 group/b-resizer flex items-center justify-center transition-all ${
                  isThisResizing && (resizeMode === "height" || resizeMode === "both") ? "opacity-100" : "opacity-0 hover:opacity-100"
                }`}
              >
                <div className={`h-1 w-12 rounded-full transition-colors ${
                  isThisResizing && (resizeMode === "height" || resizeMode === "both") ? "bg-brand-teal" : "bg-slate-300 dark:bg-slate-600 group-hover/b-resizer:bg-brand-teal"
                }`} />
              </div>

              {/* DRAGGABLE CORNER RESIZER (BOTH WIDTH & HEIGHT) */}
              <div
                onMouseDown={(e) => handleStartResize(dateKey, "both", e)}
                onDoubleClick={() => handleResetPanelDimensions(dateKey)}
                title="Tarik sudut untuk mengatur lebar & tinggi sekaligus. Klik 2x untuk reset."
                className={`absolute bottom-0 right-0 w-4 h-4 -mr-1 -mb-1 cursor-nwse-resize z-30 group/c-resizer flex items-center justify-center transition-all ${
                  isThisResizing && resizeMode === "both" ? "opacity-100" : "opacity-40 hover:opacity-100"
                }`}
              >
                <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-slate-400 dark:border-slate-500 group-hover/c-resizer:border-brand-teal transition-colors rounded-br-xs" />
              </div>

              {/* Panel Top Header */}
              <div
                className={`p-3.5 border-b rounded-t-2xl flex items-center justify-between gap-2 ${
                  isWeekend
                    ? isDark
                      ? "bg-rose-950/25 border-rose-900/40"
                      : "bg-rose-50/70 border-rose-100"
                    : isToday
                    ? isDark
                      ? "bg-teal-950/25 border-slate-800"
                      : "bg-teal-50/50 border-slate-100"
                    : isDark
                    ? "bg-slate-950/40 border-slate-800"
                    : "bg-slate-50/80 border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-xl border flex flex-col items-center justify-center font-bold text-xs ${
                      isWeekend
                        ? isDark
                          ? "bg-rose-950/30 border-rose-900/40"
                          : "bg-rose-50 border-rose-200"
                        : isToday
                        ? isDark
                          ? "bg-brand-teal text-white border-brand-teal"
                          : "bg-brand-teal text-white border-brand-teal shadow-xs"
                        : isDark
                        ? "bg-slate-900 border-slate-800 text-slate-300"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <span
                      className={`text-[7px] uppercase font-bold tracking-wider leading-tight ${
                        isToday
                          ? "text-teal-100"
                          : isWeekend
                          ? isDark
                            ? "text-rose-500/60"
                            : "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {isWeekend ? "LBR" : "TGL"}
                    </span>
                    <span
                      className={`leading-none font-extrabold ${
                        isToday
                          ? "text-white"
                          : isWeekend
                          ? isDark
                            ? "text-rose-200"
                            : "text-rose-950"
                          : isDark
                          ? "text-slate-100"
                          : "text-slate-800"
                      }`}
                    >
                      {dayNum}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-extrabold tracking-wide uppercase ${
                          isWeekend
                            ? "text-rose-600 dark:text-rose-400"
                            : isToday
                            ? "text-brand-teal dark:text-brand-teal font-extrabold"
                            : isDark
                            ? "text-slate-200"
                            : "text-slate-800"
                        }`}
                      >
                        {dayName}
                      </span>
                      {isToday && (
                        <span className="text-[8px] bg-brand-teal text-white font-bold px-1.5 py-0.2 rounded-full uppercase leading-tight">
                          Hari Ini
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {dayNum} {monthName}
                    </span>
                  </div>
                </div>

                {/* Header Action Menu: Copy Day / Paste / Active Indicator */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyDayTasks(dateKey, dayName);
                    }}
                    title="Salin Semua Tugas Hari Ini (Ctrl+C)"
                    className={`p-1.5 rounded-lg transition cursor-pointer text-slate-400 hover:text-brand-teal ${
                      isDark ? "hover:bg-slate-800" : "hover:bg-slate-200/60"
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {clipboard && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePasteTasks(dateKey);
                      }}
                      title="Tempel Tugas dari Clipboard (Ctrl+V)"
                      className="p-1.5 rounded-lg transition cursor-pointer text-brand-teal hover:bg-teal-50 dark:hover:bg-teal-950/30"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Day Score (Nilai) & Progress Box */}
              <div className={`p-3 border-b flex items-center justify-between gap-2 ${
                isDark ? "border-slate-800/80 bg-slate-950/20" : "border-slate-100 bg-slate-50/40"
              }`}>
                {/* Score Input Box */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    <Award className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Nilai:</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Contoh: 90"
                    value={score}
                    onChange={(e) => handleScoreChange(dateKey, e.target.value)}
                    className={`w-full text-xs font-bold px-2 py-1 rounded-lg border outline-none transition text-center ${
                      isDark
                        ? "bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                        : "bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                    }`}
                  />
                </div>

                {/* Completion Mini Pill */}
                <div className="text-[10px] font-bold text-slate-400 shrink-0 text-right">
                  <span className={completedCount === totalCount && totalCount > 0 ? "text-brand-teal font-extrabold" : ""}>
                    {completedCount}/{totalCount}
                  </span>
                </div>
              </div>

              {/* Progress bar line */}
              {totalCount > 0 && (
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 overflow-hidden">
                  <div
                    className="bg-brand-teal h-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {/* Task Items List (Tampilan Langsung & Praktis dengan Dukungan Seleksi & Shortcut) */}
              <div
                style={{ height: `${panelHeight}px` }}
                className="p-3 space-y-2.5 overflow-y-auto min-h-[160px]"
              >
                {tasks.length === 0 ? (
                  <div className="h-full py-8 flex flex-col items-center justify-center text-center">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
                      isDark ? "bg-slate-800/60 text-teal-400/40" : "bg-teal-50 text-teal-600/50"
                    }`}>
                      <CheckCircle2 className="w-5 h-5 stroke-[1.5]" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">Belum ada tugas</span>
                  </div>
                ) : (
                  tasks.map((task, idx) => {
                    const pConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.do;
                    const durationStr = calculateDuration(task.startTime, task.endTime);
                    const isTaskSelected = selectedTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDateKey(dateKey);
                          setSelectedTaskId(task.id);
                        }}
                        className={`p-2.5 rounded-xl border transition-all duration-150 flex flex-col gap-2 relative cursor-pointer ${
                          isTaskSelected
                            ? "ring-2 ring-brand-teal bg-teal-50/20 dark:bg-teal-950/30 border-brand-teal shadow-xs"
                            : task.completed
                            ? isDark
                              ? "bg-slate-950/40 border-slate-800/60 opacity-60"
                              : "bg-slate-50/80 border-slate-100 opacity-65"
                            : isDark
                            ? "bg-slate-900 border-slate-800 hover:border-teal-700/60 shadow-xs"
                            : "bg-white border-slate-200/80 hover:border-teal-300 shadow-xs"
                        }`}
                      >
                        {/* Baris 1: Checkbox + Input Nama Tugas + Tombol Pindah (Atas/Bawah) + Tombol Salin + Tombol Hapus */}
                        <div className="flex items-center gap-1.5">
                          {/* Checkbox button - Hijau Tosca */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTask(dateKey, task.id);
                            }}
                            className="text-brand-teal hover:opacity-80 transition cursor-pointer shrink-0"
                            title={task.completed ? "Tandai Belum Selesai" : "Tandai Selesai"}
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-brand-teal fill-brand-teal/20" />
                            ) : (
                              <Circle className="w-4 h-4 text-teal-600 dark:text-teal-400 hover:text-brand-teal" />
                            )}
                          </button>

                          {/* Task Text Input */}
                          <input
                            type="text"
                            placeholder="Nama tugas..."
                            value={task.text}
                            onFocus={() => {
                              setSelectedDateKey(dateKey);
                              setSelectedTaskId(task.id);
                            }}
                            onChange={(e) => handleUpdateTaskText(dateKey, task.id, e.target.value)}
                            className={`w-full text-xs font-semibold bg-transparent outline-none leading-normal min-w-0 ${
                              task.completed
                                ? "line-through text-slate-400 dark:text-slate-500"
                                : isDark
                                ? "text-slate-100 focus:text-white"
                                : "text-slate-800 focus:text-slate-900"
                            }`}
                          />

                          {/* Action Buttons: Pindah Atas/Bawah */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveTask(dateKey, idx, "up");
                              }}
                              title="Pindahkan Ke Atas"
                              className={`p-1 rounded-md transition ${
                                idx === 0
                                  ? "opacity-25 cursor-not-allowed text-slate-400"
                                  : isDark
                                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                              }`}
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              disabled={idx === tasks.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveTask(dateKey, idx, "down");
                              }}
                              title="Pindahkan Ke Bawah"
                              className={`p-1 rounded-md transition ${
                                idx === tasks.length - 1
                                  ? "opacity-25 cursor-not-allowed text-slate-400"
                                  : isDark
                                  ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                              }`}
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Action Button: Salin Tugas (Ctrl+C) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateKey(dateKey);
                              setSelectedTaskId(task.id);
                              handleCopySingleTask(task);
                            }}
                            title="Salin Tugas Ini (Ctrl+C)"
                            className={`p-1 rounded-md transition cursor-pointer shrink-0 ${
                              isDark
                                ? "text-slate-400 hover:text-brand-teal hover:bg-slate-800"
                                : "text-slate-400 hover:text-brand-teal hover:bg-teal-50"
                            }`}
                          >
                            <Copy className="w-3 h-3" />
                          </button>

                          {/* Action Button: Hapus Tugas */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(dateKey, task.id);
                            }}
                            title="Hapus Tugas"
                            className={`p-1 rounded-md transition cursor-pointer shrink-0 ${
                              isDark
                                ? "text-slate-400 hover:text-rose-400 hover:bg-rose-950/30"
                                : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            }`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Baris 2: Dropdown Prioritas Kuadran & Waktu / Durasi */}
                        <div className="flex items-center justify-between gap-2 pl-5.5 text-[10px]">
                          {/* Dropdown Prioritas (Do, Decide, Delegate, Delete) */}
                          <div className="relative inline-flex items-center">
                            <select
                              value={task.priority}
                              onChange={(e) =>
                                handleUpdateTaskPriority(
                                  dateKey,
                                  task.id,
                                  e.target.value as TimeBoxPriority
                                )
                              }
                              className={`appearance-none text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 pr-4 rounded-md border outline-none cursor-pointer transition ${
                                isDark
                                  ? `${pConf.badgeBgDark} ${pConf.badgeTextDark} ${pConf.borderDark}`
                                  : `${pConf.badgeBgLight} ${pConf.badgeTextLight} ${pConf.borderLight}`
                              }`}
                            >
                              <option value="do">Do</option>
                              <option value="decide">Decide</option>
                              <option value="delegate">Delegate</option>
                              <option value="delete">Delete</option>
                            </select>
                            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] opacity-70">
                              ▼
                            </span>
                          </div>

                          {/* Tombol Atur Waktu & Durasi */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateKey(dateKey);
                              setSelectedTaskId(task.id);
                              setActiveTimePicker({
                                dateKey,
                                taskId: task.id,
                                taskText: task.text,
                                startTime: task.startTime || "08:00",
                                endTime: task.endTime || "09:00"
                              });
                            }}
                            title="Klik untuk mengatur jam & durasi"
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-left cursor-pointer transition font-medium ${
                              task.startTime || task.endTime
                                ? isDark
                                  ? "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-brand-teal/40"
                                  : "bg-slate-50 border-slate-200 text-slate-700 hover:border-teal-300"
                                : isDark
                                ? "border-slate-800 text-slate-500 hover:text-slate-400 hover:border-slate-700"
                                : "border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <Clock className="w-3 h-3 text-brand-teal shrink-0" />
                            <span>
                              {task.startTime || task.endTime
                                ? `${task.startTime || "--:--"} - ${task.endTime || "--:--"}`
                                : "Atur Jam"}
                            </span>
                            {durationStr && (
                              <span className="font-extrabold text-brand-teal bg-brand-teal/10 px-1 rounded">
                                {durationStr}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Card Actions: Tombol Tambah Tugas */}
              <div className={`p-3 border-t flex items-center justify-between gap-2 ${
                isDark ? "border-slate-800 bg-slate-950/30" : "border-slate-100 bg-slate-50/50"
              }`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddTask(dateKey);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                    isDark
                      ? "border-slate-800 bg-slate-900 hover:bg-slate-850 text-brand-teal hover:border-brand-teal/40"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-brand-teal hover:border-brand-teal/40"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Tugas</span>
                </button>

                {completedCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearCompleted(dateKey);
                    }}
                    title="Bersihkan tugas yang selesai"
                    className={`p-2 rounded-xl border text-xs text-slate-400 hover:text-rose-500 transition cursor-pointer ${
                      isDark ? "border-slate-800 bg-slate-900 hover:bg-rose-950/20" : "border-slate-200 bg-white hover:bg-rose-50"
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* POP-UP TIME PICKER MODAL */}
      {activeTimePicker && (
        <TimePickerModal
          isDark={isDark}
          data={activeTimePicker}
          onClose={() => setActiveTimePicker(null)}
          onSave={(start, end) => {
            handleUpdateTaskTimes(
              activeTimePicker.dateKey,
              activeTimePicker.taskId,
              start,
              end
            );
            setActiveTimePicker(null);
            showToast("Waktu tugas berhasil diperbarui.");
          }}
          onClear={() => {
            handleUpdateTaskTimes(
              activeTimePicker.dateKey,
              activeTimePicker.taskId,
              "",
              ""
            );
            setActiveTimePicker(null);
            showToast("Waktu tugas dihapus.");
          }}
        />
      )}
    </div>
  );
}

// Sub-Component for Time Picker Pop-up
interface TimePickerModalProps {
  isDark: boolean;
  data: ActiveTimePickerState;
  onClose: () => void;
  onSave: (startTime: string, endTime: string) => void;
  onClear: () => void;
}

function TimePickerModal({
  isDark,
  data,
  onClose,
  onSave,
  onClear
}: TimePickerModalProps) {
  const [startTime, setStartTime] = useState(data.startTime || "08:00");
  const [endTime, setEndTime] = useState(data.endTime || "09:00");
  const currentDuration = calculateDuration(startTime, endTime);

  const handleAddDuration = (minsToAdd: number) => {
    const baseStart = startTime || "08:00";
    const [sh, sm] = baseStart.split(":").map(Number);
    if (isNaN(sh) || isNaN(sm)) return;
    const totalMins = sh * 60 + sm + minsToAdd;
    const newH = Math.floor((totalMins / 60) % 24);
    const newM = totalMins % 60;
    const newEnd = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
    setStartTime(baseStart);
    setEndTime(newEnd);
  };

  const handleApplyPreset = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-100"
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wide">
                Atur Waktu Tugas
              </h3>
              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                {data.taskText || "(Tanpa Nama)"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4">
          {/* Start & End Inputs */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`p-2.5 rounded-xl border ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-1">
                Jam Mulai
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-sm font-extrabold bg-transparent outline-none text-brand-teal cursor-pointer"
              />
            </div>

            <div className={`p-2.5 rounded-xl border ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-1">
                Jam Selesai
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-sm font-extrabold bg-transparent outline-none text-brand-teal cursor-pointer"
              />
            </div>
          </div>

          {/* Duration info */}
          {currentDuration && (
            <div className="text-center">
              <span className="text-[11px] font-extrabold text-brand-teal bg-brand-teal/10 px-3 py-1 rounded-lg border border-brand-teal/20">
                Total Durasi: {currentDuration}
              </span>
            </div>
          )}

          {/* Quick Add Duration Buttons */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 block mb-1.5">
              Tambah Durasi Cepat:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[15, 30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleAddDuration(mins)}
                  className={`py-1 rounded-lg border text-[10px] font-bold transition cursor-pointer text-center ${
                    isDark
                      ? "bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300"
                      : "bg-slate-50 border-slate-200 hover:bg-teal-50 hover:text-brand-teal text-slate-700"
                  }`}
                >
                  +{mins >= 60 ? `${mins / 60} Jam` : `${mins}m`}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 block mb-1.5">
              Preset Waktu:
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleApplyPreset("08:00", "09:00")}
                className={`p-1.5 rounded-lg border text-[10px] font-bold text-left transition cursor-pointer ${
                  isDark ? "bg-slate-950 border-slate-800 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-teal-50"
                }`}
              >
                Pagi (08:00 - 09:00)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("09:00", "11:00")}
                className={`p-1.5 rounded-lg border text-[10px] font-bold text-left transition cursor-pointer ${
                  isDark ? "bg-slate-950 border-slate-800 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-teal-50"
                }`}
              >
                Fokus (09:00 - 11:00)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("13:00", "15:00")}
                className={`p-1.5 rounded-lg border text-[10px] font-bold text-left transition cursor-pointer ${
                  isDark ? "bg-slate-950 border-slate-800 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-teal-50"
                }`}
              >
                Siang (13:00 - 15:00)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("19:00", "21:00")}
                className={`p-1.5 rounded-lg border text-[10px] font-bold text-left transition cursor-pointer ${
                  isDark ? "bg-slate-950 border-slate-800 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-teal-50"
                }`}
              >
                Malam (19:00 - 21:00)
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex items-center justify-between gap-2 ${
          isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-100"
        }`}>
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
          >
            Hapus Waktu
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                isDark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
              }`}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => onSave(startTime, endTime)}
              className="py-1.5 px-4 rounded-xl bg-brand-teal hover:bg-teal-600 text-white text-xs font-extrabold shadow-sm transition cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
