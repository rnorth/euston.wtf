# Departure Display Feature

## Overview

The departure display feature is the core visualization component of euston.wtf, rendering real-time train departure information in an easy-to-scan format with status indicators, platform information, and service details.

## What It Does

Displays each train journey with:
- **Departure time** (scheduled and actual if delayed)
- **Platform assignment** (confirmed or scheduled)
- **Service status** (on time, delayed, cancelled, platform changed)
- **Service location** (at platform, approaching, preparing to depart)
- **Visual indicators** for quick status recognition

## How It Works

### Data Structure

Each journey contains:

```typescript
interface Journey {
    serviceUid: string;           // Unique identifier
    departureTime: string;        // HH:MM format
    isCancelled: boolean;
    isDelayed: boolean;
    isPlatformChanged: boolean;
    platform: string | null;
    platformConfirmed: boolean;
    scheduledDepartureTime: string | null;
    serviceLocation: string;      // e.g., "AT_PLAT", "APPR_PLAT", "DEP_READY"
    serviceType: string;         // e.g., "train", "bus"
    destination: string;          // TIPLOC code
    destinationDescription: string; // Human-readable name
    runDate: string;             // YYYY-MM-DD
    cancelReasonShortText: string; // Cancel reason
}
```

### Component Architecture

**Main Container**: `src/App.svelte`
- Manages journey list
- Handles pagination (show 5 vs. all)
- Coordinates with data stores

**Individual Journey**: `src/lib/JourneyPane.svelte` (104 lines)
- Renders single train departure
- Three-column grid layout
- Conditional status indicators

### Layout Structure

Each journey uses a **three-column grid**:

```
┌─────────────┬──────────────────┬────────────────────┐
│  Time       │  Platform        │  Status            │
│  (Column 1) │  (Column 2)      │  (Column 3)        │
├─────────────┼──────────────────┼────────────────────┤
│  18:25      │  Platform 11     │  At platform       │
│             │  (Confirmed)     │  🟢                │
└─────────────┴──────────────────┴────────────────────┘
```

### Visual Hierarchy

**Typography**:
- Departure time: First column, prominent
- Platform numbers: Bold if confirmed (font-weight: 800)
- Platform state: Gray, dashed underline, cursor shows tooltip
- Status tags: Small, colored badges
- Strikethrough: Applied to scheduled time when delayed

**Color Coding**:
- **Red** (`.is-danger`): Cancelled journeys, bus replacement services
- **Orange** (`.is-warning`): Delayed trains, platform changed
- **Yellow** (`.is-warning`): Platform uncertain warnings
- **Blue** (`.is-info`): Service location indicators (at platform, approaching, etc.)
- **Gray**: Scheduled platform state labels

## User Experience

### Normal Journey Display

```
18:05

Platform 8
(Confirmed)

At platform
```

**Visual representation**:
- Departure time: 18:05
- Platform **8** in bold (confirmed)
- "(Confirmed)" label with underline
- Blue "At platform" tag

### Cancelled Journey

```
18:25

[CANCELLED]
Cancelled (with reason if available)
```

**Visual treatment**:
- Red background/border (`.is-danger`)
- Red "Cancelled" tag with hover tooltip showing reason
- No platform information shown
- Entire message box has danger styling

### Delayed Journey

```
18:47 ~~18:30~~

Platform 10
(Scheduled)

Delayed
Approaching
```

**Visual treatment**:
- Actual time (18:47) shown first
- Scheduled time (18:30) shown with strikethrough after
- Orange background/border (`.is-warning`)
- Orange "Delayed" tag
- Blue "Approaching" tag for service location

### Platform Changed

```
18:35

Platform 9
(Confirmed)

Platform has changed
At platform
```

**Visual treatment**:
- Orange "Platform has changed" tag
- Platform shown is the NEW platform
- Usually also has service location indicator

### Pagination

**Default view**: First 5 journeys + last journey

```
Journey 1
Journey 2
Journey 3
Journey 4
Journey 5
...  [Show all departures button]
Journey N (last train, faded styling)
```

**Expanded view**: All journeys

```
Journey 1
Journey 2
...
Journey N (last train, faded styling)
```

**Last Train Styling**:
- Lighter background (`rgb(250 250 250)`)
- Serves as visual anchor
- Always visible even when collapsed

## Technical Implementation

### Component: JourneyPane.svelte

**Props** (Svelte 5 syntax):
```typescript
let { journey, isLastTrain = false }: Props = $props();
```

**Reactive Validation** (platform uncertainty):
```typescript
let validation = $derived(validatePlatform(journey, $departuresByPlatform));
```

**State Management** (expandable warnings):
```typescript
let showConflictDetails = $state(false);
```

