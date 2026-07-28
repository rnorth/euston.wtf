# euston.wtf - Feature Specification

**Version**: 1.0
**Last Updated**: 2026-07-28
**Status**: ✅ Active Production Application

## Project Overview

**euston.wtf** is a lightweight, real-time train departure board web application for London Euston Station. It provides passengers with up-to-date departure information to UK destinations, with intelligent features to help avoid platform confusion and missed trains.

### Purpose

- Display real-time departure information from London Euston to user-selected destinations
- Auto-refresh data every 60 seconds to keep information current
- Show only trains that haven't left yet, including ones running late off the platform
- Warn users about uncertain platform assignments
- Provide a fast, accessible, bookmarkable experience

### Target Users

- Commuters and travelers departing from London Euston
- Users who want quick, focused information without app installation
- Mobile and desktop web users
- Users who value simplicity over feature-rich apps

## Architecture & Technologies

### Core Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | Svelte | 5.1.3 | Reactive UI with signals-based reactivity |
| **Language** | TypeScript | Latest | Type-safe development |
| **Build Tool** | Vite | 5.4.10 | Fast development and optimized builds |
| **CSS Framework** | Bulma | 1.0.2 | Responsive styling (CDN) |
| **Module Type** | ES Module | - | Modern JavaScript modules |

### API Integration

**Base URL**: `https://api.euston.wtf`

**Endpoints**:
1. **Journeys**: `/journeys/EUS/{destination}` - Returns trains to specific destination
2. **Departures**: `/departures/EUS` - Returns all departures grouped by platform

**Characteristics**:
- 55-second cache TTL (edge caching)
- JSON responses
- Parallel fetching for optimal performance
- CORS-enabled

### Project Structure

```
src/
├── App.svelte              # Main application (205 lines)
├── main.ts                 # Entry point
├── app.css                 # Global styles
└── lib/
    ├── departures.ts       # Data fetching & stores (188 lines)
    ├── stations.ts         # Static station data (67 lines, 57 stations)
    ├── JourneyPane.svelte  # Journey display component (167 lines)
    └── Title.svelte        # Animated header (52 lines)
```

**Total codebase**: ~700 lines of application code (excluding configs)

## Core Functionality

### 1. Station Search and Routing

Users can search for and select destinations via an autocomplete interface, with bookmarkable URLs for each destination.

**Key Features**:
- Autocomplete search through 57 UK stations
- Clean URLs (e.g., `euston.wtf/MAN` for Manchester)
- Browser back/forward button support
- No framework-based routing (custom implementation)

**📄 [Detailed Specification →](./station-search-and-routing.md)**

### 2. Departure Display

The core visualization showing train departure information with status indicators and platform details.

**Key Features**:
- Three-column grid layout (Time | Platform | Status)
- Departure times with delay indicators
- Platform assignments (confirmed vs. scheduled)
- Service location indicators (at platform, approaching, etc.)
- Visual status tags (cancelled, delayed, departure delayed, platform changed)
- Overdue trains kept on the board rather than dropped at their departure time
- Pagination (first 5 + last train by default)

**📄 [Detailed Specification →](./departure-display.md)**

### 3. Auto-Refresh

Automatic data updates every 60 seconds with intelligent pause/resume based on tab visibility.

**Key Features**:
- 60-second refresh cycle
- Page Visibility API integration (pauses when tab hidden)
- Immediate refresh on tab return
- Coordinated parallel API calls
- Resource conservation (no requests when hidden)

**📄 [Detailed Specification →](./auto-refresh.md)**

### 4. Platform Validation

Cross-references unconfirmed platform assignments against station-wide departures to identify potentially incorrect platforms.

**Key Features**:
- Process-of-elimination platform validation
- Warning indicators for uncertain platforms
- Expandable conflict details
- 10-minute threshold for conflicts
- Only warns on unconfirmed platforms

**📄 [Detailed Specification →](./platform-validation.md)**

## Data Flow

```
┌──────────────────┐
│   User Action    │
│ (Select Station) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Update URL      │
│  /MAN            │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Parallel API Fetch              │
│  • /journeys/EUS/MAN             │
│  • /departures/EUS               │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Server-Side Processing          │
│  • Flag departed / overdue       │
│  • Parse times                   │
│  • Structure response            │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Update Svelte Stores            │
│  • departures.set(data)          │
│  • departuresByPlatform.set(...) │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Reactive UI Update              │
│  • Re-render JourneyPane         │
│  • Validate platforms            │
│  • Update status tags            │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Schedule Next Refresh           │
│  nextRefresh = now + 60s         │
└──────────────────────────────────┘
```

