# Job Acceptance Logic - Implementation Summary

## Overview
Implemented automatic contact status updates when contacts accept or decline job invitations via SMS or through the roster board.

## Changes Made

### 1. **Twilio Webhook Handler** (`server/routes.ts` - lines 1472-1498)
When a contact replies to a job invitation SMS:

#### Before:
- Only updated the `availability` table status
- Contact status remained unchanged

#### After:
```typescript
if (parsed.status === "confirmed") {
  // Contact accepted - mark as "on_job"
  await storage.updateContact(contact.id, { status: "on_job" });
} else if (parsed.status === "declined") {
  // Contact declined - mark as "free"
  await storage.updateContact(contact.id, { status: "free" });
}
```

### 2. **Roster Board Availability Update** (`server/routes.ts` - lines 1571-1607)
When a manager drags a contact between status columns:

#### Before:
- Only updated the `availability` table status
- Contact status remained unchanged

#### After:
```typescript
if (status === "confirmed") {
  // Manager confirmed contact - mark as "on_job"
  await storage.updateContact(contact.id, { status: "on_job" });
} else if (status === "declined") {
  // Manager marked declined - mark as "free"
  await storage.updateContact(contact.id, { status: "free" });
}
```

### 3. **Frontend Real-time Updates** (`client/src/pages/roster-board.tsx` - line 121)
Added contact list invalidation:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["/api/jobs", params?.id, "roster"] });
  queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
  queryClient.invalidateQueries({ queryKey: ["/api/contacts"] }); // NEW: Update contacts list
  toast({
    title: "Status Updated",
    description: "Contact availability status has been updated",
  });
}
```

## How It Works

### Scenario 1: Contact Replies via SMS
1. Manager sends job invitation: "Hi John, are you available for Construction Project? Reply Y to confirm"
2. John replies: "Y"
3. Twilio forwards SMS to `/webhook/twilio/sms`
4. System:
   - Updates `availability.status` → `"confirmed"`
   - Updates `contact.status` → `"on_job"`
   - Sends acknowledgement SMS back to John
5. Contact list immediately shows John as "On Job"

### Scenario 2: Manager Uses Roster Board
1. Manager opens `/jobs/{jobId}/roster`
2. Manager drags John from "No Reply" to "Confirmed"
3. System:
   - Updates `availability.status` → `"confirmed"`
   - Updates `contact.status` → `"on_job"`
   - Invalidates all relevant queries
4. Contact list immediately shows John as "On Job"

## Status Logic

| Availability Status | Contact Status | Behavior |
|-------------------|----------------|----------|
| `confirmed` | → `on_job` | Contact is actively assigned to a job |
| `declined` | → `free` | Contact is available for other jobs |
| `maybe` | (unchanged) | Tentative - no status change |
| `no_reply` | (unchanged) | Waiting for response - no status change |

## Benefits

1. **Automatic Sync**: Contact status automatically reflects their job assignments
2. **Real-time Updates**: UI updates immediately across all views
3. **Dual Entry Points**: Works for both SMS replies and manual roster management
4. **Consistent Behavior**: Same logic applied regardless of entry point
5. **Better Visibility**: Managers can see at a glance who is on jobs vs. available

## Testing

To test this functionality:

1. **SMS Flow**:
   - Create a job
   - Send invitation to a contact
   - Have contact reply "Y" via SMS
   - Check Contacts page - status should be "On Job"

2. **Roster Board Flow**:
   - Open a job's roster board
   - Drag a contact to "Confirmed"
   - Check Contacts page - status should be "On Job"

3. **Decline Flow**:
   - Contact replies "N" via SMS OR manager drags to "Declined"
   - Check Contacts page - status should be "Free"

