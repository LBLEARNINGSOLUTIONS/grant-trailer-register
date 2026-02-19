// Samsara Form Template UUIDs
export const DROP_TEMPLATE_UUID = "7848226a-9b29-4a31-ac34-a473ab2fb638";
export const PICK_TEMPLATE_UUID = "64be8840-2975-4805-b88e-1a69833b9eaa";

// Deep Links for Samsara Driver App
export const DEEP_LINK_DROP = `samsaradriver://navigate/forms_submission_page/${DROP_TEMPLATE_UUID}`;
export const DEEP_LINK_PICK = `samsaradriver://navigate/forms_submission_page/${PICK_TEMPLATE_UUID}`;

export const MOCK_TRAILERS = [
  { id: 'TRL-501', status: 'DROPPED', location: 'Distribution Center A', lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), droppedBy: 'John Doe', condition: 'Good' },
  { id: 'TRL-502', status: 'PICKED_UP', location: 'En Route', lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), pickedUpBy: 'Jane Smith', condition: 'Good' },
  { id: 'TRL-503', status: 'DROPPED', location: 'Yard B', lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), droppedBy: 'Mike Ross', condition: 'Needs Service' }, // Aging > 24h
  { id: 'TRL-504', status: 'DROPPED', location: 'Yard A', lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), droppedBy: 'Harvey Specter', condition: 'Damaged' }, // Aging and Needs Attention
  { id: 'TRL-505', status: 'DROPPED', location: 'Distribution Center C', lastUpdated: new Date(Date.now() - 1000 * 60 * 45).toISOString(), droppedBy: 'Louis Litt', condition: 'Good' },
] as const;