## Common Technical Elements

### Data Structures

**Station**:
```typescript
interface Station {
    station: string;  // "Manchester Piccadilly"
    code: string;     // "MAN"
}
```

**Journey**:
```typescript
interface Journey {
    serviceUid: string;                // Unique ID
    departureTime: string;             // "HH:MM"
    scheduledDepartureTime: string | null;
    platform: string | null;           // "8"
    platformConfirmed: boolean;
    isPlatformConfirmed: boolean;
    isCancelled: boolean;
    isDelayed: boolean;
    isDeparted: boolean;               // actual departure reported
    isOverdue: boolean;                // past its time, no report yet
    isPlatformChanged: boolean;
    serviceLocation: string;           // "AT_PLAT", "APPR_PLAT", etc.
    serviceType: string;               // "train", "bus"
    destination: string;               // TIPLOC code
    destinationDescription: string;    // Full name
    runDate: string;                   // "YYYY-MM-DD"
    cancelReasonShortText: string;
}
```

### State Management

**Svelte Stores**:
- `departures` - Current journey list for selected destination
- `departuresByPlatform` - All departures grouped by platform (for validation)
- `lastError` - Error messages for user display

**Local State** (App.svelte):
- `selectedDestination` - Currently selected station
- `nextRefresh` - Timestamp for next auto-refresh
- `now` - Current time (updated every second)
- `isVisible` - Tab visibility state
- `hideLaterJourneys` - Pagination toggle

### Reactive Patterns

**Svelte 5 Reactivity**:
```typescript
// Reactive blocks execute when dependencies change
$: {
    if (selectedDestination !== null && now > nextRefresh && isVisible) {
        doRefresh();
    }
}

// Derived state in components
let validation = $derived(validatePlatform(journey, $departuresByPlatform));

// Reactive state
let showConflictDetails = $state(false);
```

## Performance & Optimization

### Frontend Optimization

| Optimization | Implementation | Benefit |
|--------------|----------------|---------|
| **Keyed lists** | `{#each journeys as journey (journey.serviceUid)}` | Minimal re-renders |
| **Scoped styles** | Component-level CSS | Tree-shaking, no conflicts |
| **Lazy evaluation** | Reactive blocks only run when dependencies change | CPU efficiency |
| **Parallel fetching** | `Promise.all([fetch1, fetch2])` | Faster data loading |
| **Static station data** | Hardcoded list, no API call | Instant autocomplete |

### Network Optimization

| Technique | Implementation | Benefit |
|-----------|----------------|---------|
| **Edge caching** | 55s TTL at CDN | Reduced origin load |
| **Visibility-based refresh** | Pause when tab hidden | ~50% fewer requests |
| **Parallel requests** | Both APIs at once | Faster updates |
| **No polling waste** | Requests only on 60s boundary | Predictable load |

### Build Optimization

- **Tree-shaking**: Vite removes unused code
- **Minification**: Production builds minified
- **ES modules**: Modern module format for better optimization
- **CDN for CSS**: Bulma loaded from CDN (no bundle size impact)

## Accessibility

### Standards Compliance

- **Semantic HTML**: Proper use of `<article>`, `<time>`, `<strong>`, etc.
- **Keyboard Navigation**: Tab, Enter, Space supported on interactive elements
- **ARIA Roles**: `role="button"` on expandable elements
- **Screen Reader Support**: Meaningful text content, no icon-only buttons

### Visual Accessibility

- **High Contrast**: Status colors meet WCAG guidelines
- **Clear Typography**: Readable font sizes and weights
- **Status Indicators**: Multiple cues (color + text + icons)
- **Focus States**: Visible focus indicators on interactive elements

### Keyboard Support

| Element | Keys | Action |
|---------|------|--------|
| **Autocomplete** | Tab, Arrow keys, Enter | Navigate and select stations |
| **Platform warnings** | Tab, Enter, Space | Expand/collapse conflict details |
| **Show all button** | Tab, Enter | Expand journey list |

### Limitations

- No screen reader announcements on auto-refresh (intentional - avoids spam)
- No live regions for dynamic updates
- Relies on default browser accessibility features

## Browser Compatibility

### Required APIs

| API | Purpose | Support |
|-----|---------|---------|
| **ES Modules** | Module loading | All modern browsers |
| **Fetch API** | HTTP requests | All modern browsers |
| **Page Visibility API** | Tab visibility detection | Chrome 14+, Firefox 10+, Safari 7+ |
| **History API** | URL routing | All modern browsers |
| **setInterval** | Timer functionality | Universal |

