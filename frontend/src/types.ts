export enum WorkflowStep {
  UPLOAD = 'UPLOAD',
  CONFIG = 'CONFIG',
  PROCESSING = 'PROCESSING',
  REVIEW = 'REVIEW',
  EXPORT = 'EXPORT',
  FAULT_FINDING = 'FAULT_FINDING'
}

export interface DocumentFile {
  name: string;
  size: number;
  type: 'reference' | 'target';
  uploadDate: number;
  file: File;
}

export interface Citation {
  id: string; // e.g., "fn_01"
  anchorNumber: number;
  originalContext: string; // The sentence in English
  originalFootnote: string; // The content in English
  translatedFootnote: string; // The translated content
  targetSentence: string; // The matched sentence in Chinese
  confidence: number; // 0.0 to 1.0
  status: 'pending' | 'accepted' | 'rejected' | 'manual_review';
  isOrphaned: boolean;
  insertionIndex?: number; // Simulated character index
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  module: 'PARSER' | 'SEMANTIC_ALIGN' | 'FORMATTER' | 'Python';
  message: string;
}

export interface AppState {
  step: WorkflowStep;
  referenceDoc: DocumentFile | null;
  targetDoc: DocumentFile | null;
  citationStyle: string;
  citations: Citation[];
  processingProgress: number;
  systemLogs: SystemLog[];
}
