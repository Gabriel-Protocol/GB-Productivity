export interface HabitGroup {
  id: string;
  name: string;
  description?: string;
  items: any[];
  enabled?: boolean;
  color?: string; // Standard color string (teal, emerald, etc.) or a hex code like #ae44dd
}

export interface UserConfig {
  theme: "light" | "dark";
  thresholdVeryBad: number;
  thresholdBad: number;
  thresholdFair: number;
  habitsConfig: HabitGroup[];
}

export type TimeBoxPriority = "do" | "decide" | "delegate" | "delete";

export interface TimeBoxTask {
  id: string;
  text: string;
  completed: boolean;
  startTime?: string;
  endTime?: string;
  priority: TimeBoxPriority;
  order: number;
}

export interface DailyRecord {
  hours: number;
  completedHabits: string[]; // Concatenated references: "habitGroupId::itemIndex"
  timeboxTasks?: TimeBoxTask[];
  timeboxScore?: string | number;
}

export interface MonthlyData {
  [dateStr: string]: DailyRecord;
}
