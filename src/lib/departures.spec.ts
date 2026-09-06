import {describe, expect, it} from "vitest";
import {
    lastCatchableTrainUid,
    pinnedRows,
    validatePlatform,
    type Journey,
} from "./departures";

// A journey carries far more fields than any of these functions read, so tests build one
// from a plausible default and override only what the case is actually about.
function journey(overrides: Partial<Journey> = {}): Journey {
    return {
        arrivalTime: "20:04",
        cancelReasonShortText: "",
        delayInMinutes: 0,
        departureTime: "19:39",
        destination: "MKC",
        destinationDescription: "Milton Keynes Central",
        isCancelled: false,
        isDelayed: false,
        isDeparted: false,
        isOverdue: false,
        isPlatformChanged: false,
        isPlatformConfirmed: false,
        platform: "10",
        serviceLocation: "",
        runDate: "2024-11-04",
        runningLatenessInMinutes: 0,
        scheduledArrivalTime: "20:04",
        scheduledDepartureTime: "19:39",
        serviceType: "train",
        serviceUid: "C00000",
        ...overrides,
    };
}

describe("lastCatchableTrainUid", () => {
    it("picks the final row when it is a running train", () => {
        const journeys = [
            journey({serviceUid: "A"}),
            journey({serviceUid: "B"}),
        ];

        expect(lastCatchableTrainUid(journeys)).toBe("B");
    });

    it("skips a replacement bus at the end of the night", () => {
        const journeys = [
            journey({serviceUid: "A"}),
            journey({serviceUid: "B"}),
            journey({serviceUid: "BUS", serviceType: "bus"}),
        ];

        expect(lastCatchableTrainUid(journeys)).toBe("B");
    });

    it("skips a cancelled last train", () => {
        const journeys = [
            journey({serviceUid: "A"}),
            journey({serviceUid: "B", isCancelled: true}),
        ];

        expect(lastCatchableTrainUid(journeys)).toBe("A");
    });

    it("returns null when every service is cancelled", () => {
        const journeys = [
            journey({serviceUid: "A", isCancelled: true}),
            journey({serviceUid: "B", isCancelled: true}),
        ];

        expect(lastCatchableTrainUid(journeys)).toBeNull();
    });

    it("returns null for an empty list", () => {
        expect(lastCatchableTrainUid([])).toBeNull();
    });
});

describe("pinnedRows", () => {
    const five = [
        journey({serviceUid: "A"}),
        journey({serviceUid: "B"}),
        journey({serviceUid: "C"}),
        journey({serviceUid: "D"}),
        journey({serviceUid: "E"}),
    ];

    it("pins nothing when both the last train and the final row are already visible", () => {
        expect(pinnedRows(five, "E", 5)).toEqual([]);
    });

    it("pins the final row when it is hidden below the fold", () => {
        const journeys = [...five, journey({serviceUid: "F"})];

        expect(pinnedRows(journeys, "F", 5).map((j) => j.serviceUid)).toEqual(["F"]);
    });

    it("pins the last train and the final row separately when they differ", () => {
        const journeys = [
            ...five,
            journey({serviceUid: "F"}),
            journey({serviceUid: "BUS", serviceType: "bus"}),
        ];

        expect(pinnedRows(journeys, "F", 5).map((j) => j.serviceUid)).toEqual(["F", "BUS"]);
    });

    it("pins only the final row when the last train is still visible", () => {
        const journeys = [...five, journey({serviceUid: "BUS", serviceType: "bus"})];

        expect(pinnedRows(journeys, "E", 5).map((j) => j.serviceUid)).toEqual(["BUS"]);
    });

    it("pins only the final row when there is no catchable train at all", () => {
        const journeys = [...five, journey({serviceUid: "F", isCancelled: true})];

        expect(pinnedRows(journeys, null, 5).map((j) => j.serviceUid)).toEqual(["F"]);
    });

    it("pins nothing for an empty list", () => {
        expect(pinnedRows([], null, 5)).toEqual([]);
    });
});

