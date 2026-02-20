import { TrailerStatus, SyncLog, SamsaraFormSubmission, DataIssue } from '../types';
import { MOCK_TRAILERS, DROP_TEMPLATE_UUID, PICK_TEMPLATE_UUID, TRAILER_MASTER_LIST } from '../constants';

interface SamsaraRawSubmission {
  id: string;
  formTemplateId: string;
  driver?: { name?: string };
  trailerNumber?: string;
  location?: string;
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
const STORAGE_KEY_CURSOR = 'grant_samsara_cursor';


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

// --- DB bootstrap ---

const initDB = () => {
  const existingSubs = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
  if (!existingSubs) {
    const bootSubmissions: SamsaraFormSubmission[] = [];

    MOCK_TRAILERS.forEach((t: any, idx: number) => {
      const baseDriver = t.droppedBy ?? t.pickedUpBy ?? `Driver ${idx + 1}`;
      const baseLocation = t.location ?? `Location ${idx + 1}`;
      const pickupAt = new Date(t.lastUpdated);

      if (t.status === 'DROPPED') {
        bootSubmissions.push({
          id: `bootstrap-${t.id}-drop`,
          templateId: DROP_TEMPLATE_UUID,
          event: 'DROP',
          driverName: baseDriver,
          trailerNumber: t.id,
          location: baseLocation,
          submittedAt: pickupAt.toISOString(),
          condition: t.condition ?? 'Good',
          notes: '',
          customerName: t.customerName ?? '',
          dropLocationDesc: t.dropLocationDesc ?? '',
          defectLevel: t.defectLevel ?? 'No',
          defectNotes: t.defectNotes ?? '',
          photoUrls: [],
        });
      } else {
        const dropAt = new Date(pickupAt.getTime() - 2 * 60 * 60 * 1000);
        bootSubmissions.push(
          {
            id: `bootstrap-${t.id}-drop`,
            templateId: DROP_TEMPLATE_UUID,
            event: 'DROP',
            driverName: baseDriver,
            trailerNumber: t.id,
            location: baseLocation,
            submittedAt: dropAt.toISOString(),
            condition: t.condition ?? 'Good',
            notes: '',
            customerName: t.customerName ?? '',
            dropLocationDesc: '',
            defectLevel: 'No',
            defectNotes: '',
            photoUrls: [],
          },
          {
            id: `bootstrap-${t.id}-pick`,
            templateId: PICK_TEMPLATE_UUID,
            event: 'PICK',
            driverName: baseDriver,
            trailerNumber: t.id,
            location: baseLocation,
            submittedAt: pickupAt.toISOString(),
            notes: '',
            customerName: t.customerName ?? '',
            photoUrls: [],
          }
        );
      }
    });

    localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(bootSubmissions));
  }

  updateDerivedOpenTrailers();
};

const getSubmissions = (): SamsaraFormSubmission[] => {
  initDB();
  const data = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
  return data ? JSON.parse(data) : [];
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

  const cursor = localStorage.getItem(STORAGE_KEY_CURSOR);
  const url = new URL('/api/samsara-proxy', window.location.origin);
  if (cursor) {
    url.searchParams.set('after', cursor);
  } else {
    // startTime is required by Samsara stream endpoint on first request (no cursor)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    url.searchParams.set('startTime', oneYearAgo);
  }
  // Note: formTemplateIds is NOT a valid param for /stream — filter client-side below

  let hasNext = true;
  let nextCursor = cursor;
  let processedCount = 0;
  const newSubmissions: SamsaraFormSubmission[] = [];
  let loopLimit = 5;

  while (hasNext && loopLimit > 0) {
    loopLimit--;
    let body: SamsaraStreamResponse;

    try {
      const resp = await fetch(url.toString());
      if (resp.status === 400) {
        // Stale or invalid cursor — clear it and restart with startTime
        const errText = await resp.text().catch(() => '');
        console.warn('Samsara 400 response:', errText);
        localStorage.removeItem(STORAGE_KEY_CURSOR);
        url.searchParams.delete('after');
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        url.searchParams.set('startTime', oneYearAgo);
        nextCursor = null;
        const retryResp = await fetch(url.toString());
        if (!retryResp.ok) throw new Error(`API Error: ${retryResp.status} ${await retryResp.text().catch(() => '')}`);
        body = await retryResp.json();
      } else if (!resp.ok) {
        throw new Error(`API Error: ${resp.statusText}`);
      } else {
        body = await resp.json();
      }
    } catch (e) {
      console.log('Using Mock Samsara Stream due to:', e);
      body = await mockSamsaraStreamResponse(nextCursor);
    }

    for (const s of body.data.filter(s => s.formTemplateId === DROP_TEMPLATE_UUID || s.formTemplateId === PICK_TEMPLATE_UUID)) {
      const rawTrailerNum =
        extractInput(s.inputs, 'Trailer # (enter exactly as on trailer)') ||
        extractInput(s.inputs, 'Trailer Number') ||
        s.trailerNumber ||
        `TRL-${Math.floor(Math.random() * 1000)}`;

      const trailerNumber = normalizeTrailerNumber(rawTrailerNum);
      const event = s.formTemplateId === DROP_TEMPLATE_UUID ? 'DROP' : 'PICK';
      // Drop form uses "Any damage or defect found?", pickup form uses "Visible damage"
      const defectRaw = extractInput(s.inputs, 'Visible damage') || extractInput(s.inputs, 'Any damage or defect found?');
      const defectLevel = (VALID_DEFECT_LEVELS as readonly string[]).includes(defectRaw)
        ? (defectRaw as SamsaraFormSubmission['defectLevel'])
        : 'No';

      newSubmissions.push({
        id: s.id,
        templateId: s.formTemplateId,
        event: event as 'DROP' | 'PICK',
        driverName: s.driver?.name || 'Unknown Driver',
        trailerNumber,
        location: s.location || extractInput(s.inputs, 'Location Address') || 'Unknown Location',
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
    nextCursor = body.pagination.endCursor ?? nextCursor;
    hasNext = body.pagination.hasNextPage;
    if (hasNext && body.pagination.endCursor) {
      url.searchParams.set('after', body.pagination.endCursor);
    }
  }

  if (newSubmissions.length > 0) {
    const allSubs = getSubmissions();
    const existingIds = new Set(allSubs.map(s => s.id));
    const uniqueNew = newSubmissions.filter(s => !existingIds.has(s.id));
    if (uniqueNew.length > 0) setSubmissions([...allSubs, ...uniqueNew]);
  }

  if (nextCursor && nextCursor !== cursor) {
    localStorage.setItem(STORAGE_KEY_CURSOR, nextCursor);
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