### Conditional Rendering

**Cancelled Status** (JourneyPane.svelte:14-23):
```svelte
{#if journey.isCancelled}
    <div class="message is-danger">
        <div class="message-header">
            <p>CANCELLED</p>
        </div>
        <div class="message-body">
            This service is cancelled.
        </div>
    </div>
{/if}
```

**Platform Display** (JourneyPane.svelte:39-46):
```svelte
{#if !journey.isCancelled}
    {#if journey.isPlatformConfirmed}
        <p class="platform confirmed">Platform {journey.platform}</p>
        <span class="platform-state" title="Platform confirmed - very likely">(Confirmed)</span>
    {:else}
        <p class="platform">Platform {journey.platform}</p>
        <span class="platform-state" title="As scheduled - could change still">(Scheduled)</span>
    {/if}
{/if}
```

**Time Display with Delay** (JourneyPane.svelte:28-34):
```svelte
{#if journey.isDelayed}
    <span>{journey.departureTime}</span>
    <span class="strikethrough">{journey.scheduledDepartureTime}</span>
{:else}
    {journey.departureTime}
{/if}
```

### Status Indicators

**Service Location** (JourneyPane.svelte:70-81):
```svelte
{#if journey.serviceLocation.startsWith("APPR")}
    <span class="tag is-info">Approaching</span>
{:else if journey.serviceLocation === "DEP_PREP"}
    <span class="tag is-info">At platform</span>
    <span class="tag is-info">Preparing to depart</span>
{:else if journey.serviceLocation === "DEP_READY"}
    <span class="tag is-info">At platform</span>
    <span class="tag is-info">Ready to depart</span>
{:else if journey.serviceLocation === "AT_PLAT"}
    <span class="tag is-info">At platform</span>
{/if}
```

**Delay Tag** (JourneyPane.svelte:62-64):
```svelte
{#if journey.isDelayed}
    <span class="tag is-warning">Delayed</span>
{/if}
```

**Platform Changed Tag** (JourneyPane.svelte:54-56):
```svelte
{#if journey.isPlatformChanged}
    <span class="tag is-warning">Platform has changed</span>
{/if}
```

**Service Type** (JourneyPane.svelte:66-68):
```svelte
{#if journey.serviceType !== "train"}
    <span class="tag is-danger">{titlecase(journey.serviceType)}</span>
{/if}
```

### Styling

**Scoped CSS** (JourneyPane.svelte:109-150):
```css
.message-body {
    display: grid;
    grid-template-columns: 1fr 3fr 2fr;
    gap: 0.5rem;
    padding: 0.5rem;
    margin: 0.5rem 0;
}

.platform.confirmed {
    font-weight: 800;
}

.platform-state[title] {
    text-decoration-style: dashed;
    text-decoration-line: underline;
    color: gray;
}

.strikethrough {
    text-decoration: line-through;
}
```

**Bulma Classes Used**:
- `.message`, `.message-body` - Container styling
- `.is-danger` - Cancelled state (red)
- `.is-warning` - Delayed/platform changed state (orange)
- `.is-info` - Service location tags (blue)
- `.tag` - Status badges

### List Management in App.svelte

**Journey Filtering** (App.svelte:130-162):
```svelte
{#if $departures && $departures.journeys.length > 0}
    <section class="section">
        {#each $departures.journeys.slice(0, hideLaterJourneys ? 5 : $departures.journeys.length - 1) as journey (journey.serviceUid)}
            <div transition:slide={{ duration: 500 }}>
                <JourneyPane {journey} />
            </div>
        {/each}

        {#if hideLaterJourneys && $departures.journeys.length > 6}
            <div class="ellipsis">
                <button
                    class="button is-text"
                    on:click={() => (hideLaterJourneys = false)}
                >
                    ... (Show all departures)
                </button>
            </div>
        {/if}

        <!-- Always show last train -->
        {#if $departures.journeys.length > 0}
            <div transition:slide={{ duration: 500 }}>
                <JourneyPane
                    journey={$departures.journeys[$departures.journeys.length - 1]}
                    isLastTrain={true}
                />
            </div>
        {/if}
    </section>
{/if}
```

**Key Logic**:
- Slice first 5 when collapsed
- Show "..." button if >6 journeys
- Always display last journey with special styling
- Use `serviceUid` as key for list items
- 500ms slide transition on removal

## Performance

### Rendering Optimization

- **Keyed each blocks**: Prevents unnecessary re-renders
  ```svelte
  {#each journeys as journey (journey.serviceUid)}
  ```

- **Conditional rendering**: Only render what's visible
  ```svelte
  {#if hideLaterJourneys}
  ```

