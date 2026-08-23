/**
 * Reports, DMS, timeline, and automation chart shapes. The data is
 * intentionally EMPTY — see dashboard-data.ts.
 *
 * Automation success/failure counts in particular read as a health signal,
 * so invented ones claim the system is working when nothing has run.
 */

export interface ReportUsageItem {
  name: string;
  runsCount: number;
  category: string;
}

export interface DmsFileTypeItem {
  type: string;
  count: number;
  color: string;
}

export interface TimelineModulePoint {
  module: string;
  events: number;
}

export interface AutomationRunPoint {
  day: string;
  successful: number;
  failed: number;
}

export const MOCK_REPORT_USAGE: ReportUsageItem[] = [];

export const MOCK_DMS_FILE_TYPES: DmsFileTypeItem[] = [];

export const MOCK_TIMELINE_ACTIVITY: TimelineModulePoint[] = [];

export const MOCK_AUTOMATION_RUNS: AutomationRunPoint[] = [];
