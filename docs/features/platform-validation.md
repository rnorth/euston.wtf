# Platform Validation Feature

## Overview

The platform validation feature helps users identify potentially incorrect unconfirmed platform assignments by cross-referencing them against actual platform departure schedules from London Euston Station.

## What It Does

When viewing train departures, the app analyzes unconfirmed platform assignments and displays a warning if a platform assignment appears uncertain. This "process of elimination" approach helps passengers avoid waiting at the wrong platform when schedule data is ambiguous.

## How It Works

### Data Sources

The feature combines data from two API endpoints:

1. **Journeys endpoint** (`/journeys/EUS/{destination}`) - Returns trains going to your selected destination
2. **Departures endpoint** (`/departures/EUS`) - Returns all upcoming departures from Euston, grouped by platform

Both endpoints are fetched in parallel and refresh together on the app's 60-second auto-refresh cycle.

### Validation Logic

For each journey with an unconfirmed platform, the app checks:

1. **Is the platform confirmed?** → If yes, no warning (high confidence)
2. **Is this train the next departure from that platform?** → If yes (matching serviceUid), no warning (high confidence)
3. **Is there a different train departing from that platform within 10 minutes?** → If yes, show warning (low confidence)
4. **Is the next departure from that platform more than 10 minutes later?** → If yes, no warning (enough time for platform turnover)

Trains flagged `isDeparted` are skipped when looking for the next departure. The `/departures/EUS`
endpoint keeps them and reports their *actual* departure time, so an already-departed service
would otherwise be picked as a conflict for a platform it has long since left.

The 5-minute threshold represents tight but realistic turnaround time for Euston's platform reuse patterns.

### What You See

**When a platform assignment is uncertain:**
- A yellow warning tag appears: **⚠️ Platform uncertain**
- Click or tap the tag to expand details
- Details show: "Next departure from Platform {X} at **{time}** goes to **{destination}**"
- Click again to collapse

**When a platform assignment is confident:**
- No warning displayed
- Platform shown as normal (bold if confirmed, regular if scheduled)

## User Experience

### Visual Design

The warning indicator:
- Appears in the status column (third column) alongside other tags like "At Platform" or "Delayed"
- Uses Bulma's warning color scheme (yellow/orange) for consistency
- Includes accessibility features (keyboard navigation with Enter/Space)
- Expands smoothly with a 300ms slide animation

### Example Scenarios

**Scenario 1: Confirmed Platform**
```
18:05 Platform 8 (Confirmed)
Status: At Platform
```
No warning - platform is confirmed.

**Scenario 2: Unconfirmed but Confident**
```
18:40 Platform 10 (Scheduled)
```
No warning - next Platform 10 departure is this train OR there's no conflicting departure within 10 minutes.

**Scenario 3: Uncertain Platform**
```
18:25 Platform 11 (Scheduled)
⚠️ Platform uncertain
```
Click to see: "Next departure from Platform 11 at **18:30** goes to **Manchester Piccadilly**"

The warning indicates that a different train is scheduled to depart from Platform 11 just 10 minutes later, suggesting Platform 11 might not be correct for the 18:25 service.

## Technical Implementation

### Frontend Architecture

**Files Modified:**
- `src/lib/departures.ts` - Data fetching, stores, and validation logic
- `src/lib/JourneyPane.svelte` - UI component for displaying warnings

**Key Components:**

**1. Type Definitions**
```typescript
interface Journey {
    // ... existing fields
    destination: string;              // TIPLOC code
    destinationDescription: string;   // Full station name
}

interface PlatformValidation {
    isConfident: boolean;
    conflictingDeparture?: Journey;
}
```

**2. Data Stores**
```typescript
export const departures = writable<Departures | null>(null);
export const departuresByPlatform = writable<{[key: string]: Journey[]} | null>(null);
```

**3. Validation Function**
```typescript
export function validatePlatform(
    journey: Journey,
    departuresByPlatform: {[key: string]: Journey[]} | null
): PlatformValidation
```

**4. Svelte 5 Reactivity**
```typescript
// In JourneyPane.svelte
let validation = $derived(validatePlatform(journey, $departuresByPlatform));
let showConflictDetails = $state(false);
```

### Backend Requirements

The feature requires the backend API to provide:

1. **destinationDescription field** in Journey objects containing full station names
2. **Departures endpoint** (`/departures/EUS`) returning:
   ```json
   {
     "summary": {
       "station": "EUS",
       "allPlatforms": ["1", "2", "3", ...]
     },
     "departuresByPlatform": {
       "8": [Journey, Journey, ...],
       "11": [Journey, Journey, ...],
       ...
     }
   }
   ```

Both endpoints use 55-second cache TTL for optimal performance.

## Edge Cases

The validation handles these scenarios correctly:

| Scenario | Behavior |
|----------|----------|
| Platform is confirmed | Never show warning |
| No platform assigned | No warning (neutral) |
| No departures data available | No warning (fail safe) |
| Same serviceUid match | No warning (it's the same train) |
| Next departure >5 mins later | No warning (normal platform turnover) |
| No next departure from platform | No warning (confident) |
| destinationDescription is null | Falls back to TIPLOC code |

## Performance

- **Parallel fetching**: Both API calls happen simultaneously
- **Edge caching**: Both endpoints cached at CDN layer (55s TTL)
- **Reactive updates**: Validation recalculates only when data changes
- **Minimal overhead**: Simple time arithmetic and object lookups

## Accessibility

- **Keyboard navigation**: Tab to focus, Enter/Space to toggle details
- **ARIA roles**: Warning indicator has `role="button"`
- **Screen readers**: Semantic HTML with proper labels
- **Visual indicators**: High contrast warning colors

## Limitations

1. **Depends on schedule accuracy**: Warnings only as good as the underlying RTT data
2. **5-minute threshold is fixed**: Not configurable (by design, to avoid complexity)
3. **No historical accuracy tracking**: Doesn't learn from past platform assignments
4. **Real-time only**: Doesn't predict future platform changes

## Future Enhancements

Potential improvements (not currently planned):

- Historical accuracy metrics for platform predictions
- User-submitted platform confirmations
- Push notifications when platforms are confirmed
- Machine learning for confidence scoring
- Integration with live station cameras

## Troubleshooting

### I don't see any warnings

This is normal! Warnings only appear when:
1. Platform is unconfirmed AND
2. A different train departs from that platform within 10 minutes

During normal operations with accurate schedules, you might not see warnings frequently.

### Warnings seem incorrect

Check:
1. Browser console for API errors
2. That auto-refresh is working (data updates every 60 seconds)
3. That both API endpoints are returning data

### Details won't expand

Ensure JavaScript is enabled and check browser console for errors.

## Related Documentation

- **CLAUDE.md** - Complete codebase guide for AI assistants
- **API Documentation** - Backend API endpoint specifications
- **Svelte 5 Guide** - Framework-specific reactivity patterns

---

**Feature Status**: ✅ Active
**Last Updated**: 2026-07-28
**Version**: 1.0
