# CLAUDE.md - AI Assistant Guide for euston.wtf

This document provides comprehensive guidance for AI assistants working with the euston.wtf codebase. Last updated: 2025-12-31

## Project Overview

**euston.wtf** is a lightweight single-page web application that displays real-time train departure information from London Euston Station to various UK destinations. The app provides:

- Real-time departure data via the Realtime Trains API
- Auto-refreshing departure boards (60-second intervals)
- Intelligent pause/resume when browser tab is hidden
- URL-based routing for bookmarkable destination pages
- Visual indicators for delays, cancellations, and platform changes

**Key Facts:**
- **Language**: TypeScript
- **Framework**: Svelte 5.1.3
- **Build Tool**: Vite 5.4.10
- **CSS Framework**: Bulma 1.0.2 (via CDN)
- **Module Type**: ES Module
- **Target Origin Station**: EUS (London Euston)
- **API Endpoint**: `https://api.euston.wtf/journeys/EUS/{destination}`

## Architecture

### Directory Structure

```
/home/user/euston.wtf/
├── src/
│   ├── App.svelte              # Main application component
│   ├── main.ts                 # Application entry point
│   ├── app.css                 # Global styles
│   ├── vite-env.d.ts           # Vite type definitions
│   └── lib/
│       ├── departures.ts       # Data fetching, types, display helpers
│       ├── history.ts          # Historical punctuality per service
│       ├── stations.ts         # Static station data
│       ├── JourneyPane.svelte  # Single journey display component
│       ├── Title.svelte        # Animated header component
│       └── simple-svelte-autocomplete.d.ts  # Type definitions
├── public/                     # Static assets (favicons, manifest)
├── index.html                  # HTML entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
├── svelte.config.js
└── .vscode/
    └── extensions.json
```

### Component Hierarchy

```
App.svelte (main container)
├── Title.svelte (animated header)
├── AutoComplete (station selection dropdown)
├── Error Message (conditional)
└── Departures Section (conditional)
    ├── JourneyPane.svelte (× N journeys)
    └── JourneyPane.svelte (last journey, special styling)
```

### Data Flow

1. **User Selection** → Station selected via AutoComplete
2. **URL Update** → `window.history.pushState()` updates URL to `/{stationCode}`
3. **API Fetch** → `fetchDepartures()` called with destination code
4. **Store Update** → Svelte stores (`departures`, `lastError`) updated
5. **Reactive Render** → Components re-render based on store changes
6. **Auto-Refresh** → 60-second timer triggers new fetch (if tab visible)

## Key Technologies