### Supported Browsers

- ✅ Chrome 90+
- ✅ Firefox 90+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Android)

### Progressive Enhancement

- If Page Visibility API unavailable: Refresh continues when tab hidden (acceptable degradation)
- If JavaScript disabled: Application non-functional (requires JS)

## Deployment & Infrastructure

### Hosting

- **Static site**: Served from CDN/static hosting
- **No server-side rendering**: Pure client-side app
- **No backend**: API is separate service

### Build Process

```bash
npm run build    # Vite build → dist/
npm run preview  # Test production build locally
```

**Output**: Static HTML, JS, and CSS in `dist/` directory

### Environment Requirements

- Node.js (for build only)
- No runtime dependencies
- Any static file host (Netlify, Vercel, S3, etc.)

## Known Limitations

### Functional Limitations

1. **Fixed refresh interval** (60s) - Not user-configurable
2. **No offline support** - Requires network connection
3. **No historical data** - Only shows upcoming trains
4. **Single origin station** - Only London Euston (by design)
5. **No real-time push** - Polling-based updates
6. **No user accounts** - No personalization or saved preferences
7. **Hardcoded station list** - Requires rebuild to add stations

### Technical Limitations

1. **No server-side rendering** - SEO and initial load could be better
2. **Client-side routing only** - Direct links require JS to work
3. **No request cancellation** - In-flight requests complete even if tab hidden
4. **Multiple tabs duplicate requests** - No cross-tab coordination
5. **String-based time comparison** - Works but limited to HH:MM format
6. **Timezone-naive** - Assumes server and API use same timezone

### Scale Limitations

1. **API rate limits** - Each user makes 120 req/hour (2 endpoints × 60 min)
2. **No caching between sessions** - Each visit starts fresh
3. **No service worker** - No offline capability or background updates

## Future Roadmap

### Near-Term Enhancements (Not Planned)

- Manual refresh button
- Last updated timestamp display
- Configurable refresh intervals
- Offline detection and notification
- Loading indicators for refreshes

### Medium-Term Enhancements (Not Planned)

- Push notifications when platforms confirmed
- WebSocket connections for real-time updates
- User preferences (favorite destinations, refresh rate)
- Dark mode
- Service worker for offline support
- Historical accuracy tracking

### Long-Term Enhancements (Not Planned)

- Multi-station support (other major stations)
- Mobile app (React Native or PWA)
- User accounts with saved preferences
- Real-time delay predictions
- Integration with ticket booking
- Multi-language support

## Quality & Testing

### Current Testing Approach

- **Manual testing**: Browser-based functional testing
- **Type checking**: `npm run check` (TypeScript + Svelte)
- **Build verification**: `npm run build` must succeed
- **No automated tests**: Test suite not implemented

### Quality Checklist

When making changes, verify:

- [ ] Station selection works
- [ ] URL updates correctly
- [ ] Browser back/forward works
- [ ] Auto-refresh triggers every 60s
- [ ] Refresh pauses when tab hidden
- [ ] Refresh resumes when tab visible
- [ ] Departed trains filtered out, overdue trains retained
- [ ] Error messages display correctly
- [ ] Status indicators show correctly
- [ ] Last train styling distinct
- [ ] Expand/collapse works
- [ ] Transitions smooth
- [ ] Type checking passes
- [ ] Build succeeds

## Navigation to Detailed Specifications

### Core Features

- **[Station Search and Routing](./station-search-and-routing.md)** - Autocomplete search and lightweight URL routing
- **[Departure Display](./departure-display.md)** - Journey visualization with status indicators
- **[Auto-Refresh](./auto-refresh.md)** - 60-second refresh cycle with visibility detection
- **[Platform Validation](./platform-validation.md)** - Warning system for uncertain platforms

### Development Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - Comprehensive AI assistant guide for codebase
- **[README.md](../../README.md)** - Project setup and development instructions

## Maintenance & Support

### Change Process

1. Read existing code first
2. Follow Svelte 5 patterns
3. Maintain type safety
4. Test manually in browser
5. Run `npm run check` and `npm run build`
6. Commit with clear messages

### Getting Help

- **Code questions**: See [CLAUDE.md](../../CLAUDE.md)
- **Feature details**: See individual feature specs above
- **Bug reports**: Check browser console first
- **Feedback**: Check project README for contact information

---

**Document Status**: ✅ Current
**Covers Version**: 1.0
**Last Review**: 2026-01-27
**Next Review**: As needed for major changes
