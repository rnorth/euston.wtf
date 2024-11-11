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
    isCancelled: boolean;
    isDelayed: boolean;
    isPlatformChanged: boolean;
    isPlatformConfirmed: boolean;
    platform: string;
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

export const departures = writable<Departures | null>(null);
export const lastError = writable<string | null>(null);

export async function fetchDepartures(destination: string) {
    if (destination !== "") {
        try {
            const response = await fetch(
                `https://api.euston.wtf/journeys/EUS/${destination}`,
                {
                    headers: {
                        Accept: "application/json",
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Network response was not ok " + response.statusText);
            }

            const data = await response.json();

            // filter data.journeys to remove departures that have already left
            data.journeys = data.journeys.filter((journey: Journey) => {
                const nowHHMM = new Date().toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                });

                return journey.departureTime > nowHHMM;
            });

            console.log(data);
            departures.set(data);
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
