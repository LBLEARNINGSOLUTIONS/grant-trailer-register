import { TrailerStatus, SyncLog, SamsaraFormSubmission, DataIssue } from '../types';
import { DROP_TEMPLATE_UUID, PICK_TEMPLATE_UUID, TRAILER_MASTER_LIST } from '../constants';

interface SamsaraRawSubmission {
  id: string;
  formTemplateId?: string;                              // flat field (fallback)
  formTemplate?: { id?: string; name?: string };        // nested object (real Samsara shape)
  driver?: { name?: string };
  trailerNumber?: string;
  // Samsara returns location as an object with lat/lng, not a string
  location?: string | { latitude?: number; longitude?: number; address?: string };
  submittedAt?: string;
  condition?: string;
  notes?: string;
  // Real Samsara API shape
  inputs?: { label: string; value: string }[];
  media?: { url: string; type?: string }[];
}

interface SamsaraStreamResponse {
  data: SamsaraRawSubmission[];
  pagination: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}

const STORAGE_KEY_TRAILERS = 'grant_trailers_db';
const STORAGE_KEY_SUBMISSIONS = 'grant_samsara_submissions';
const STORAGE_KEY_LOGS = 'grant_sync_logs';
const STORAGE_KEY_OWNER_NOTIFIED = 'grant_owner_notified';
const STORAGE_KEY_LAST_SYNC = 'grant_last_sync_time';


// --- Samsara form input helpers ---

function extractInput(inputs: { label: string; value: string }[] | undefined, label: string): string {
  if (!inputs) return '';
  const match = inputs.find(i => i.label.toLowerCase().includes(label.toLowerCase()));
  return match?.value ?? '';
}

function extractPhotos(media: { url: string; type?: string }[] | undefined): string[] {
  if (!media) return [];
  return media.filter(m => !m.type || m.type === 'image').map(m => m.url);
}

function normalizeTrailerNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-');
}

function locationToString(loc: SamsaraRawSubmission['location']): string {
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  return loc.address || (loc.latitude != null ? `${loc.latitude}, ${loc.longitude}` : '');
}

// --- DB bootstrap ---

const initDB = () => {
  if (!localStorage.getItem(STORAGE_KEY_SUBMISSIONS)) {
    localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify([]));
  }
  updateDerivedOpenTrailers();
};

const sanitizeSubmission = (s: SamsaraFormSubmission): SamsaraFormSubmission => ({
  ...s,
  location: typeof s.location === 'string' ? s.location : (() => {
    const loc = s.location as any;
    return loc?.address || (loc?.latitude != null ? `${loc.latitude}, ${loc.longitude}` : 'Unknown Location');
  })(),
});

const getSubmissions = (): SamsaraFormSubmission[] => {
  initDB();
  const data = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
  const subs: SamsaraFormSubmission[] = data ? JSON.parse(data) : [];
  return subs.map(sanitizeSubmission);
};

const setSubmissions = (subs: SamsaraFormSubmission[]) => {
  localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(subs));
  updateDerivedOpenTrailers();
};

// --- Activity Feed ---

const getSubmissionsSortedDesc = (): SamsaraFormSubmission[] => {
  const subs = getSubmissions();
  return subs.slice().sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
};

export const getRecentSubmissions = (): SamsaraFormSubmission[] => getSubmissionsSortedDesc();

export const getActivity = (limit = 25) => getSubmissionsSortedDesc().slice(0, limit);

export const getActivitySummary = (limit = 25) => {
  const subs = getSubmissionsSortedDesc();
  const seen = localStorage.getItem(STORAGE_KEY_OWNER_NOTIFIED);
  const seenTs = seen ? Date.parse(seen) : 0;
  const activity = subs.slice(0, limit);
  const newCount = subs.filter(s => Date.parse(s.submittedAt) > seenTs).length;
  return { activity, newCount };
};