describe("validatePlatform", () => {
    it("is confident about a confirmed platform even with a conflict alongside it", () => {
        const subject = journey({serviceUid: "A", platform: "10", isPlatformConfirmed: true});
        const byPlatform = {
            "10": [journey({serviceUid: "B", departureTime: "19:44", platform: "10"})],
        };

        expect(validatePlatform(subject, byPlatform)).toEqual({isConfident: true});
    });

    it("is confident when the journey has no platform assigned", () => {
        const subject = journey({serviceUid: "A", platform: ""});

        expect(validatePlatform(subject, {"10": [journey({serviceUid: "B"})]}))
            .toEqual({isConfident: true});
    });

    it("is confident when no platform data has been loaded", () => {
        expect(validatePlatform(journey(), null)).toEqual({isConfident: true});
    });

    it("is confident when nothing else uses the platform", () => {
        const subject = journey({serviceUid: "A", platform: "10"});

        expect(validatePlatform(subject, {"10": []})).toEqual({isConfident: true});
        expect(validatePlatform(subject, {"11": [journey({serviceUid: "B", platform: "11"})]}))
            .toEqual({isConfident: true});
    });

    it("names the conflict when another service is due within 10 minutes, and stops at 11", () => {
        const subject = journey({serviceUid: "A", departureTime: "19:39", platform: "10"});
        const tenAway = journey({serviceUid: "B", departureTime: "19:49", platform: "10"});
        const elevenAway = journey({serviceUid: "C", departureTime: "19:50", platform: "10"});

        expect(validatePlatform(subject, {"10": [tenAway]})).toEqual({
            isConfident: false,
            conflictingDeparture: tenAway,
        });
        expect(validatePlatform(subject, {"10": [elevenAway]})).toEqual({isConfident: true});
    });

    it("ignores a departed train reporting its actual departure time", () => {
        const subject = journey({serviceUid: "A", departureTime: "19:39", platform: "10"});
        const gone = journey({serviceUid: "B", departureTime: "19:41", platform: "10", isDeparted: true});
        const later = journey({serviceUid: "C", departureTime: "20:30", platform: "10"});

        expect(validatePlatform(subject, {"10": [gone, later]}))
            .toEqual({isConfident: true});
    });

    it("ignores earlier departures from the same platform", () => {
        const subject = journey({serviceUid: "A", departureTime: "19:39", platform: "10"});
        const earlier = journey({serviceUid: "B", departureTime: "19:30", platform: "10"});

        expect(validatePlatform(subject, {"10": [earlier]}))
            .toEqual({isConfident: true});
    });

    // The /departures/EUS feed lists a service under its own platform, unconfirmed ones
    // included, so the subject is often the first match for "next departure from here" and
    // the same-service check short-circuits the whole comparison. A conflict is therefore
    // only reported when the subject is absent from the bucket, or listed after the
    // conflicting service. Pinned as current behaviour, not endorsed as correct.
    it("is confident when it matches itself before reaching a genuine conflict", () => {
        const subject = journey({serviceUid: "A", departureTime: "19:39", platform: "10"});
        const conflict = journey({serviceUid: "B", departureTime: "19:44", platform: "10"});

        expect(validatePlatform(subject, {"10": [subject, conflict]}))
            .toEqual({isConfident: true});
    });

    // The same feed leaves departureTime empty for a service with no estimate yet, and
    // "" never sorts at or after a real HH:MM, so those rows drop out of the search.
    it("skips a platform-mate with no departure time yet", () => {
        const subject = journey({serviceUid: "A", departureTime: "19:39", platform: "10"});
        const noTime = journey({serviceUid: "B", departureTime: "", platform: "10"});

        expect(validatePlatform(subject, {"10": [noTime]})).toEqual({isConfident: true});
    });
});
