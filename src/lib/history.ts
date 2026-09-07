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

// The two functions below both render fragments of one hint line, joined by "·" in
// JourneyPane: "Usually ~3 min late · usually platform 12 · often cancelled (4 of 11)".
// Only the first is ever the opening fragment, so it alone is capitalised.

// A sub-minute early average is a single train pulling out a minute early, not a
// pattern - and for a passenger it reads as on time anyway.
export function delaySummary(history: ServiceHistory): string {
    const mean = Math.round(history.meanDelayMinutes);
    return mean >= 1 ? `Usually ~${mean} min late` : "Usually on time";
}

// Bands for the share of runs that were cancelled. Words rather than a percentage
// because at these sample sizes one bad evening moves the figure by ten points; the
// count comes along in brackets so "often" off three events has to show its work.
// Both edges are inclusive: exactly a tenth of runs reads as "sometimes", exactly a
// quarter as "often".
const sometimesFrom = 0.1;
const oftenFrom = 0.25;

// Two cancellations before we say anything at all. Across the whole board most
// cancelled services have exactly one to their name in ninety days, which is weather
// rather than character, and reads far more alarmingly than it deserves to.
const minCancellations = 2;

export function cancellationSummary(history: ServiceHistory): string | null {
    const runs = runsObserved(history);
    if (runs === 0 || history.cancellations < minCancellations) return null;

    const rate = history.cancellations / runs;
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