export const markActivitySeen = (seenAt?: string) => {
  const subs = getSubmissionsSortedDesc();
  const ts = seenAt ?? subs[0]?.submittedAt;
  if (ts) localStorage.setItem(STORAGE_KEY_OWNER_NOTIFIED, ts);
};

// --- Trailer history ---

export const getTrailerHistory = (trailerNumber: string, limit = 10): SamsaraFormSubmission[] => {
  const subs = getSubmissions();
  return subs
    .filter(s => s.trailerNumber === trailerNumber)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, limit);
};

// --- Derived open trailers ---

const deriveOpenTrailers = (subs: SamsaraFormSubmission[]): TrailerStatus[] => {
  const byTrailer = new Map<string, { latest: SamsaraFormSubmission; lastDrop?: SamsaraFormSubmission }>();

  subs
    .slice()
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .forEach(s => {
      const prev = byTrailer.get(s.trailerNumber);
      const record = prev ?? { latest: s };
      if (s.event === 'DROP') record.lastDrop = s;
      record.latest = s;
      byTrailer.set(s.trailerNumber, record);
    });

  const open: TrailerStatus[] = [];

  for (const [trailerNumber, rec] of byTrailer.entries()) {
    if (rec.latest.event !== 'DROP') continue;
    const lastDrop = rec.lastDrop ?? rec.latest;

    open.push({
      id: trailerNumber,
      status: 'DROPPED',
      location: lastDrop.location,
      lastUpdated: lastDrop.submittedAt,
      droppedBy: lastDrop.driverName,
      condition: lastDrop.condition ?? 'Good',
      notes: lastDrop.notes ?? '',
      customerName: lastDrop.customerName ?? '',
      dropLocationDesc: lastDrop.dropLocationDesc ?? '',
      defectLevel: lastDrop.defectLevel ?? 'No',
      defectNotes: lastDrop.defectNotes ?? '',
      photoUrls: lastDrop.photoUrls ?? [],
    });
  }

  return open.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
};

export const updateDerivedOpenTrailers = () => {
  const data = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
  const subs = data ? JSON.parse(data) : [];
  const open = deriveOpenTrailers(subs);
  localStorage.setItem(STORAGE_KEY_TRAILERS, JSON.stringify(open));
};

export const getTrailers = (): TrailerStatus[] => {
  initDB();
  const data = localStorage.getItem(STORAGE_KEY_TRAILERS);
  return data ? JSON.parse(data) : [];
};

// --- Data issues ---

export const getDataIssues = (): DataIssue[] => {
  const subs = getSubmissions().sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  const issues: DataIssue[] = [];
  const masterSet = new Set(TRAILER_MASTER_LIST.map(t => t.toUpperCase()));
  const droppedTrailers = new Set<string>();

  for (const s of subs) {
    const tNum = s.trailerNumber.toUpperCase();

    if (TRAILER_MASTER_LIST.length > 0 && !masterSet.has(tNum)) {
      issues.push({
        id: `issue-unknown-${s.id}`,
        type: 'UNKNOWN_TRAILER',
        trailerNumber: s.trailerNumber,
        submissionId: s.id,
        timestamp: s.submittedAt,
        message: `Trailer "${s.trailerNumber}" is not in the master trailer list.`,
      });
    }

    if (s.event === 'DROP') {
      droppedTrailers.add(tNum);
    } else if (s.event === 'PICK' && !droppedTrailers.has(tNum)) {
      issues.push({
        id: `issue-nodrop-${s.id}`,
        type: 'PICKUP_WITHOUT_DROP',
        trailerNumber: s.trailerNumber,
        submissionId: s.id,
        timestamp: s.submittedAt,
        message: `Pickup recorded for "${s.trailerNumber}" with no prior drop on record.`,
      });
    }
  }

  return issues.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// --- Sync logs ---

export const getLogs = (): SyncLog[] => {
  const data = localStorage.getItem(STORAGE_KEY_LOGS);
  return data ? JSON.parse(data) : [];
};

const setLogs = (logs: SyncLog[]) => localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));

