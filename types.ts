
export type Role = 'user' | 'assistant';

export interface FileData {
  data: string;
  mimeType: string;
}

export interface GlossaryItem {
  id: string;
  term: string;
  subject: string; // New field for categorization
  definition: string;
  timestamp: Date;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
  attachment?: FileData;
}

// Added SavedSession interface to resolve compilation errors
export interface SavedSession {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  glossary: GlossaryItem[];
}