- **Scoped styles**: CSS is component-specific, tree-shaken

### Data Efficiency

- **Minimal props**: Only pass `journey` and `isLastTrain` flag
- **Derived state**: Validation computed reactively, not stored
- **Store subscriptions**: Automatic cleanup via Svelte

### Animation Performance

- **Slide transitions**: Hardware-accelerated
- **500ms duration**: Smooth but not sluggish
- **No layout thrashing**: Grid stays stable

## Accessibility

### Semantic HTML

```html
<div class="journey" role="article">
    <div class="platform">
        <strong>Platform 8</strong>
    </div>
    <div class="times">
        <time>18:05</time> → <time>20:30</time>
    </div>
    <div class="status">
        <span class="tag">At platform</span>
    </div>
</div>
```

### Screen Reader Support

- **Strikethrough times**: `<s>` tags properly announced
- **Status tags**: Text content is semantic
- **Cancelled messages**: Wrapped in `.message` with proper heading
- **Platform confirmations**: `<strong>` for confirmed platforms

### Keyboard Navigation

- Expandable elements (platform warnings) support:
  - Tab to focus
  - Enter/Space to toggle
  - ARIA roles applied

### Visual Contrast

- Red cancelled banner: High contrast
- Status tags: Bulma's accessible color palette
- Text sizes: Readable at default zoom

## Edge Cases

### No Departures

```svelte
{:else if $departures && $departures.journeys.length === 0}
    <section class="section">
        <div class="message is-info">
            <div class="message-body has-text-centered">
                <strong>No upcoming departures</strong>
                <br />
                There are no trains to this destination in the next few hours.
            </div>
        </div>
    </section>
{/if}
```

### Missing Data Fields

| Field Missing | Behavior |
|---------------|----------|
| `platform` is `null` | Platform section not displayed |
| `serviceLocation` doesn't match known codes | No location tag rendered |
| `scheduledDepartureTime` is `null` | Shows only departure time (no strikethrough) |
| `destinationDescription` is `null` | Falls back to TIPLOC code (in platform warnings) |
| `cancelReasonShortText` is empty | Cancelled tag shows without tooltip |

### Extreme Data

| Scenario | Handling |
|----------|----------|
| 50+ journeys | Paginated (show 5 + last) |
| Long station names | Text wraps within grid cell |
| Very short list (<5) | No pagination button shown |
| Single journey | Works fine, last train styling applied |

## Limitations

1. **Fixed grid layout**
   - May not be optimal on very narrow screens
   - Could use responsive breakpoints

2. **No real-time updates within minute**
   - Times update only on 60s refresh cycle
   - Live countdown not implemented

3. **No sorting/filtering**
   - Always chronological order
   - Can't filter by platform or status

4. **No detailed service information**
   - Calling points not shown
   - Operator info not displayed
   - Coach formation not available

5. **No accessibility audit**
   - Would benefit from formal WCAG review
   - Color contrast could be verified

## Future Enhancements

Potential improvements (not currently planned):

- **Live countdown timers** (e.g., "Departing in 5 mins")
- **Calling points expansion** (click to see stops)
- **Operator badges** (Avanti, LNER, etc.)
- **Coach formation diagrams**
- **Platform map integration**
- **Favorite journeys** (pin specific times)
- **Comparative view** (today vs. usual)
- **Mobile-optimized layout** (vertical cards)
- **Dark mode** styling
- **Print stylesheet** for paper tickets

## Troubleshooting

### Journeys not displaying

**Check**:
1. Console for errors in `$departures` store
2. API response contains `journeys` array
3. No JavaScript errors in JourneyPane.svelte

### Status indicators not showing

**Check**:
1. API returns boolean flags (`isCancelled`, etc.)
2. CSS is loading (Bulma CDN)
3. Tags are not being stripped by ad blockers

### Last train styling incorrect

**Check**:
1. `isLastTrain` prop is being passed
2. CSS class `.is-last-train` is applied
3. Array indexing is correct

### "Show all" button not appearing

**Possible causes**:
- Fewer than 6 journeys total
- `hideLaterJourneys` state not initialized
- Conditional logic error

### Times show as "undefined"

**Possible causes**:
- API response missing `departureTime` or `arrivalTime`
- Type mismatch (expecting string, got null)
- Check API response structure

## Related Documentation

- **CLAUDE.md** - Complete codebase guide (display section)
- **platform-validation.md** - Platform uncertainty warnings
- **auto-refresh.md** - Data refresh mechanism
- **Bulma Documentation** - CSS framework reference

---

**Feature Status**: ✅ Active (Core Feature)
**Last Updated**: 2026-01-27
**Version**: 1.0
