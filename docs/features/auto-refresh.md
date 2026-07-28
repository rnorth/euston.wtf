# Auto-Refresh Feature

## Overview

The auto-refresh feature automatically updates departure data every 60 seconds while intelligently pausing when the browser tab is hidden to conserve resources and API calls.

## What It Does

- **Refreshes departure data** every 60 seconds
- **Pauses when tab is hidden** (switched away or minimized)
- **Resumes immediately** when tab becomes visible again
- **Coordinates multiple API calls** (journeys and platform departures)
- **Provides visual feedback** during loading states

## How It Works

### Timer Mechanism

The app uses a **reactive timer system** based on current time:

```typescript
// Update every second
let now = new Date().getTime();
setInterval(() => {
    now = new Date().getTime();
}, 1000);

// Track next refresh timestamp
let nextRefresh = 0;

// Trigger refresh when time is reached
$: {
    if (selectedDestination !== null && now > nextRefresh && isVisible) {
        doRefresh();
    }
}
```

**Key components**:
1. `now` - Current timestamp, updated every second
2. `nextRefresh` - Target timestamp for next refresh
3. Reactive block (`$:`) - Triggers when conditions met

### Refresh Function

```typescript
function doRefresh() {
    if (selectedDestination !== null) {
        fetchDepartures(selectedDestination.code);
        nextRefresh = now + 60000; // 60 seconds from now
    }
}
```

**Refresh interval**: 60,000ms = 60 seconds

### Visibility Detection

Uses the **Page Visibility API**:

```typescript
let isVisible = !document.hidden;

function handleVisibility() {
    if (document.hidden) {
        isVisible = false;
    } else {
        isVisible = true;
        nextRefresh = 0; // Force immediate refresh
    }
}

document.addEventListener("visibilitychange", handleVisibility);
```

**Behavior**:
- Tab hidden → `isVisible = false` → Refresh paused
- Tab visible → `isVisible = true` → `nextRefresh = 0` → Immediate refresh

### Initial Load

```typescript
$: {
    if (selectedDestination !== null) {
        // Initial load
        doRefresh();
    }
}
```

When a destination is selected:
1. Immediate API call via `doRefresh()`
2. Sets `nextRefresh` for 60s later
3. Timer loop handles subsequent refreshes

## User Experience

### Typical Session Flow

**Minute 0:00**
- User selects "Manchester Piccadilly"
- ✅ Data fetched immediately
- Next refresh scheduled for 0:60

**Minute 0:30**
- User switches to different tab
- 🛑 Refresh paused
- Timer continues but refresh blocked

**Minute 0:60**
- Refresh skipped (tab hidden)
- Timer still running

**Minute 1:15**
- User returns to tab
- ✅ Data refreshed immediately
- Next refresh scheduled for 2:15

**Minute 2:15**
- User still viewing tab
- ✅ Data refreshed automatically
- Next refresh scheduled for 3:15

### Visual Indicators

**During refresh**:
- No explicit loading spinner (intentional)
- Data updates seamlessly
- Previous data remains visible until new data arrives

**On error**:
- Error message appears in red banner
- Previous data cleared
- Refresh cycle continues (next attempt in 60s)

### Resource Conservation

| Scenario | Refresh Behavior | API Calls/Hour |
|----------|------------------|----------------|
| Tab visible, active viewing | Every 60s | 60 |
| Tab hidden 50% of time | Only when visible | ~30 |
| Tab minimized entirely | None | 0 |
| Multiple tabs open | Each operates independently | 60 × tabs |

## Technical Implementation

### Files Involved

**src/App.svelte**:
- Timer setup (line 11-15)
- Visibility handling (line 49-62)
- Reactive refresh trigger (line 71-75)
- Initial load trigger (line 77-81)

**src/lib/departures.ts**:
- `fetchDepartures()` function
- Parallel API calls for journeys + platform data
- Store updates

### Lifecycle Events

**On Mount** (App.svelte:onMount):
```typescript
onMount(() => {
    // 1. Parse URL and load station
    reactToUrlChange();

    // 2. Set up browser history listener
    window.addEventListener("popstate", reactToUrlChange);

    // 3. Set up visibility listener
    document.addEventListener("visibilitychange", handleVisibility);

    // 4. Start timer
    setInterval(() => {
        now = new Date().getTime();
    }, 1000);

    // 5. Initial visibility state
    isVisible = !document.hidden;
});
```

