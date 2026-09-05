/* Data looks like this:
{
    "attribution": "Powered by Realtime Trains API: https://www.realtimetrains.co.uk",
    "journeys": [
        {
            "arrivalTime": "20:04",
            "cancelReasonShortText": "",
            "delayInMinutes": 0,
            "departureTime": "19:39",
            "isCancelled": false,
            "isDelayed": false,
            "isDeparted": false,
            "isOverdue": false,
            "isPlatformChanged": false,
            "isPlatformConfirmed": false,
            "platform": "10",
            "runDate": "2024-11-04",
            "runningLatenessInMinutes": null,
            "scheduledArrivalTime": "20:04",
            "scheduledDepartureTime": "19:39",
            "serviceType": "train",
            "serviceUid": "C77140"
        },
    ...
    "params": {
        "date": "2024/11/04",
        "destination": "KGL",
        "origin": "EUS"
    },
    "summary": "OK"
        */

import {writable} from "svelte/store";

export interface Journey {
    arrivalTime: string;
    cancelReasonShortText: string;
    delayInMinutes: number;
    departureTime: string;
    destination: string;
    destinationDescription: string;
    isCancelled: boolean;
    isDelayed: boolean;
    // an actual departure has been reported - the train has definitely left
    isDeparted: boolean;
    // past its expected departure time with no report - the train may still be here
    isOverdue: boolean;
    isPlatformChanged: boolean;
    isPlatformConfirmed: boolean;
    platform: string;
    serviceLocation: string;
    runDate: string;
    runningLatenessInMinutes: number;
    scheduledArrivalTime: string;
    scheduledDepartureTime: string;
    serviceType: string;
    serviceUid: string;
}

export interface Departures {
    attribution: string;
    journeys: Journey[];
    params: {
        date: string;
        destination: string;
        origin: string;
    };
    summary: string;
}

export interface PlatformValidation {
    isConfident: boolean;
    conflictingDeparture?: Journey;
}

export const departures = writable<Departures | null>(null);
export const departuresByPlatform = writable<{[key: string]: Journey[]} | null>(null);
export const lastError = writable<string | null>(null);

export async function fetchDepartures(destination: string) {
    if (destination !== "") {
        try {
            // Fetch both endpoints in parallel
            const [journeysResponse, platformsResponse] = await Promise.all([
                fetch(
                    `https://api.euston.wtf/journeys/EUS/${destination}`,
                    {
                        headers: {
                            Accept: "application/json",
                        },
                    }
                ),
                fetch(
                    `https://api.euston.wtf/departures/EUS`,
                    {
                        headers: {
                            Accept: "application/json",
                        },
                    }
                )
            ]);

            if (!journeysResponse.ok) {
                throw new Error("Network response was not ok " + journeysResponse.statusText);
            }

            if (!platformsResponse.ok) {
                throw new Error("Network response was not ok " + platformsResponse.statusText);
            }

            const data = await journeysResponse.json();
            const platformsData = await platformsResponse.json();

            // Overdue trains stay listed; only the API knows what has actually left.
            data.journeys = data.journeys.filter((journey: Journey) => !journey.isDeparted);

            departures.set(data);
            departuresByPlatform.set(platformsData.departuresByPlatform);
            lastError.set(null);
        } catch (error) {
            console.error(
                "There has been a problem with your fetch operation:",
                error
            );
            lastError.set("Unable to retrieve data from backend. Please refresh or try again later.");
        }
    }
}

// Helper function to parse time string (HH:MM) into minutes
function parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Validate whether a platform assignment is confident or uncertain
export function validatePlatform(
    journey: Journey,
    departuresByPlatform: {[key: string]: Journey[]} | null
): PlatformValidation {
    // If platform is confirmed, always confident
    if (journey.isPlatformConfirmed) {
        return { isConfident: true };
    }

    // If no platform assigned or no platform data available, neutral (confident)
    if (!journey.platform || !departuresByPlatform) {
        return { isConfident: true };
    }

    const platformDepartures = departuresByPlatform[journey.platform];
    if (!platformDepartures || platformDepartures.length === 0) {
        // No other departures from this platform = confident
        return { isConfident: true };
    }

    // Find next departure from this platform after our journey's departure time.
    // Departed trains report their actual departure time, so they'd otherwise be
    // picked as a conflict despite having already left the platform.
    const nextDeparture = platformDepartures.find(d =>
        !d.isDeparted && d.departureTime >= journey.departureTime
    );

    if (!nextDeparture) {
        return { isConfident: true };
    }

    // Check if it's the same service
    if (nextDeparture.serviceUid === journey.serviceUid) {
        return { isConfident: true };
    }

    // Check time difference (10 minute threshold)
    const journeyMinutes = parseTime(journey.departureTime);
    const nextMinutes = parseTime(nextDeparture.departureTime);
    const diffMinutes = nextMinutes - journeyMinutes;

    if (diffMinutes > 10) {
        // Enough time for platform change
        return { isConfident: true };
    }

    // Conflicting departure within 10 minutes to different destination
    return {
        isConfident: false,
        conflictingDeparture: nextDeparture
    };
}

// The badge people actually look for is "can I still get a train home?", so it belongs on
// the last train they could board - not simply the last row. Two things disqualify a row:
// a replacement bus is not a train, and a cancelled service is not catchable. Both turn up
// at the end of the night, which is exactly where the badge lands.
//
// Returns the serviceUid rather than an index because the board renders its final row
// separately from the loop, so there is no single index to compare against.
export function lastCatchableTrainUid(journeys: Journey[]): string | null {
    for (let i = journeys.length - 1; i >= 0; i--) {
        const journey = journeys[i];
        if (journey.serviceType === "train" && !journey.isCancelled) {
            return journey.serviceUid;
        }
    }
    return null;
}

// The rows kept below the "..." when the list is collapsed: the last train home, and the
// genuinely final departure when that is something else - a replacement bus, or a cancelled
// service. Pinning the first of these is what stops the "Last train" badge sitting in the
// hidden middle of the list on precisely the nights it earns its keep.
export function pinnedRows(journeys: Journey[], lastTrainUid: string | null, shownCount: number): Journey[] {
    const alreadyShown = journeys.slice(0, shownCount);
    const lastTrain = journeys.find((journey) => journey.serviceUid === lastTrainUid);
    const finalDeparture = journeys[journeys.length - 1];

    const pinned: Journey[] = [];
    // In list order: the last train can only be at or before the final departure.
    for (const journey of [lastTrain, finalDeparture]) {
        if (journey && !alreadyShown.includes(journey) && !pinned.includes(journey)) {
            pinned.push(journey);
        }
    }
    return pinned;
}
