export enum AppMode {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  BOARD = 'BOARD',
}

export interface TrailerStatus {
  id: string; // Trailer Number (normalized)
  status: 'DROPPED' | 'PICKED_UP';
  location: string;
  lastUpdated: string; // ISO Date
  droppedBy?: string;
  pickedUpBy?: string;
  notes?: string;
  condition?: 'Good' | 'Damaged' | 'Needs Service';
  // Extended fields from Samsara form
  customerName?: string;
  dropLocationDesc?: string;
  defectLevel?: 'No' | 'Yes (minor)' | 'Yes (needs attention)';
  defectNotes?: string;
  photoUrls?: string[];
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
  // Extended fields from Samsara form inputs
  customerName?: string;
  dropLocationDesc?: string;
  gpsAddress?: string;
  defectLevel?: 'No' | 'Yes (minor)' | 'Yes (needs attention)';
  defectNotes?: string;
  accessoryNotes?: string;
  photoUrls?: string[];
  // Raw coordinates preserved for re-geocoding
  rawLat?: number;
  rawLng?: number;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILURE';
  recordsProcessed: number;
  message?: string;
}

export interface DataIssue {
  id: string;
  type: 'PICKUP_WITHOUT_DROP' | 'UNKNOWN_TRAILER';
  trailerNumber: string;
  submissionId: string;
  timestamp: string;
  message: string;
}
