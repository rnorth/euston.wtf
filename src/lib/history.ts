import {writable, get} from "svelte/store";
export {get};

export interface ServiceHistory {
    serviceUid: string;
    headcode: string;
    scheduledDepartureTime: string;
    destination: string;
    operator: string;
    daysObserved: number;
    departuresObserved: number;
    cancellations: number;
    meanDelayMinutes: number;
    worstDelayMinutes: number;
    // fraction of observed departures that were more than five minutes late
    delayedRate: number;
    plannedPlatform: string;
    usualPlatform: string;
    // fraction of observed departures that used the usual platform
    usualPlatformRate: number;
}

// A service needs this many observed runs before its history is shown - a single
// late evening is not a pattern, and the recorded data is still young.
export const minObservations = writable(7);

export const historyByService = writable<Map<string, ServiceHistory> | null>(null);

// History is per origin, not per destination, so one response serves every
// destination page. The server caches it for an hour and the aggregates move
// slowly, so one fetch per page load is enough.
let historyPromise: Promise<void> | null = null;

export function fetchHistory(origin: string): Promise<void> {
    historyPromise ??= (async () => {
        try {
            const response = await fetch(`https://api.euston.wtf/history/${origin}?days=90`, {
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error("Network response was not ok " + response.statusText);
            }

            const data = await response.json();

            if (data.services.length === 0) {
                throw new Error("No services have been tracked yet");
            }

            historyByService.set(
                new Map(data.services.map((service: ServiceHistory) => [service.serviceUid, service]))
            );
        } catch (error) {
            // History is optional colour, not the departure board itself - a failure
            // here must never surface as an error to the user.
            console.error(
                "There has been a problem with your history fetch operation:",
                error
            );
        }
    })();

    return historyPromise;
}

// A cancelled service never departs, so `departuresObserved` leaves it out entirely.
// Every rate below - and the sample size we quote to the user - therefore has to add
// the cancellations back in, or the worst-behaved services look like the smallest.
export function runsObserved(history: ServiceHistory): number {
    return history.departuresObserved + history.cancellations;
}

// The two functions below both render fragments of one hint line, joined by " · " in
// JourneyPane: "averages ~3 mins late · usually platform 12 · often cancelled (4 of 11)".
// Either can come back null, so neither knows whether it opens the line - all fragments
// are lowercase, and JourneyPane capitalises whichever survives to go first.

// Under three minutes we say nothing. A minute or two is inside the noise of walking to
// the platform, so naming it implies a fault where a passenger would perceive none - and
// it would otherwise be the commonest hint on the board, drowning out the real ones.
// The threshold doubles as a grammar guarantee: nothing below "~3 mins" is ever rendered,
// so the plural is always right and the fragment needs no singular case.
const notablyLateFrom = 3;

// "Averages" rather than "usually", because a mean is what we have: three minutes here
// may be nine calm days and one half-hour catastrophe, and "usually" would promise a
// typical evening that the figure cannot vouch for. The other fragments are genuine
// "usually" claims - a modal platform, a rate band - so the mismatch is deliberate.
export function delaySummary(history: ServiceHistory): string | null {
    const mean = Math.round(history.meanDelayMinutes);
    return mean >= notablyLateFrom ? `averages ~${mean} mins late` : null;
}

// Bands for the share of runs that were cancelled. Words rather than a percentage
// because at these sample sizes one bad evening moves the figure by ten points; the
// count comes along in brackets so "often" off three events has to show its work.
// Every edge is inclusive: exactly a tenth of runs reads as "occasionally", a fifth
// as "sometimes", and 35% as "often". Below a tenth we say nothing at all - that is
// a rate the average passenger will never notice, and naming it only alarms.
const occasionallyFrom = 0.1;
const sometimesFrom = 0.2;
const oftenFrom = 0.35;

// Two cancellations before we say anything at all. Across the whole board most
// cancelled services have exactly one to their name in ninety days, which is weather
// rather than character, and reads far more alarmingly than it deserves to.
// This floor and the rate floor above are independent, and neither subsumes the other:
// one cancellation in eight runs clears 10% but not this, and a dozen in two hundred
// clears this but not 10%. Both have to pass.
const minCancellations = 2;

export function cancellationSummary(history: ServiceHistory): string | null {
    const runs = runsObserved(history);
    if (runs === 0 || history.cancellations < minCancellations) return null;

    const rate = history.cancellations / runs;
    if (rate < occasionallyFrom) return null;

    const band =
        rate >= oftenFrom ? "often"
        : rate >= sometimesFrom ? "sometimes"
        : "occasionally";

    return `${band} cancelled (${history.cancellations} of ${runs})`;
}

declare global {
    interface Window {
        // Dev console hook, see main.ts
        __euston: {
            minObservations: number;
        };
    }
}
