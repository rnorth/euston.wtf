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

// A service needs this many observed departures before its history is shown -
// a single late evening is not a pattern, and the recorded data is still young.
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

declare global {
    interface Window {
        // Dev console hook, see main.ts
        __euston: {
            minObservations: number;
        };
    }
}
