# Time Filtering Feature

## Overview

The time filtering feature automatically removes trains that have already departed, ensuring users only see relevant upcoming departures. This happens server-side and keeps the displayed information current and actionable.

## What It Does

- **Filters out past trains** that have already departed
- **Shows only future departures** from current time onward
- **Handles midnight crossover** (trains departing after midnight)
- **Updates on each refresh** (every 60 seconds)
- **Displays helpful message** when no upcoming trains exist

## How It Works

### Filtering Logic

The filtering happens **server-side** in the API (`departures.ts:91-99`):

```typescript
// Get current time and date
const nowHHMM = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
});
const todayDate = new Date().toISOString().split("T")[0];

// Filter journeys
data.journeys = data.journeys.filter((journey: Journey) => {
    // Show if departure time is in future OR it's an early tomorrow train
    return journey.departureTime > nowHHMM || journey.runDate !== todayDate;
});
```

**Key components**:
1. **`nowHHMM`** - Current time in "HH:MM" format (24-hour, GB locale)
2. **`todayDate`** - Current date in "YYYY-MM-DD" format
3. **String comparison** - Compares "HH:MM" strings directly
4. **Date check** - Includes trains running on different dates

### Time Comparison

**How string comparison works**:

```typescript
// These are strings, not time objects
"18:25" > "18:05"  // true
"18:05" > "18:25"  // false
"00:05" > "23:55"  // false (important for midnight handling)
```

**Why this works**:
- Format is always "HH:MM" (fixed width, zero-padded)
- 24-hour format ensures correct ordering
- Lexicographic comparison aligns with chronological order

**Edge case example**:
```
Current time: "23:45"
Train A: "23:50", runDate: "2026-01-27" → Kept (23:50 > 23:45)
Train B: "00:15", runDate: "2026-01-28" → Kept (runDate ≠ todayDate)
Train C: "23:30", runDate: "2026-01-27" → Filtered (23:30 < 23:45)
```

### Midnight Crossover

**Scenario**: It's 23:50 on Monday, and there are trains departing at:
- 23:55 Monday
- 00:05 Tuesday
- 00:15 Tuesday

**Handling**:
1. **23:55 train**: `"23:55" > "23:50"` → ✅ Kept
2. **00:05 train**: `"00:05" < "23:50"` BUT `runDate = "2026-01-28"` ≠ `"2026-01-27"` → ✅ Kept
3. **00:15 train**: Same logic as 00:05 → ✅ Kept

**Result**: All future trains shown correctly, regardless of date boundary

### Update Frequency

**Filtering is re-applied**:
- On initial load
- Every 60 seconds (auto-refresh)
- When selecting new destination

**Example timeline**:
```
18:04:30 - Refresh → 18:05 train shown
18:05:30 - Refresh → 18:05 train filtered out, 18:10 train now visible
```

**Grace period**: None. Trains filter out at their scheduled departure time.

## User Experience

### Normal Operation

**User sees**:
- Only trains departing after current time
- List updates every 60 seconds
- Trains disappear as they depart
- Next train moves to top of list

**Example at 18:15**:
```
✅ 18:25 → Manchester Piccadilly
✅ 18:30 → Birmingham New Street
✅ 18:35 → Liverpool Lime Street
❌ 18:05 → (not shown, already departed)
❌ 18:10 → (not shown, already departed)
```

### No Upcoming Trains

When all trains have departed:

```
┌──────────────────────────────────────┐
│  ℹ️ No upcoming departures            │
│                                      │
│  There are no trains to this         │
│  destination in the next few hours.  │
└──────────────────────────────────────┘
```

**Happens when**:
- Late night (last train has departed)
- Infrequent service (next train not in API response)
- All trains cancelled
- API returns empty array

### Edge Cases

**Scenario: Train delayed past current time**

```
Scheduled: 18:05
Actual: 18:25
Current time: 18:15
```