### Svelte 5.1.3
- **Signals-based reactivity** (Svelte 5's new approach)
- **Reactive declarations** using `$:` syntax
- **Component lifecycle** with `onMount()`, transitions with `slide`
- **Stores** for shared state (`writable` from `svelte/store`)

### TypeScript
- **Strict mode enabled** in tsconfig.json
- **All interfaces defined** for API responses and data structures
- **Type-safe component props** and function signatures
- **No implicit any** allowed

### Vite
- **Fast HMR** (Hot Module Replacement)
- **ESM-based** build system
- **Svelte plugin integration** via `@sveltejs/vite-plugin-svelte`
- **Production builds** with tree-shaking and minification

### Bulma CSS
- Loaded via CDN (v1.0.2) in index.html
- Used for layout (`.container`, `.section`)
- Status messages (`.message`, `.is-danger`, `.is-info`)
- Visual indicators (`.tag`, `.button`)

## Development Workflow

### Available Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Build for production (outputs to dist/)
npm run preview  # Preview production build locally
npm run check    # Type check with svelte-check and tsc
```

### Making Changes

1. **Before editing any file**: Always read it first using the Read tool
2. **Type safety**: Run `npm run check` before committing
3. **Testing changes**: Use `npm run dev` and test in browser
4. **Build verification**: Run `npm run build` to ensure no build errors

### Git Workflow

- **Commit messages**: Use descriptive messages following existing patterns
  - Example: "Fix display when fewer than five trains"
  - Example: "Show service location"
  - Focus on what changed and why

## Code Conventions

### TypeScript Patterns

**Interface Definitions**
```typescript
// Always define interfaces for data structures
export interface Journey {
    arrivalTime: string;
    departureTime: string;
    isCancelled: boolean;
    // ... all fields explicitly typed
}
```

**Type Safety**
- Use explicit type annotations on function parameters and returns
- Avoid `any` types
- Use type assertions sparingly (e.g., `document.getElementById('app')!`)

### Svelte Patterns

**Reactive Declarations**
```typescript
// Reactive blocks execute when dependencies change
$: {
    if (selectedDestination !== null && now > nextRefresh && isVisible) {
        doRefresh();
    }
}

// Multiple reactive blocks for separation of concerns
$: {
    if (selectedDestination !== null) {
        document.title = `Departures to ${selectedDestination?.station}`;
    }
}
```

**Store Usage**
```typescript
// Create writable stores in service modules
export const departures = writable<Departures | null>(null);

// Subscribe in components with $ prefix
{#if $departures && $departures.journeys.length > 0}
```

**Component Props**
```typescript
// Use destructuring for props in Svelte 5
let { journey, isLastTrain = false }: { journey: Journey, isLastTrain?: boolean } = $props();
```

### Lifecycle & Events

**onMount for initialization**
```typescript
onMount(() => {
    // URL parsing on load
    reactToUrlChange();

    // Event listeners
    window.addEventListener("popstate", reactToUrlChange);
    document.addEventListener("visibilitychange", handleVisibility);

    // Timers
    setInterval(() => { now = new Date().getTime(); }, 1000);
});
```

**Event Handlers**
```typescript
// Use on:event directive
<button on:click={() => hideLaterJourneys = false}>...</button>
```

### CSS Patterns

**Scoped Styles**
```svelte
<style>
    /* Styles are scoped to component by default */
    .ellipsis {
        list-style-type: none;
        text-align: center;
    }
</style>
```

**Bulma Classes**
- Use semantic Bulma classes: `.section`, `.container`, `.message`
- Status indicators: `.is-danger`, `.is-warning`, `.is-info`
- Typography: `.has-text-centered`, `<strong>`, `<code>`

### Conditional Rendering

**Svelte's if/else blocks**
```svelte
{#if $lastError}
    <div class="message is-danger">...</div>
{/if}

{#if $departures && $departures.journeys.length > 0}
    <!-- Display journeys -->
{:else if $departures && $departures.journeys.length === 0}
    <!-- No departures message -->
{/if}
```

**Keyed each blocks**
```svelte
{#each $departures.journeys as journey (journey.serviceUid)}
    <JourneyPane {journey} />
{/each}
```

## Important Implementation Details

### URL Routing

The app uses **custom client-side routing** (not a framework):

1. **Path-based**: `/{stationCode}` (e.g., `/MAN` for Manchester)
2. **Hash fallback**: `#{stationCode}` (legacy support)
3. **Browser history**: Uses `pushState()` to avoid page reloads
4. **Navigation**: Listens to `popstate` events for back/forward

**Key Code**: App.svelte:19-37, 84

### Auto-Refresh Logic

```typescript
// 60-second refresh cycle
nextRefresh = now + 60000;

// Smart pause when tab hidden
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        isVisible = false;
    } else {
        isVisible = true;
        nextRefresh = 0; // Force immediate refresh on return
    }
});

// Reactive refresh trigger
$: {
    if (selectedDestination !== null && now > nextRefresh && isVisible) {
        doRefresh();
    }
}
```

**Key Files**: App.svelte:14-15, 49-62, 71-75

### Departure Filtering

The frontend does **not** filter on the clock. It drops only what the API says has actually
gone:

```typescript
// Overdue trains stay listed; only the API knows what has actually left.
data.journeys = data.journeys.filter((journey: Journey) => !journey.isDeparted);
```

A train past its time with no departure report may still be sitting at the platform, so
removing it by comparing against the clock hid trains that were still catchable. The API
owns that judgement: it reports `isDeparted` for a confirmed departure and `isOverdue` for
a time that has passed with no report, and drops a service entirely once a grace period
expires. The window it returns runs from an hour ago to 03:00 the next morning, so
post-midnight services are included.

**Key File**: departures.ts (`fetchDepartures`)

### Journey Display Logic

- **First 5 journeys** shown by default
- **"..." button** to expand and show all
- **Pinned rows** stay visible below the "...": the last catchable train, and the final
  departure when that is something else (a replacement bus, or a cancelled service). Without
  the first of these the "Last train" badge would hide in the collapsed middle of the list
- **`isLastTrain`** is not "the final row" - it is the row `lastCatchableTrainUid` picks
- **Slide transitions** on removal (500ms duration)

**Key File**: App.svelte (the `{#if ...journeys.length > 5 && hideLaterJourneys}` block)

## Common Tasks for AI Assistants

### Adding a New Station

1. **Read**: `src/lib/stations.ts`
2. **Edit**: Add new station to `stations` array with correct format:
   ```typescript
   { station: "Station Name", code: "STC" }
   ```
3. **Sort**: Keep alphabetically sorted by station name
4. **Verify**: Ensure station code is valid for Euston routes

### Modifying Journey Display

1. **Read**: `src/lib/JourneyPane.svelte`
2. **Edit**: Update display logic, CSS, or conditional rendering
3. **Consider**: Status indicators (cancelled, delayed, platform changed)
4. **Test**: Check with various journey states (normal, cancelled, delayed)

### Changing API Endpoints

1. **Read**: `src/lib/departures.ts:66-112`
2. **Edit**: Update fetch URL or headers
3. **Type check**: Ensure response matches `Departures` interface
4. **Error handling**: Update error messages in catch block

### Styling Changes

1. **For component-specific styles**: Edit `<style>` block in `.svelte` file
2. **For global styles**: Edit `src/app.css`
3. **For Bulma overrides**: Use scoped styles or update Bulma CDN version
4. **Test responsiveness**: Check on mobile and desktop

### Adding New Features

1. **Plan first**: Consider where feature fits in component hierarchy
2. **Type definitions**: Define TypeScript interfaces for new data
3. **State management**: Use Svelte stores for shared state
4. **Reactive updates**: Use `$:` blocks for derived state
5. **Test**: Verify with `npm run check` and `npm run build`

## Critical Gotchas

### HMR State Preservation

**Problem**: Svelte HMR doesn't preserve component state by default.

**Solution**: Use external stores for critical state that must persist across HMR updates.

**Reference**: README.md:36-47

### Svelte 5 Syntax

**This is Svelte 5**, which uses:
- `$props()` instead of `export let` for props
- Signals-based reactivity
- Different lifecycle patterns

**Example**:
```typescript
// Svelte 5 props syntax
let { journey, isLastTrain = false }: Props = $props();
```

### TypeScript Strict Mode

All code must:
- Have explicit types (no implicit `any`)
- Handle null/undefined cases
- Use proper type guards

**Bad**:
```typescript
function foo(x) { return x.bar; } // ❌ Implicit any
```

**Good**:
```typescript
function foo(x: MyType): string { return x.bar; } // ✅ Explicit types
```

### Time Comparison Edge Cases

HH:MM **string comparison** no longer decides what is displayed - see Departure Filtering -
but it still survives in `validatePlatform`, which compares departure times to find the next
service off the same platform:
- Works because the format is always "HH:MM" (24-hour)
- Does **not** handle midnight crossover: "00:09" sorts before "23:58", so a comparison
  across midnight inverts. `validatePlatform` gets away with it because it only looks for a
  conflict within 10 minutes, and a wrong answer there costs a platform warning, not a
  missed train
- Anything new that reasons about time across midnight needs `runDate` too, or the ISO
  datetimes the API already carries

**Key File**: departures.ts (`validatePlatform`, `parseTime`)

### API Error Handling

Always wrap fetch calls in try-catch:
- Network errors set `lastError` store
- User sees friendly error message
- Console logs preserve debugging info

**Key File**: departures.ts:104-110

## Testing Considerations

### Manual Testing Checklist

When making changes, verify:

- [ ] Station selection works via autocomplete
- [ ] URL updates correctly when station selected
- [ ] Browser back/forward buttons work
- [ ] Auto-refresh triggers every 60 seconds
- [ ] Refresh pauses when tab hidden
- [ ] Refresh resumes when tab visible
- [ ] Past trains are filtered out
- [ ] Error messages display for API failures
- [ ] Status indicators show correctly (cancelled, delayed, platform changed)
- [ ] Last train styling is distinct
- [ ] "..." expand button works (if >5 journeys)
- [ ] Transitions are smooth (500ms slide)

### Type Checking

```bash
npm run check  # Runs svelte-check AND tsc
```

This validates:
- TypeScript types in `.ts` files
- TypeScript blocks in `.svelte` files
- Svelte component syntax

### Build Verification

```bash
npm run build  # Must complete without errors
```

Checks:
- No TypeScript errors
- No Vite build errors
- Sitemap generation succeeds

## External Dependencies

### Realtime Trains API

**Endpoint**: `https://api.euston.wtf/journeys/EUS/{destination}`

**Response Format**: See departures.ts:1-29 for example

**Key Fields**:
- `journeys`: Array of journey objects
- `serviceUid`: Unique identifier (used as key in loops)
- `isCancelled`, `isDelayed`, `isPlatformChanged`: Boolean flags
- `serviceLocation`: String describing train's current location

### simple-svelte-autocomplete

**Usage**: `src/App.svelte:102-107`

**Props**:
- `items`: Array of objects to search
- `labelFunction`: How to display each item
- `bind:selectedItem`: Two-way binding for selection
- `placeholder`: Input placeholder text

**Type Definitions**: `src/lib/simple-svelte-autocomplete.d.ts`

## File-by-File Reference

### src/App.svelte
**Purpose**: Main application component

**Key Responsibilities**:
- Station selection handling
- URL routing (path and hash-based)
- Auto-refresh orchestration
- Visibility API integration
- Journey list rendering with pagination

**Important State**:
- `selectedDestination: Station | null` - Currently selected station
- `nextRefresh: number` - Timestamp for next auto-refresh
- `now: number` - Current time (updated every second)
- `isVisible: boolean` - Tab visibility state
- `hideLaterJourneys: boolean` - Pagination toggle

**Key Functions**:
- `reactToUrlChange()` - Parse URL and set selected station
- `doRefresh()` - Trigger API fetch and set next refresh time

### src/lib/departures.ts
**Purpose**: Data fetching and type definitions

**Exports**:
- `interface Journey` - Single train journey data
- `interface Departures` - API response structure
- `interface PlatformValidation` - Result of a platform confidence check
- `departures`, `departuresByPlatform`, `lastError` writable stores
- `fetchDepartures(destination: string)` - Async fetch function
- `validatePlatform(journey, departuresByPlatform)` - Flags an unconfirmed platform that
  another service is due to use within 10 minutes
- `lastCatchableTrainUid(journeys)` - The row that earns the "Last train" badge: the last
  one that is a train and is not cancelled
- `pinnedRows(journeys, lastTrainUid, shownCount)` - Which rows stay visible below the
  "..." when the list is collapsed

**Key Logic**:
- Fetches `/journeys/EUS/{destination}` and `/departures/EUS` from `api.euston.wtf` in
  parallel - the second supplies the per-platform data `validatePlatform` needs
- Drops only services the API reports as departed
- Sets stores on success/failure
- Console logs for debugging

### src/lib/stations.ts
**Purpose**: Static station data

**Exports**:
- `interface Station` - Station object shape
- `stations: Station[]` - Array of 59 UK stations

**Note**: All stations are destinations reachable from London Euston

### src/lib/JourneyPane.svelte
**Purpose**: Display single train journey

**Props**:
- `journey: Journey` - Journey data to display
- `isLastTrain: boolean = false` - Whether this is the last train that can still be caught,
  which is not necessarily the last row - see `lastCatchableTrainUid`

**Display Logic**:
- 3-column grid: [Platform] [Times] [Status]
- Bold platform if confirmed, normal if scheduled
- Service location indicator (at platform, approaching, departing)
- Cancelled status (red banner, strikethrough times)
- Delayed status (blue tag, strikethrough scheduled time)
- Platform changed status (orange tag)

**Styling**: Uses Bulma classes extensively

### src/lib/Title.svelte
**Purpose**: Animated header

**Features**:
- Gradient text animation (10-second loop)
- Responsive font sizing (8vw / 48pt)
- CSS keyframes for smooth color transitions

**Styling**: Scoped CSS with `@keyframes gradient`

### src/main.ts (Entry point)
**Purpose**: Mount Svelte app to DOM

**Key Code**:
```typescript
import App from './App.svelte'
const app = new App({ target: document.getElementById('app')! })
export default app
```

### vite.config.ts
**Purpose**: Vite build configuration

**Plugins**:
- `@sveltejs/vite-plugin-svelte` - Svelte integration
- `vite-plugin-sitemap` - Generate sitemap.xml for SEO

**Configuration**:
```typescript
sitemap({
    hostname: 'https://euston.wtf',
})
```

### tsconfig.json
**Purpose**: TypeScript compiler configuration

**Key Settings**:
- `target: "ESNext"` - Latest ECMAScript features
- `module: "ESNext"` - ES modules
- `strict: true` - Strict type checking
- `resolveJsonModule: true` - Allow JSON imports
- Extends `@tsconfig/svelte`

## Best Practices for AI Assistants

### 1. Always Read Before Editing
Never propose changes to files you haven't read. Always use the Read tool first.

### 2. Respect Existing Patterns
- Follow Svelte 5 syntax (not Svelte 4 or earlier)
- Use reactive declarations (`$:`) for derived state
- Keep stores in service modules, not components
- Use Bulma classes for styling consistency

### 3. Type Safety First
- Define interfaces for all new data structures
- Use explicit type annotations
- Run `npm run check` before committing
- Never use `any` types

### 4. Minimize Scope of Changes
- Don't add features beyond what's requested
- Don't refactor surrounding code unless asked
- Don't add comments/docs unless necessary
- Keep changes focused and surgical

### 5. Test Thoroughly
- Manual testing in browser (npm run dev)
- Type checking (npm run check)
- Build verification (npm run build)
- Consider edge cases (no data, API errors, timezone issues)

### 6. Git Hygiene
- Work on the designated branch: `claude/add-claude-documentation-beMnV`
- Write clear, descriptive commit messages
- Never push to main without permission
- Use `git push -u origin <branch-name>` for pushes

### 7. Error Handling
- Always wrap API calls in try-catch
- Set `lastError` store for user-facing errors
- Console.log for debugging information
- Provide user-friendly error messages

### 8. Performance Considerations
- Minimize re-renders with reactive blocks
- Use keyed `{#each}` blocks for lists
- Consider debouncing frequent updates
- Test with large datasets (many journeys)

## Common Questions

### Q: Why not use SvelteKit?
A: This is a simple SPA; SvelteKit's routing and SSR would be overkill. Vite provides fast builds and HMR without the complexity.

### Q: Why Bulma instead of Tailwind?
A: Project uses Bulma via CDN. Changing CSS frameworks would require significant refactoring and isn't recommended without strong justification.

### Q: Can I add authentication?
A: Current architecture has no backend for auth. Would require significant changes. Consult with user before proposing.

### Q: How do I add a new API endpoint?
A: Create a new service module like `departures.ts` with types, stores, and fetch function. Import in components as needed.

### Q: Can I use Svelte 4 syntax?
A: No. This project uses Svelte 5. Always use `$props()`, signals-based reactivity, and Svelte 5 patterns.

### Q: Why is time comparison done with strings?
A: Only in `validatePlatform` now, where HH:MM string comparison finds the next departure
from the same platform. It does **not** survive midnight - see Time Comparison Edge Cases.
The clock-based display filter that used to rely on it was removed; the API decides what has
departed.

---

## Summary

This codebase is a **simple, focused application** with:
- Clear separation of concerns
- Type-safe TypeScript throughout
- Reactive Svelte 5 patterns
- Minimal dependencies
- Fast Vite builds

When working with this code:
1. **Read files before editing**
2. **Follow existing patterns**
3. **Maintain type safety**
4. **Test thoroughly**
5. **Keep changes minimal and focused**

For questions or clarifications, refer to the code itself - it's well-structured and relatively small (~500 lines total).
