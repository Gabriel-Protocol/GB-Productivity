export interface HabitGroup {
  id: string;
  name: string;
  items: any[];
  enabled?: boolean;
  color?: string;
}

export interface UserConfig {
  theme: "light" | "dark";
  thresholdVeryBad: number;
  thresholdBad: number;
  thresholdFair: number;
  habitsConfig: HabitGroup[];
}

export interface DailyRecord {
  hours: number;
  completedHabits: string[]; // Concatenated references: "habitGroupId::itemIndex"
}

export interface MonthlyData {
  [dateStr: string]: DailyRecord;
}
