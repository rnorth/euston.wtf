import {describe, expect, it} from "vitest";
import {cancellationSummary, delaySummary, runsObserved, type ServiceHistory} from "./history";

// Only the three counting fields matter to either function, but the interface wants
// the rest, so build from a plausible default and override what the case is about.
function history(overrides: Partial<ServiceHistory> = {}): ServiceHistory {
    return {
        serviceUid: "C00000",
        headcode: "2K57",
        scheduledDepartureTime: "19:39",
        destination: "MKC",
        operator: "LM",
        daysObserved: 20,
        departuresObserved: 20,
        cancellations: 0,
        meanDelayMinutes: 0,
        worstDelayMinutes: 0,
        delayedRate: 0,
        plannedPlatform: "10",
        usualPlatform: "10",
        usualPlatformRate: 1,
        ...overrides,
    };
}

describe("runsObserved", () => {
    it("adds cancellations back on to the departures that did happen", () => {
        expect(runsObserved(history({departuresObserved: 7, cancellations: 4}))).toBe(11);
    });
});

describe("delaySummary", () => {
    it("rounds a habitual delay to the nearest minute", () => {
        expect(delaySummary(history({meanDelayMinutes: 3.4}))).toBe("Usually ~3 min late");
    });

    it("reports a delay from the first whole minute, once rounded", () => {
        expect(delaySummary(history({meanDelayMinutes: 0.6}))).toBe("Usually ~1 min late");
    });

    it("calls a sub-minute average on time, early ones included", () => {
        expect(delaySummary(history({meanDelayMinutes: 0.4}))).toBe("Usually on time");
        expect(delaySummary(history({meanDelayMinutes: -0.8}))).toBe("Usually on time");
    });
});

describe("cancellationSummary", () => {
    it("says nothing when the service has never been cancelled", () => {
        expect(cancellationSummary(history({cancellations: 0}))).toBeNull();
    });

    it("says nothing about a single cancellation, however small the sample", () => {
        // The commonest case on the board by a distance: one bad night in ninety days.
        expect(cancellationSummary(history({departuresObserved: 7, cancellations: 1}))).toBeNull();
    });

    it("speaks up from the second cancellation", () => {
        expect(cancellationSummary(history({departuresObserved: 58, cancellations: 2})))
            .toBe("occasionally cancelled (2 of 60)");
    });

    it("counts cancelled runs in the denominator, not just the departures", () => {
        // 4 of 11 is 36%; 4 of 7 would be 57% and a whole band further up.
        expect(cancellationSummary(history({departuresObserved: 7, cancellations: 4})))
            .toBe("often cancelled (4 of 11)");
    });

    it("calls a tenth of runs 'sometimes', and anything below it 'occasionally'", () => {
        expect(cancellationSummary(history({departuresObserved: 27, cancellations: 3})))
            .toBe("sometimes cancelled (3 of 30)");
        expect(cancellationSummary(history({departuresObserved: 28, cancellations: 3})))
            .toBe("occasionally cancelled (3 of 31)");
    });

    it("calls a quarter of runs 'often', and anything below it 'sometimes'", () => {
        expect(cancellationSummary(history({departuresObserved: 15, cancellations: 5})))
            .toBe("often cancelled (5 of 20)");
        expect(cancellationSummary(history({departuresObserved: 16, cancellations: 5})))
            .toBe("sometimes cancelled (5 of 21)");
    });

    it("says nothing when nothing at all has been observed", () => {
        expect(cancellationSummary(history({departuresObserved: 0, cancellations: 0}))).toBeNull();
    });
});
