
// Supported Gemini Models
export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

// Type for a single session's timing details
export interface SessionDetail {
  session: string;
  warmUp: string;
  startTime: string;
}

// Type for general meet information
export interface MeetInfo {
  meetName: string;
  dates: string;
  location: string;
  entryLimits: string;
  awards: string;
  sessionDetails: SessionDetail[];
}

// Combined type for the entire extracted data from the PDF
export interface MeetData {
  meetInfo: MeetInfo;
  events: RawSwimEvent[];
}

// Type returned directly from Gemini API for an event
export interface RawSwimEvent {
  eventNumber: string;
  ageGroup: string;
  distance: number;
  stroke: string;
  day: string;
  originalDescription: string;
}

// Processed event type for use in the app
export interface SwimEvent extends RawSwimEvent {
  id: string; // Unique ID for React key and state management
  gender: 'Girls' | 'Boys' | 'Mixed';
}

export interface ShareableEvent extends Omit<SwimEvent, 'id'> {}

export interface ShareStorageMetadata {
  type: 'github';
  owner: string;
  repo: string;
  branch: string;
  path: string;
  id: string;
}

export interface SharePayload {
  version: number;
  meetInfo?: MeetInfo;
  events?: ShareableEvent[];
  generatedAt: string;
  storage?: ShareStorageMetadata;
}

export interface StoredShareData {
  version: number;
  generatedAt: string;
  meetInfo: MeetInfo;
  events: ShareableEvent[];
}

export interface ShareStoragePreferences {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  githubFolder: string;
  githubToken: string;
}

export interface PublishedLink {
  id: string;
  meetName: string;
  createdAt: string;
  url: string;
  eventsCount: number;
  storage?: ShareStorageMetadata;
}

export interface FilterOptions {
  day: string;
  ageGroup: string;
  stroke: string;
  distance: string;
  gender: string;
}

export interface FilterSelectOptions {
    days: string[];
    ageGroups: string[];
    strokes: string[];
    distances: string[];
    genders: string[];
}