// --- Samsara sync ---

const VALID_DEFECT_LEVELS = ['No', 'Yes (minor)', 'Yes (needs attention)'] as const;

const mockSamsaraStreamResponse = async (_cursor: string | null): Promise<SamsaraStreamResponse> => {
  await new Promise(resolve => setTimeout(resolve, 800));

  const data: SamsaraRawSubmission[] = [];

  if (Math.random() > 0.4) {
    const isDrop = Math.random() > 0.5;
    const templateId = isDrop ? DROP_TEMPLATE_UUID : PICK_TEMPLATE_UUID;
    const trailers = getTrailers();
    let trailerNum = TRAILER_MASTER_LIST[Math.floor(Math.random() * TRAILER_MASTER_LIST.length)] ?? `TRL-${100 + Math.floor(Math.random() * 900)}`;
    if (!isDrop && trailers.length > 0) {
      trailerNum = trailers[Math.floor(Math.random() * trailers.length)].id;
    }
    const defectLevel = isDrop && Math.random() > 0.8 ? 'Yes (minor)' : 'No';

    data.push({
      id: crypto.randomUUID(),
      formTemplateId: templateId,
      driver: { name: 'Simulated Driver' },
      trailerNumber: trailerNum,
      location: isDrop ? 'Distribution Center' : 'En Route',
      submittedAt: new Date().toISOString(),
      inputs: isDrop ? [
        { label: 'Job / Stop / Customer / Yard', value: 'Simulated Customer' },
        { label: 'Trailer # (enter exactly as on trailer)', value: trailerNum },
        { label: 'Drop location description', value: 'Dock #1' },
        { label: 'Any damage or defect found?', value: defectLevel },
        { label: 'If yes, please specify', value: defectLevel !== 'No' ? 'Minor scuff on side panel' : '' },
      ] : [
        { label: 'Job / Stop / Customer / Yard', value: 'Simulated Customer' },
        { label: 'Trailer Number', value: trailerNum },
        { label: 'Visible damage', value: defectLevel },
        { label: 'If yes, please specify here', value: defectLevel !== 'No' ? 'Minor scuff on side panel' : '' },
      ],
      media: [],
    });
  }

  return { data, pagination: { hasNextPage: false, endCursor: crypto.randomUUID() } };
};

