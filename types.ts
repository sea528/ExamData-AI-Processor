export interface ExamData {
  subject: string;
  average: number;
  totalStudents: number;
  gradeCounts: {
    score_90_100: number;
    score_80_89: number;
    score_70_79: number;
    score_60_69: number;
    score_50_59: number;
    score_40_49: number;
    score_30_39: number;
    score_20_29: number;
    score_10_19: number;
    score_0_9: number;
  };
}

export interface ProcessingStatus {
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

export enum AnalysisType {
  DETAILED = 'DETAILED', // For the per-subject detailed sheets
  SUMMARY = 'SUMMARY'    // For the summary table sheets
}