**Behavior**:
- Uses `departureTime` (actual time: 18:25)
- `"18:25" > "18:15"` → ✅ Kept
- Train still shown

**Scenario: Cancelled train**

```
Scheduled: 18:30
Status: Cancelled
```

**Behavior**:
- Still filtered by time
- If time hasn't passed, shown with CANCELLED banner
- If time has passed, filtered out

## Technical Implementation

### Location in Code

**File**: `src/lib/departures.ts`

**Function**: `fetchDepartures(destination: string)` (lines 66-112)

**Relevant section**:
```typescript
// Line 91-99
const nowHHMM = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
});
const todayDate = new Date().toISOString().split("T")[0];

data.journeys = data.journeys.filter((journey: Journey) => {
    return journey.departureTime > nowHHMM || journey.runDate !== todayDate;
});
```

### Data Types

**Journey interface** (departures.ts:1-29):
```typescript
interface Journey {
    departureTime: string;      // "HH:MM" format
    runDate: string;            // "YYYY-MM-DD" format
    // ... other fields
}
```

**Key fields for filtering**:
- `departureTime`: Actual departure time (or scheduled if not delayed)
- `runDate`: Date the train is scheduled to run

### Time Format Details

**`toLocaleTimeString("en-GB")`**:
- Always 24-hour format (no AM/PM)
- Zero-padded hours and minutes
- Format: "HH:MM"
- Examples: "00:05", "09:30", "18:45", "23:59"

**Why "en-GB" locale**:
- Guarantees 24-hour format
- Consistent with UK railway times
- Avoids AM/PM ambiguity
- Matches API response format

**ISO Date format**:
- `toISOString()` returns "YYYY-MM-DDTHH:MM:SS.sssZ"
- `.split("T")[0]` extracts "YYYY-MM-DD"
- Matches `runDate` format from API

### Performance Considerations

**Filter complexity**: O(n) where n = number of journeys
- Typical n: 10-20 journeys
- Execution time: <1ms
- No performance impact

**Executed per refresh**:
- Every 60 seconds
- Only when API call succeeds
- Minimal overhead

## Comparison with Alternatives

### Why Not Client-Side Filtering?

**Option**: Filter in Svelte component using reactive blocks

**Rejected because**:
- Would require passing unfiltered data to frontend
- Increases payload size
- Filtering logic already exists server-side
- No benefit to duplication

### Why Not Time Object Comparison?

**Option**: Parse strings to Date objects, compare numerically

**Code example**:
```typescript
// Alternative approach (not used)
const nowDate = new Date();
const departureDate = new Date(`${journey.runDate}T${journey.departureTime}`);
return departureDate > nowDate;
```

**Rejected because**:
- More complex parsing
- Date object creation overhead
- String comparison is simpler and correct
- Current approach is easier to understand

### Why Not Unix Timestamps?

**Option**: Convert to timestamps for comparison

**Rejected because**:
- API returns strings, not timestamps
- Conversion adds complexity
- String comparison works correctly
- No accuracy benefit

## Edge Cases and Gotchas

### Time Zone Considerations

**Current behavior**:
- Uses `new Date()` in server's timezone
- `toLocaleTimeString()` uses local time
- API response times assumed to be in same timezone

**If server and API have different timezones**:
- Could cause incorrect filtering
- Not currently an issue (both use GMT/BST)
- Would need explicit timezone handling if deployment changes

### Daylight Saving Time

**Clock goes forward (spring)**:
```
Time jumps from 01:00 to 02:00
Trains scheduled 01:05-01:59 don't exist
```

**Behavior**: API should handle this (not frontend concern)

**Clock goes back (fall)**:
```
Time repeats from 02:00 to 01:00
Trains at 01:30 could be ambiguous
```

**Behavior**: `runDate` disambiguates (trains have different run dates)

### Leap Seconds

**Impact**: None.
- JavaScript Date doesn't account for leap seconds
- Railway scheduling doesn't use leap seconds
- Filtering accuracy ±1s is acceptable

