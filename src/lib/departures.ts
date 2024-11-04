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