async function syncSamsara() {
  initDB();

  // Use last sync time as startTime so we only fetch new submissions.
  // Cursors are used within a single sync for pagination but never persisted
  // between syncs — this avoids "Parameters differ" errors from stale cursors.
  const lastSync = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
  const startTime = lastSync ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL('/api/samsara-proxy', window.location.origin);
  url.searchParams.set('startTime', startTime);

  let hasNext = true;
  let processedCount = 0;
  const newSubmissions: SamsaraFormSubmission[] = [];
  let loopLimit = 10;
  let useMock = false;

  while (hasNext && loopLimit > 0) {
    loopLimit--;
    let body: SamsaraStreamResponse;

    try {
      if (useMock) throw new Error('mock');
      const resp = await fetch(url.toString());
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`API Error: ${resp.status} ${errText}`);
      }
      body = await resp.json();
      if (body.data.length > 0) console.log('[Samsara raw sample]', JSON.stringify(body.data[0]).slice(0, 600));
    } catch (e) {
      console.log('Using Mock Samsara Stream due to:', e);
      useMock = true;
      body = await mockSamsaraStreamResponse(null);
      hasNext = false;
    }

    for (const s of body.data) {
      const templateId = s.formTemplate?.id ?? s.formTemplateId ?? '';
      if (templateId !== DROP_TEMPLATE_UUID && templateId !== PICK_TEMPLATE_UUID) continue;

      const rawTrailerNum =
        extractInput(s.inputs, 'Trailer # (enter exactly as on trailer)') ||
        extractInput(s.inputs, 'Trailer Number') ||
        s.trailerNumber ||
        `TRL-${Math.floor(Math.random() * 1000)}`;

      const trailerNumber = normalizeTrailerNumber(rawTrailerNum);
      const event = templateId === DROP_TEMPLATE_UUID ? 'DROP' : 'PICK';
      const defectRaw = extractInput(s.inputs, 'Visible damage') || extractInput(s.inputs, 'Any damage or defect found?');
      const defectLevel = (VALID_DEFECT_LEVELS as readonly string[]).includes(defectRaw)
        ? (defectRaw as SamsaraFormSubmission['defectLevel'])
        : 'No';

      newSubmissions.push({
        id: s.id,
        templateId,
        event: event as 'DROP' | 'PICK',
        driverName: s.driver?.name || 'Unknown Driver',
        trailerNumber,
        location: locationToString(s.location) || extractInput(s.inputs, 'Location Address') || 'Unknown Location',
        submittedAt: s.submittedAt || new Date().toISOString(),
        condition: (s.condition as SamsaraFormSubmission['condition']) || 'Good',
        notes: s.notes || '',
        customerName: extractInput(s.inputs, 'Job / Stop / Customer / Yard'),
        dropLocationDesc: extractInput(s.inputs, 'Drop location description'),
        gpsAddress: extractInput(s.inputs, 'Location Address'),
        defectLevel,
        defectNotes: extractInput(s.inputs, 'If yes, please specify'),
        accessoryNotes: extractInput(s.inputs, 'Accessories left with trailer'),
        photoUrls: extractPhotos(s.media),
      });
    }

    processedCount += body.data.length;
    hasNext = body.pagination.hasNextPage;
    if (hasNext && body.pagination.endCursor) {
      // Within-sync cursor: same startTime, just advance the page
      url.searchParams.set('after', body.pagination.endCursor);
    }
  }

  if (newSubmissions.length > 0) {
    const allSubs = getSubmissions();
    const existingIds = new Set(allSubs.map(s => s.id));
    const uniqueNew = newSubmissions.filter(s => !existingIds.has(s.id));
    if (uniqueNew.length > 0) setSubmissions([...allSubs, ...uniqueNew]);
  }

  // Advance the sync window; next sync will start from now (minus a small overlap)
  if (!useMock) {
    const overlapMs = 5 * 60 * 1000; // 5-minute overlap to catch late-indexed submissions
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date(Date.now() - overlapMs).toISOString());
  }

  return processedCount;
}

export const triggerSamsaraSync = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const count = await syncSamsara();
    const logs = getLogs();
    logs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      recordsProcessed: count,
      message: count > 0 ? `Synced ${count} new submissions.` : 'Sync complete. No new records.',
    });
    setLogs(logs);
    return { success: true, message: `Synced ${count} records.` };
  } catch (error: any) {
    const logs = getLogs();
    logs.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      status: 'FAILURE',
      recordsProcessed: 0,
      message: error.message || 'Unknown error during sync.',
    });
    setLogs(logs);
    return { success: false, message: 'Sync failed.' };
  }
};

export const getNewEventsForOwnerNotifications = (limit = 5) => {
  const subs = getSubmissionsSortedDesc();
  const notified = localStorage.getItem(STORAGE_KEY_OWNER_NOTIFIED);
  const notifiedTs = notified ? Date.parse(notified) : 0;
  const newEvents = subs.filter(s => Date.parse(s.submittedAt) > notifiedTs);
  const ordered = newEvents.slice().sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
  const toNotify = ordered.slice(0, limit);
  const last = toNotify[toNotify.length - 1];
  return { toNotify, lastTs: last?.submittedAt };
};

export const markOwnerNotified = (lastTs?: string) => {
  const subs = getSubmissionsSortedDesc();
  const ts = lastTs ?? subs[0]?.submittedAt;
  if (ts) localStorage.setItem(STORAGE_KEY_OWNER_NOTIFIED, ts);
};
