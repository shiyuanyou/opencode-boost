export interface SessionInfo {
  id: string;
  title: string;
  updated: number;
  created: number;
  projectId: string;
  directory: string;
}

export interface ExportedSession {
  info: {
    id: string;
    slug: string;
    projectID: string;
    directory: string;
    title: string;
    version: string;
    time: { created: number; updated: number };
    [key: string]: unknown;
  };
  messages: ExportedMessage[];
}

export interface ExportedMessage {
  info: {
    id: string;
    sessionID: string;
    parentID?: string;
    role: "user" | "assistant";
    time: { created: number; completed?: number };
    [key: string]: unknown;
  };
  parts: MessagePart[];
}

export interface MessagePart {
  type: string;
  text?: string;
  id: string;
  sessionID: string;
  messageID: string;
  [key: string]: unknown;
}

// Local store types
export interface NamesStore {
  [directory: string]: {
    [name: string]: string; // name → session-id
  };
}

export interface StateStore {
  [directory: string]: {
    current: string | null; // name of active session
  };
}

export interface ForkInfo {
  parentSessionId: string;
  parentMessageId: string;
  timestamp: number;
}

export interface ForksStore {
  [directory: string]: {
    [childSessionId: string]: ForkInfo;
  };
}
