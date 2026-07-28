# Departure Display Feature

## Overview

The departure display feature is the core visualization component of euston.wtf, rendering real-time train departure information in an easy-to-scan format with status indicators, platform information, and service details.

## What It Does

Displays each train journey with:
- **Departure time** (scheduled and actual if delayed)
- **Platform assignment** (confirmed or scheduled)
- **Service status** (on time, delayed, overdue, cancelled, platform changed)
- **Service location** (at platform, approaching, preparing to depart)
- **Visual indicators** for quick status recognition

## How It Works

### Which Trains Are Shown

The API decides what has left, not the browser clock. Each journey carries two flags:

- **`isDeparted`** - the origin reported an actual departure. The train has definitely gone.
- **`isOverdue`** - the expected departure time has passed with no such report. The train may
  still be sitting at the platform; Realtime Trains simply doesn't know yet.

The client drops only `isDeparted` journeys (`departures.ts`). Overdue trains stay on the board
with a "Departure delayed" label until the API retires them after its grace period — a train that
is late leaving is exactly when you most want to see it.

### Data Structure

The fields this component reads (see `src/lib/departures.ts` for the full interface — every
field is a non-nullable `string`, `number` or `boolean`):

```typescript
interface Journey {
    serviceUid: string;             // Unique identifier, used as the each-block key
    departureTime: string;          // HH:MM, expected
    scheduledDepartureTime: string; // HH:MM, as timetabled
    isCancelled: boolean;
    isDelayed: boolean;
    isDeparted: boolean;            // actual departure reported - definitely left
    isOverdue: boolean;             // past its time with no report - may still be here
    isPlatformChanged: boolean;
    isPlatformConfirmed: boolean;
    platform: string;
    serviceLocation: string;        // e.g., "AT_PLAT", "APPR_PLAT", "DEP_READY"
    serviceType: string;            // e.g., "train", "bus"
    destination: string;            // TIPLOC code
    destinationDescription: string; // Human-readable name
    cancelReasonShortText: string;  // Cancel reason, may be empty
}
```

### Component Architecture

**Main Container**: `src/App.svelte`
- Manages journey list
- Handles pagination (show 5 vs. all)
- Coordinates with data stores

**Individual Journey**: `src/lib/JourneyPane.svelte` (167 lines)
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
- Muted (60% opacity): Applied to the departure time when overdue — a struck-through time
  reads as "gone", which is the opposite of what overdue means

**Color Coding**:
- **Red** (`.is-danger`): Cancelled journeys, bus replacement services
- **Orange** (`.is-warning`): Delayed trains, overdue trains, platform changed
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
- Red background/border (`.is-danger`) on the whole row
- Red "Cancelled" tag with hover tooltip showing the reason, when the API supplies one
- No platform information shown — the platform column is suppressed entirely

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

### Overdue Journey

```
18:30 (dimmed)

Platform 12
(Confirmed)

Departure delayed
At platform
```

**Visual treatment**:
- Departure time dimmed rather than struck through
- Orange background/border (`.is-warning`)
- Orange "Departure delayed" tag, with a tooltip explaining there has been no report from the
  train and the departure boards are worth checking
- Replaces the "Delayed" tag rather than appearing alongside it
- A cancelled train is also flagged overdue by the API once its time passes; "Cancelled" wins,
  and no overdue tag is shown

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

**Default view**: first 5 journeys + the last one, shown when there are more than 5 in total

```
Journey 1
Journey 2
Journey 3
Journey 4
Journey 5
[ ... ]              ← button, tooltip "Show more"
Journey N (tagged "Last train!")
```

**Expanded view**: all journeys, with the final one still rendered separately

```
Journey 1
Journey 2
...
Journey N (tagged "Last train!")
```

**Last Train Treatment**:
- The `isLastTrain` prop adds a blue "Last train!" tag — there is no distinct background or
  faded styling
- Always visible even when collapsed, so you can see the last train without expanding
- An overdue last train keeps the tag until the API retires it, which is correct: it hasn't left

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

**Row Styling** — one function drives the whole row's colour:
```typescript
function rowClass() {
    if (journey.isCancelled) return "is-danger";
    if (isOverdue || journey.isDelayed) return "is-warning";
    return "";
}
```

**Cancelled Status** — a tag, not a banner; the row colour carries the weight:
```svelte
{#if journey.isCancelled}
    <span class="tag is-danger" title="{journey.cancelReasonShortText}">Cancelled</span>
{/if}
```

**Platform Display**:
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

**Time Display** (JourneyPane.svelte) — overdue supersedes delayed, since once the expected
time is void there is nothing useful to show alongside it:
```svelte
{#if isOverdue}
    <span class="muted">{journey.departureTime}</span>
{:else if journey.isDelayed}
    <span>{journey.departureTime}</span>
    <span class="strikethrough">{journey.scheduledDepartureTime}</span>
{:else}
    {journey.departureTime}
{/if}
```

### Status Indicators

**Service Location**:
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

**Delay Tags** (JourneyPane.svelte) — the `{:else if}` keeps a single amber tag on the row:
```svelte
{#if isOverdue}
    <span class="tag is-warning" title="...">Departure delayed</span>
{:else if journey.isDelayed}
    <span class="tag is-warning">Delayed</span>
{/if}
```

`isOverdue` is derived, not read straight from the journey:
```typescript
let isOverdue = $derived(journey.isOverdue && !journey.isCancelled);
```