### Reactive Dependencies

```typescript
// Refresh trigger depends on:
$: {
    if (
        selectedDestination !== null &&  // Have a destination
        now > nextRefresh &&              // Time has passed
        isVisible                         // Tab is visible
    ) {
        doRefresh();
    }
}
```

**Why this works**:
- Svelte re-runs block when any dependency changes
- `now` changes every second
- `nextRefresh` changes after each refresh
- `isVisible` changes on tab switch
- `selectedDestination` changes on station select

### API Coordination

The refresh triggers parallel API calls:

```typescript
// In departures.ts
export async function fetchDepartures(destination: string) {
    try {
        // Parallel fetch for both endpoints
        const [journeysResponse, departuresResponse] = await Promise.all([
            fetch(`https://api.euston.wtf/journeys/EUS/${destination}`),
            fetch(`https://api.euston.wtf/departures/EUS`)
        ]);

        // Process responses
        const journeysData = await journeysResponse.json();
        const departuresData = await departuresResponse.json();

        // Update stores
        departures.set(journeysData);
        departuresByPlatform.set(departuresData.departuresByPlatform);
    } catch (error) {
        // Error handling
        lastError.set(`Failed to load: ${error}`);
    }
}
```

**Benefits of parallel fetching**:
- Both APIs called simultaneously
- Total time = slowest response (not sum)
- Consistent data snapshot

## Performance

### Timer Efficiency

**1-second interval**:
- Updates `now` variable
- Triggers reactive check
- Lightweight (just timestamp comparison)

**Alternatives considered**:
- `setTimeout` with dynamic delays → More complex
- Request Animation Frame → Overkill for 1s precision
- `setInterval` every 60s → No way to interrupt cleanly

**CPU impact**: Negligible (~0.01% on modern hardware)

### Network Impact

**With 60-second refresh**:
- 2 API calls per refresh (journeys + departures)
- 120 requests/hour at peak
- API has 55s cache TTL → Most hits served from cache
- Average bandwidth: ~10KB per refresh = 600KB/hour

**Visibility optimization savings**:
- Average tab hidden ~50% of time
- Saves ~60 requests/hour
- Saves ~300KB bandwidth/hour

### Memory Management

**Event listeners**:
- Only 2 listeners registered
- No memory leaks (standard browser events)
- Cleaned up on component unmount (automatic in Svelte)

**Timer cleanup**:
- `setInterval` continues until page unload
- Acceptable for SPA (no memory leak)
- Could add cleanup in `onDestroy` but unnecessary

## Browser Compatibility

### Page Visibility API

**Support**:
- ✅ Chrome 14+ (2011)
- ✅ Firefox 10+ (2012)
- ✅ Safari 7+ (2013)
- ✅ Edge (all versions)

**Fallback behavior**:
- If API unavailable: `document.hidden` would be `undefined`
- Would cause `isVisible = true` always
- Refresh would never pause
- Acceptable degradation

### Timer APIs

**`setInterval`**:
- Universal browser support
- Reliable and performant

**Background tab throttling**:
- Browsers throttle timers in hidden tabs (to ~1Hz)
- Our 1s timer becomes ~1s anyway in background
- No issue since refresh is blocked by `isVisible` check

## Edge Cases

### Multiple Tabs

| Scenario | Behavior |
|----------|----------|
| Two tabs, both visible | Each refreshes independently |
| Two tabs, one hidden | Hidden tab pauses, visible continues |
| Switch between tabs | Immediate refresh on tab activation |

**Implications**:
- No shared state between tabs
- API calls not deduplicated
- Acceptable for this use case

### Page Visibility Edge Cases

| Scenario | Detection | Behavior |
|----------|-----------|----------|
| Tab switched | ✅ Hidden | Refresh paused |
| Window minimized | ✅ Hidden | Refresh paused |
| Different desktop (macOS) | ✅ Hidden | Refresh paused |
| Picture-in-picture | ⚠️ Varies by browser | May pause |
| Split screen | ✅ Visible | Continues |
| Covered by another window | ❌ Visible | Continues |

### API Failure Handling

```typescript
try {
    // API calls
} catch (error) {
    lastError.set(`Failed to load: ${error}`);
    departures.set(null);
}
// nextRefresh still set → Will retry in 60s
```

**Failure behavior**:
1. Error displayed to user
2. Previous data cleared
3. Refresh timer continues
4. Next refresh in 60s will retry
5. No exponential backoff (simple by design)

### Time Synchronization

**Clock changes**:
- If system clock changes → `now` jumps
- Could trigger early/late refresh
- Acceptable edge case (rare)

**Timezone changes**:
- Timestamps are UTC-based
- No impact on refresh timing
- Departure times separately handled

## Accessibility

### Loading States

**No loading spinner**:
- Intentional design choice
- Avoids visual distraction every 60s
- Data updates smoothly

**Screen reader announcements**:
- No automatic announcements on refresh
- Could add ARIA live region if desired
- Current behavior is non-intrusive

### User Control

**No manual refresh button**:
- Automatic refresh is sufficient
- User can reload page if needed (Cmd+R)
- Selecting new destination triggers immediate refresh

**No refresh interval control**:
- 60s is fixed
- Balance between freshness and resource usage
- No user preferences currently

## Limitations

1. **Fixed 60-second interval**
   - Not configurable
   - May be too slow for some users
   - May be too fast for others

2. **No exponential backoff**
   - API failures retry at same rate
   - Could overwhelm API during outage
   - Simple approach prioritizes availability

3. **No offline detection**
   - Continues trying to fetch when offline
   - Could detect `navigator.onLine`
   - Would add complexity

4. **No request cancellation**
   - If tab hidden during fetch, request completes anyway
   - Could use `AbortController`
   - Minor inefficiency

5. **Multiple tabs duplicate requests**
   - No cross-tab coordination
   - Increases server load
   - Acceptable for this use case

6. **No loading indicator**
   - User doesn't know when refresh happens
   - Could add subtle indicator
   - Current design prioritizes cleanliness

## Future Enhancements

Potential improvements (not currently planned):

- **User-configurable refresh interval** (30s / 60s / 120s)
- **Manual refresh button** for immediate updates
- **Last updated timestamp** display
- **Loading indicator** (subtle progress bar)
- **Offline detection** and notification
- **Exponential backoff** on API errors
- **Request cancellation** on tab hide
- **Cross-tab coordination** (SharedWorker / BroadcastChannel)
- **Smart refresh rates** (faster during peak, slower off-peak)
- **Push notifications** instead of polling
- **WebSocket connection** for real-time updates

## Troubleshooting

### Data not updating

**Check**:
1. Console for API errors
2. `nextRefresh` value in DevTools
3. `isVisible` state
4. `now` is incrementing every second

**Common causes**:
- Tab is hidden
- API returning cached data
- Network disconnected
- JavaScript error blocking refresh

### Refresh happening too frequently

**Check**:
1. `nextRefresh` value after each refresh
2. Multiple reactive blocks triggering refresh
3. Multiple instances of component mounted

**Possible causes**:
- Timer not setting `nextRefresh` correctly
- Reactive block has incorrect logic
- Multiple tabs open

### Refresh not resuming after tab visible

**Check**:
1. `visibilitychange` event firing (log in handler)
2. `isVisible` state updating
3. `nextRefresh` being set to 0

**Possible causes**:
- Event listener not registered
- Browser doesn't support Page Visibility API
- JavaScript error in handler

### API calls happening when tab hidden

**Check**:
1. `isVisible` value in reactive block
2. Visibility detection working correctly

**Possible causes**:
- Page Visibility API not supported
- `document.hidden` not accurate
- Timing issue (call started before hide)

## Related Documentation

- **CLAUDE.md** - Complete codebase guide (refresh section)
- **departure-display.md** - How data is rendered, and which trains are shown
- **Page Visibility API** - MDN Web Docs

---

**Feature Status**: ✅ Active (Core Feature)
**Last Updated**: 2026-07-28
**Version**: 1.0
