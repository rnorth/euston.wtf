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

            const today = new Date();
            const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            // filter data.journeys to remove departures that have already left
            data.journeys = data.journeys.filter((journey: Journey) => {
                const nowHHMM = new Date().toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                });

                // either the train journey is in the future or it is early tomorrow
                return journey.departureTime > nowHHMM || journey.runDate !== todayDate;
            });

            console.log(data);
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

    // Find next departure from this platform after our journey's departure time
    const nextDeparture = platformDepartures.find(d =>
        d.departureTime >= journey.departureTime
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