**Platform Changed Tag**:
```svelte
{#if journey.isPlatformChanged}
    <span class="tag is-warning">Platform has changed</span>
{/if}
```

**Service Type**:
```svelte
{#if journey.serviceType !== "train"}
    <span class="tag is-danger">{titlecase(journey.serviceType)}</span>
{/if}
```

### Styling

**Scoped CSS**:
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

.muted {
    opacity: 0.6;
}
```

**Bulma Classes Used**:
- `.message`, `.message-body` - Container styling
- `.is-danger` - Cancelled state (red)
- `.is-warning` - Delayed/platform changed state (orange)
- `.is-info` - Service location tags (blue)
- `.tag` - Status badges

### List Management in App.svelte

**Journey List** — two branches rather than one parameterised slice:
```svelte
{#if $departures.journeys.length > 5 && hideLaterJourneys}
    {#each $departures.journeys.slice(0, 5) as journey (journey.serviceUid)}
        <div out:slide={{duration: 500}}>
            <JourneyPane {journey} />
        </div>
    {/each}
    <div class="has-text-centered">
        <button class="button is-centered ellipsis" title="Show more"
                on:click={() => hideLaterJourneys=false}>...
        </button>
    </div>
    <JourneyPane
            journey={$departures.journeys[$departures.journeys.length - 1]}
            isLastTrain={true}
    />
{:else}
    {#each $departures.journeys.slice(0, -1) as journey (journey.serviceUid)}
        <div out:slide={{duration: 500}}>
            <JourneyPane {journey} />
        </div>
    {/each}
    <JourneyPane
            journey={$departures.journeys[$departures.journeys.length - 1]}
            isLastTrain={true}
    />
{/if}
```

**Key Logic**:
- Collapse only when there are more than 5 journeys
- The last journey is always rendered separately with `isLastTrain`, in both branches — with
  exactly 6 journeys the collapsed view therefore shows 5 + the 6th, and the "..." button
  expands to reveal nothing new
- `serviceUid` keys the each block
- `out:slide` only — journeys animate away when they leave, but appear instantly

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

- **Slide transitions**: animate `height`, so they do force layout — fine at this list size
- **500ms duration**: smooth but not sluggish
- **Outro only**: nothing animates in, so a refresh doesn't visibly churn the list

## Accessibility

### Semantic HTML

Each journey is a Bulma `<article class="message">` containing a three-column grid of plain
`<div>`s. There is no finer-grained semantic markup — no `<time>` elements, no ARIA roles on the
row itself.

```html
<article class="message is-warning">
    <div class="message-body">
        <div><span class="muted">18:30</span></div>
        <div><p class="platform confirmed">Platform 12</p>...</div>
        <div><span class="tag is-warning">Departure delayed</span></div>
    </div>
</article>
```

### Screen Reader Support

- **Status tags**: text content is meaningful when read aloud
- **Strikethrough and muted times**: styled with CSS only, so the *visual* distinction between a
  superseded time and a live one is not announced at all. A known gap
- **Platform state**: conveyed by font weight plus a "(Confirmed)"/"(Scheduled)" text label, so
  the label carries the meaning even when weight isn't perceivable
- **Tooltips**: `title` attributes are inconsistently surfaced by screen readers; the cancel
  reason and the overdue explanation are effectively sighted-only

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
        <article class="message is-info">
            <div class="message-header">
                <p>No departures found today</p>
                <button class="delete" aria-label="delete"></button>
            </div>
            <div class="message-body">
                No departures to {selectedDestination?.station} ({selectedDestination?.code}) could be found
                today.
                Consult official sources for travel information.
            </div>
        </article>
    </section>
{/if}
```

The header carries a Bulma `delete` button that is decorative — nothing is wired to it.

### Missing Data Fields

| Field Missing | Behavior |
|---------------|----------|
| `platform` is empty | Renders "Platform" with nothing after it — not guarded against |
| `serviceLocation` doesn't match known codes | No location tag rendered |
| `scheduledDepartureTime` is empty | Only reached when `isDelayed`, so shows a blank strikethrough |
| `destinationDescription` is empty | Falls back to the TIPLOC code (in platform warnings) |
| `cancelReasonShortText` is empty | Cancelled tag shows with an empty tooltip |
| `departuresByPlatform` missing entirely | Platform validation degrades to confident, no warnings |

### Extreme Data

| Scenario | Handling |
|----------|----------|
| 50+ journeys | Paginated (show 5 + last) |
| Long station names | Text wraps within grid cell |
| Very short list (≤5) | No pagination button shown |
| Single journey | Rendered once, as the last train |

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

### "Last train!" tag missing or on the wrong row

**Check**:
1. `isLastTrain` prop is being passed on the final `JourneyPane`
2. Array indexing is correct (`journeys.length - 1`)

### "..." button not appearing

**Possible causes**:
- 5 or fewer journeys total
- `hideLaterJourneys` was left `false` after a previous expansion (it resets on station change)

### Times show as "undefined"

**Possible causes**:
- API response missing `departureTime` or `arrivalTime`
- Type mismatch (expecting string, got null)
- Check API response structure

## Related Documentation

- **CLAUDE.md** - Complete codebase guide (display section)
- **platform-validation.md** - Platform uncertainty warnings (also filters on `isDeparted`)
- **auto-refresh.md** - Data refresh mechanism
- **Bulma Documentation** - CSS framework reference

---

**Feature Status**: ✅ Active (Core Feature)
**Last Updated**: 2026-07-28
**Version**: 1.0
