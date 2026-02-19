import { TrailerStatus, SyncLog, SamsaraFormSubmission } from '../types';
import { MOCK_TRAILERS, DROP_TEMPLATE_UUID, PICK_TEMPLATE_UUID } from '../constants';

interface SamsaraRawSubmission {
  id: string;
  formTemplateId: string;
  driver?: { name?: string };
  trailerNumber?: string;
  location?: string;
  submittedAt?: string;
  condition?: string;
  notes?: string;
}

interface SamsaraStreamResponse {
  data: SamsaraRawSubmission[];
  pagination: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}

const STORAGE_KEY_TRAILERS = 'grant_trailers_db'; // derived open-state (what Owner dashboard reads)
const STORAGE_KEY_SUBMISSIONS = 'grant_samsara_submissions'; // raw-ish stream
const STORAGE_KEY_LOGS = 'grant_sync_logs';
const STORAGE_KEY_OWNER_NOTIFIED = 'grant_owner_notified';
const STORAGE_KEY_CURSOR = 'grant_samsara_cursor';

const SAMSARA_API_TOKEN = import.meta.env.VITE_SAMSARA_API_TOKEN ?? '';

const initDB = () => {
  const existingSubs = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
  if (!existingSubs) {
    // Bootstrap submissions from mock trailer state
    const bootSubmissions: SamsaraFormSubmission[] = [];

    MOCK_TRAILERS.forEach((t: any, idx: number) => {
      // This mock dataset stores final state; derive submissions with sane ordering
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
          notes: t.notes ?? '',
        });
      } else {
        // If picked up, assume drop happened earlier
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
            notes: t.notes ?? '',
          },
          {
            id: `bootstrap-${t.id}-pick`,
            templateId: PICK_TEMPLATE_UUID,
            event: 'PICK',
            driverName: baseDriver,
            trailerNumber: t.id,
            location: baseLocation,
            submittedAt: pickupAt.toISOString(),
            notes: t.notes ?? '',
          }
        );
      }
    });

    localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(bootSubmissions));
  }

  // Always compute and write derived trailer state for the Owner dashboard
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

// Activity Feed Helpers
const getSubmissionsSortedDesc = (): SamsaraFormSubmission[] => {
  const subs = getSubmissions();
  return subs.slice().sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
};

export const getRecentSubmissions = (): SamsaraFormSubmission[] => {
  return getSubmissionsSortedDesc();
};

export const getActivity = (limit = 25) => {
  return getSubmissionsSortedDesc().slice(0, limit);
};

export const getActivitySummary = (limit = 25) => {
  const subs = getSubmissionsSortedDesc();
  const seen = localStorage.getItem(STORAGE_KEY_OWNER_NOTIFIED);
  const seenTs = seen ? Date.parse(seen) : 0;

  const latest = subs[0]?.submittedAt ?? '';
  const activity = subs.slice(0, limit);

  const newCount = subs.filter((s) => Date.parse(s.submittedAt) > seenTs).length;

  return { activity, newCount, latest };
};

export const markActivitySeen = (seenAt?: string) => {
  const subs = getSubmissionsSortedDesc();
  const ts = seenAt ?? subs[0]?.submittedAt;

  if (ts) {
    localStorage.setItem(STORAGE_KEY_OWNER_NOTIFIED, ts);
  }
};

const deriveOpenTrailers = (subs: SamsaraFormSubmission[]): TrailerStatus[] => {
  const byTrailer = new Map<
    string,
    {
      latest: SamsaraFormSubmission;
      lastDrop?: SamsaraFormSubmission;
    }
  >();

  // Sort like a stream (by submittedAt) so "latest wins"
  subs
    .slice()
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .forEach((s) => {
      const prev = byTrailer.get(s.trailerNumber);
      const record = prev ?? { latest: s };

      if (s.event === 'DROP') record.lastDrop = s;

      // always update latest
      record.latest = s;
      byTrailer.set(s.trailerNumber, record);
    });

  const open: TrailerStatus[] = [];

  for (const [trailerNumber, rec] of byTrailer.entries()) {
    // Open if the last event is DROP
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
    });
  }

  // newest first
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

export const getLogs = (): SyncLog[] => {
  const data = localStorage.getItem(STORAGE_KEY_LOGS);
  return data ? JSON.parse(data) : [];
};

const setLogs = (logs: SyncLog[]) => localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));

// --- Samsara Sync Logic ---

const extractTrailerNumber = (submission: SamsaraRawSubmission): string => {
  // In a real implementation, you would parse submission.inputs
  return submission.trailerNumber || `TRL-${Math.floor(Math.random() * 1000)}`;
};

/**
 * Mocks the Samsara API stream response for demonstration purposes.
 * Generates random events to simulate live activity.
 */