### Very Old or Future Trains

**API returns train from yesterday**:
```
departureTime: "18:00"
runDate: "2026-01-26" (yesterday)
todayDate: "2026-01-27"
```

**Behavior**:
- `"18:00" > "18:15"` is false
- `runDate ≠ todayDate` is true
- → ✅ Kept (incorrect, but API shouldn't do this)

**Mitigation**: API should only return trains for today/tomorrow

## Accessibility

### User Expectations

**Visual users**:
- See trains disappear from list
- Understand time progression
- Can check current time vs. departure times

**Screen reader users**:
- List updates happen silently (no announcement)
- No confusion from past trains being shown
- Clear messaging when no trains available

### Error Cases

**When filtering fails** (JavaScript error):
- All trains would be shown (no filter applied)
- User might see past trains
- Error would be logged to console

**Mitigation**: Simple code reduces error risk

## Limitations

1. **No grace period**
   - Trains filter out exactly at departure time
   - User might miss train that's still boarding
   - Could add 2-3 minute grace period

2. **Dependent on accurate clocks**
   - Server time must be correct
   - API times must be accurate
   - Clock drift could cause incorrect filtering

3. **No timezone awareness**
   - Assumes server and API use same timezone
   - Would break if deployed internationally
   - Could use explicit timezone handling

4. **String comparison limits**
   - Only works with "HH:MM" format
   - Would break if format changes
   - Could use more robust parsing

5. **Date boundary issues**
   - Relies on `runDate` being accurate
   - Doesn't validate `runDate` is close to today
   - Could accept trains weeks in the future

## Future Enhancements

Potential improvements (not currently planned):

- **Grace period** (keep trains visible for 2-3 minutes after departure)
- **Explicit timezone handling** (use `Intl.DateTimeFormat` with timezone)
- **Relative time display** ("Departing in 5 minutes")
- **Past trains section** (collapsed, for reference)
- **Time until departure** countdown
- **Smart filtering** (keep delayed trains longer)
- **User preference** (show/hide past trains)
- **Historical view** (what trains ran earlier today)

## Troubleshooting

### Past trains still showing

**Check**:
1. Current server time: `new Date().toLocaleTimeString("en-GB")`
2. Journey `departureTime` values
3. Journey `runDate` values
4. Filter logic executing correctly

**Possible causes**:
- Server clock is wrong
- API returning incorrect times
- Filter logic has bug
- Timezone mismatch

### Future trains not showing

**Check**:
1. API response contains trains
2. Filter not too aggressive
3. `runDate` matches expectation

**Possible causes**:
- API not returning future trains
- Filter logic error
- Date comparison bug

### Trains disappear too early/late

**Check**:
1. Server time vs. actual time
2. Time comparison logic
3. `departureTime` format

**Possible causes**:
- Server clock drift
- Incorrect time format
- String comparison error

### Midnight trains not showing

**Check**:
1. `runDate` for midnight trains
2. Date comparison logic
3. API returning tomorrow's trains

**Possible causes**:
- API not including next-day trains
- Date comparison not handling day boundary
- `runDate` not set correctly

## Testing Scenarios

To verify filtering works correctly:

1. **Normal operation**: Check trains around current time appear/disappear
2. **Midnight crossover**: View at 23:55, verify 00:05 trains show
3. **No trains**: View late night destination, verify message displays
4. **Delayed train**: Verify delayed train uses actual time, not scheduled
5. **Cancelled train**: Verify cancelled future trains still show
6. **Date boundary**: At 00:01, verify yesterday's trains are gone

## Related Documentation

- **CLAUDE.md** - Complete codebase guide (time filtering section)
- **auto-refresh.md** - How data updates trigger filtering
- **departure-display.md** - How filtered data is displayed
- **MDN Date documentation** - JavaScript Date API reference

---

**Feature Status**: ✅ Active (Core Feature)
**Last Updated**: 2026-01-27
**Version**: 1.0
