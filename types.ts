export enum AppMode {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN'
}

export interface TrailerStatus {
  id: string; // Trailer Number
  status: 'DROPPED' | 'PICKED_UP';
  location: string;
  lastUpdated: string; // ISO Date
  droppedBy?: string;
  pickedUpBy?: string;
  notes?: string;
  condition?: 'Good' | 'Damaged' | 'Needs Service';
}

export interface SamsaraFormSubmission {
  id: string;
  templateId: string; // UUID for Drop or Pick
  event: 'DROP' | 'PICK'; // derived from templateId
  driverName: string;
  trailerNumber: string;
  location: string;
  submittedAt: string;
  notes?: string;
  condition?: 'Good' | 'Damaged' | 'Needs Service';
}

export interface SyncLog {
  id: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILURE';
  recordsProcessed: number;
  message?: string;
}