const mockSamsaraStreamResponse = async (_cursor: string | null) => {
  await new Promise(resolve => setTimeout(resolve, 800)); // Network delay

  const chance = Math.random();
  const data: any[] = [];
  
  // 40% chance of no new data
  if (chance > 0.4) {
    const isDrop = Math.random() > 0.5;
    const templateId = isDrop ? DROP_TEMPLATE_UUID : PICK_TEMPLATE_UUID;
    const trailers = getTrailers(); // current open trailers
    
    // If Picking, try to pick an open trailer
    let trailerNum = `TRL-${100 + Math.floor(Math.random() * 900)}`;
    if (!isDrop && trailers.length > 0) {
      trailerNum = trailers[Math.floor(Math.random() * trailers.length)].id;
    }

    data.push({
      id: crypto.randomUUID(),
      formTemplateId: templateId,
      driver: { name: 'Simulated Driver' },
      trailerNumber: trailerNum,
      location: isDrop ? 'Distribution Center' : 'En Route',
      submittedAt: new Date().toISOString(),
      condition: isDrop ? (Math.random() > 0.8 ? 'Needs Service' : 'Good') : undefined,
      notes: 'Synced from Samsara'
    });
  }

  return {
    data,
    pagination: {
      hasNextPage: false,
      endCursor: crypto.randomUUID()
    }
  };
};

/**
 * Core sync logic requested by user.
 * Attempts to fetch from Samsara API. Falls back to mock if no token/failure.
 */
async function syncSamsara() {
  initDB(); // Ensure DB is initialized
  
  const cursor = localStorage.getItem(STORAGE_KEY_CURSOR);
  const url = new URL('https://api.samsara.com/form-submissions/stream');

  if (cursor) url.searchParams.set('after', cursor);
  url.searchParams.append('formTemplateIds', DROP_TEMPLATE_UUID);
  url.searchParams.append('formTemplateIds', PICK_TEMPLATE_UUID);

  let hasNext = true;
  let nextCursor = cursor;
  let processedCount = 0;
  let newSubmissions: SamsaraFormSubmission[] = [];
  let loopLimit = 5; // Safety break

  while (hasNext && loopLimit > 0) {
    loopLimit--;
    let body: SamsaraStreamResponse;

    try {
      if (!SAMSARA_API_TOKEN) throw new Error("Missing Token");
      
      const resp = await fetch(url.toString(), { 
        headers: { authorization: `Bearer ${SAMSARA_API_TOKEN}` } 
      });
      
      if (!resp.ok) throw new Error(`API Error: ${resp.statusText}`);
      body = await resp.json();

    } catch (e) {
      // Fallback to mock logic if real API fails (expected in this demo)
      console.log("Using Mock Samsara Stream due to:", e);
      body = await mockSamsaraStreamResponse(nextCursor);
    }

    const submissions = body.data ?? [];
    const pagination = body.pagination;

    for (const s of submissions) {
      const trailerNumber = extractTrailerNumber(s);
      const event = s.formTemplateId === DROP_TEMPLATE_UUID ? 'DROP' : 'PICK';

      const sub: SamsaraFormSubmission = {
        id: s.id,
        templateId: s.formTemplateId,
        event: event as 'DROP' | 'PICK',
        driverName: s.driver?.name || 'Unknown Driver',
        trailerNumber: trailerNumber,
        location: s.location || 'Unknown Location',
        submittedAt: s.submittedAt || new Date().toISOString(),
        condition: (s.condition as SamsaraFormSubmission['condition']) || 'Good',
        notes: s.notes || '',
      };

      newSubmissions.push(sub);
    }

    processedCount += submissions.length;
    nextCursor = pagination.endCursor ?? nextCursor;
    
    hasNext = pagination.hasNextPage;
    if (hasNext && pagination.endCursor) {
      url.searchParams.set('after', pagination.endCursor);
    }
  }

  // "Transaction": Save submissions and update derived state
  if (newSubmissions.length > 0) {
    const allSubs = getSubmissions();
    // Simple deduplication based on ID
    const existingIds = new Set(allSubs.map(s => s.id));
    const uniqueNew = newSubmissions.filter(s => !existingIds.has(s.id));
    
    if (uniqueNew.length > 0) {
      const updated = [...allSubs, ...uniqueNew];
      setSubmissions(updated); // Saves to localStorage and updates open trailers
    }
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
      message: count > 0 ? `Synced ${count} new submissions.` : 'Sync complete. No new records.'
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
      message: error.message || 'Unknown error during sync.'
    });
    setLogs(logs);

    return { success: false, message: 'Sync failed.' };
  }
};

export const getNewEventsForOwnerNotifications = (limit = 5) => {
  const subs = getSubmissionsSortedDesc();
  const notified = localStorage.getItem(STORAGE_KEY_OWNER_NOTIFIED);
  const notifiedTs = notified ? Date.parse(notified) : 0;

  const newEvents = subs.filter((s) => Date.parse(s.submittedAt) > notifiedTs);

  // Show oldest first so toasts appear in chronological order
  const ordered = newEvents.slice().sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
  const toNotify = ordered.slice(0, limit);

  const last = toNotify[toNotify.length - 1];
  const lastTs = last?.submittedAt;

  return { toNotify, lastTs };
};

export const markOwnerNotified = (lastTs?: string) => {
  const subs = getSubmissionsSortedDesc();
  const ts = lastTs ?? subs[0]?.submittedAt;

  if (ts) {
    localStorage.setItem(STORAGE_KEY_OWNER_NOTIFIED, ts);
  }
};