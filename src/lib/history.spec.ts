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
        expect(delaySummary(history({meanDelayMinutes: 3.4}))).toBe("averages ~3 mins late");
    });

    it("speaks up from three minutes, and rounds up to get there", () => {
        expect(delaySummary(history({meanDelayMinutes: 2.6}))).toBe("averages ~3 mins late");
        expect(delaySummary(history({meanDelayMinutes: 2.4}))).toBeNull();
    });

    it("says nothing about a minute or two, which a passenger reads as on time", () => {
        expect(delaySummary(history({meanDelayMinutes: 1.4}))).toBeNull();
        expect(delaySummary(history({meanDelayMinutes: 0.6}))).toBeNull();
    });

    it("says nothing about a punctual or early service either", () => {
        expect(delaySummary(history({meanDelayMinutes: 0.4}))).toBeNull();
        expect(delaySummary(history({meanDelayMinutes: -0.8}))).toBeNull();
    });

    it("leaves the fragment lowercase for JourneyPane to capitalise", () => {
        // It may no longer open the line, so it cannot arrive pre-capitalised.
        expect(delaySummary(history({meanDelayMinutes: 9}))).toBe("averages ~9 mins late");
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

    it("says nothing about a rate below a tenth, however many cancellations", () => {
        // A dozen in two hundred is 6%: a rate a passenger would never notice, and the
        // count is far past minCancellations, so only the rate floor can be silencing it.
        expect(cancellationSummary(history({departuresObserved: 188, cancellations: 12}))).toBeNull();
    });

    it("counts cancelled runs in the denominator, not just the departures", () => {
        // 4 of 11 is 36%; 4 of 7 would be 57% and a whole band further up.
        expect(cancellationSummary(history({departuresObserved: 7, cancellations: 4})))
            .toBe("often cancelled (4 of 11)");
    });

    it("calls a tenth of runs 'occasionally', and anything below it nothing at all", () => {
        expect(cancellationSummary(history({departuresObserved: 18, cancellations: 2})))
            .toBe("occasionally cancelled (2 of 20)");
        expect(cancellationSummary(history({departuresObserved: 19, cancellations: 2}))).toBeNull();
    });

    it("calls a fifth of runs 'sometimes', and anything below it 'occasionally'", () => {
        expect(cancellationSummary(history({departuresObserved: 16, cancellations: 4})))
            .toBe("sometimes cancelled (4 of 20)");
        expect(cancellationSummary(history({departuresObserved: 17, cancellations: 4})))
            .toBe("occasionally cancelled (4 of 21)");
    });

    it("calls 35% of runs 'often', and anything below it 'sometimes'", () => {
        expect(cancellationSummary(history({departuresObserved: 13, cancellations: 7})))
            .toBe("often cancelled (7 of 20)");
        expect(cancellationSummary(history({departuresObserved: 14, cancellations: 7})))
            .toBe("sometimes cancelled (7 of 21)");
    });

    it("says nothing when nothing at all has been observed", () => {
        expect(cancellationSummary(history({departuresObserved: 0, cancellations: 0}))).toBeNull();
    });
});
