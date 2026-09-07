<script lang="ts">
    import { slide } from "svelte/transition";
    import { departuresByPlatform, validatePlatform, type Journey } from "./departures";
    import { cancellationSummary, delaySummary, historyByService, minObservations, runsObserved } from "./history";

    interface Props {
        journey: Journey;
        isLastTrain?: boolean;
    }

    let { journey, isLastTrain = false }: Props = $props();

    // Platform validation
    let validation = $derived(validatePlatform(journey, $departuresByPlatform));
    let showConflictDetails = $state(false);

    // A cancelled train never reports an actual departure, so the API flags it overdue
    // once its time passes - but "cancelled" is the only status worth showing.
    let isOverdue = $derived(journey.isOverdue && !journey.isCancelled);

    // Historical performance for this service, keyed by the same serviceUid the
    // board loops on. Services are re-identified at the May/December timetable
    // recast, so a fresh UID simply has no history yet and nothing is shown.
    //
    // Null also covers "not enough history to be worth showing". Counting runs rather
    // than departures matters here: gating on departures alone hid exactly the services
    // worth warning about, because their cancellations shrank their own sample.
    let history = $derived.by(() => {
        const found = $historyByService?.get(journey.serviceUid) ?? null;
        if (found === null || runsObserved(found) < $minObservations) return null;
        return found;
    });

    // Every fragment is optional now, so the line is assembled rather than laid out in
    // markup: nulls drop away, whatever is left is joined, and only the survivor that
    // ends up first is capitalised. An entirely unremarkable service says nothing.
    let hints = $derived.by(() => {
        if (history === null) return [];

        const usualPlatform =
            history.usualPlatform && history.usualPlatform !== history.plannedPlatform
                ? `usually platform ${history.usualPlatform}`
                : null;

        return [delaySummary(history), usualPlatform, cancellationSummary(history)]
            .filter((hint): hint is string => hint !== null);
    });

    function rowClass() {
        if (journey.isCancelled) return "is-danger";
        if (isOverdue || journey.isDelayed) return "is-warning";
        return "";
    }

    function titlecase(str: string) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
</script>

<article class="message {rowClass()}">
    <div class="message-body">
        <div>
            {#if isOverdue}
                <span class="muted">{journey.departureTime}</span>
            {:else if journey.isDelayed}
                <span>{journey.departureTime}</span>
                <span class="strikethrough">{journey.scheduledDepartureTime}</span>
            {:else}
                {journey.departureTime}
            {/if}
        </div>

        <div>
            <!-- A replacement bus has no platform, and a train that has not been given one
                 yet reports an empty string - either way, claiming "Platform" with nothing
                 after it is worse than saying nothing at all. -->
            {#if !journey.isCancelled && journey.serviceType === "train" && journey.platform}

                {#if journey.isPlatformConfirmed}
                    <p class="platform confirmed">Platform {journey.platform}</p>
                    <span class="platform-state" title="Platform confirmed - very likely">(Confirmed)</span>
                {:else}
                    <p class="platform">Platform {journey.platform}</p>
                    <span class="platform-state" title="As scheduled - could change still">(Scheduled)</span>
                {/if}
            {/if}
        </div>

        <div>
            {#if isLastTrain}
                <span class="tag is-info">Last train</span>
            {/if}

            {#if journey.isPlatformChanged}
                <span class="tag is-warning">Platform has changed</span>
            {/if}

            {#if journey.isCancelled}
                <span class="tag is-danger" title="{journey.cancelReasonShortText}">Cancelled</span>
            {/if}

            {#if isOverdue}
                <span class="tag is-warning"
                      title="Past its departure time with no report from the train - check the departure boards">Departure delayed</span>
            {:else if journey.isDelayed}
                <span class="tag is-warning">Delayed</span>
            {/if}

            {#if journey.serviceType === "bus"}
                <!-- Named rather than just "Bus": at 02:00 the useful fact is that this is
                     standing in for a train, not that a bus happens to exist. -->
                <span class="tag is-danger">Replacement bus</span>
            {:else if journey.serviceType !== "train"}
                <span class="tag is-danger">{titlecase(journey.serviceType)}</span>
            {/if}

            {#if journey.serviceLocation.startsWith("APPR")}
                <span class="tag is-info">Approaching</span>
            {:else if journey.serviceLocation === "DEP_PREP"}
                <span class="tag is-info">At platform</span>
                <span class="tag is-info">Preparing to depart</span>
            {:else if journey.serviceLocation === "DEP_READY"}
                <span class="tag is-info">At platform</span>
                <span class="tag is-info">Ready to depart</span>
            {:else if journey.serviceLocation === "AT_PLAT"}
                <span class="tag is-info">At platform</span>
            {/if}

            {#if !validation.isConfident}
                <div class="warning-indicator">
                    <span
                        class="tag is-warning"
                        role="button"
                        tabindex="0"
                        onclick={() => showConflictDetails = !showConflictDetails}
                        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { showConflictDetails = !showConflictDetails; e.preventDefault(); }}}
                        style="cursor: pointer;"
                    >
                        ⚠️ Platform uncertain
                    </span>
                </div>
                {#if showConflictDetails && validation.conflictingDeparture}
                    <div class="conflict-details" transition:slide={{ duration: 300 }}>
                        <div class="message is-warning is-small">
                            <div class="message-body">
                                Next departure from Platform {journey.platform} at <strong>{validation.conflictingDeparture.departureTime}</strong> goes to <strong>{validation.conflictingDeparture.destinationDescription || validation.conflictingDeparture.destination}</strong>
                            </div>
                        </div>
                    </div>
                {/if}
            {/if}
        </div>

        <!-- Last in the DOM but a row of its own, spanning all three columns: the hint
             describes the service rather than the time, and at ~45 characters it wrapped
             three times in the column the time lives in. -->
        {#if history && hints.length > 0}
            <p class="history"
               title="Based on {runsObserved(history)} observed runs in the last 90 days">
                {titlecase(hints.join(" · "))}
            </p>
        {/if}
    </div>
</article>

<style>
    /* li displays as a box with rounded borders all round */
    .message-body {
        display: grid;
        grid-template-columns: 1fr 3fr 2fr;
        gap: 0.5rem;
        padding: 0.5rem;
        margin: 0.5rem 0;
    }

    .message-body > div {
        align-self: start;
    }

    .platform.confirmed {
        font-weight: 800;
    }

    .platform-state[title] {
        text-decoration-style: dashed;
        text-decoration-line: underline;
        color: gray;
    }

    .strikethrough {
        text-decoration: line-through;
    }

    .history {
        grid-column: 1 / -1;
        margin: 0;
        font-size: 0.8rem;
        color: gray;
    }

    /* Overdue: the time has passed but the train may still be here, so dim it
       rather than striking it through - a struck time reads as "gone". */
    .muted {
        opacity: 0.6;
    }

    .conflict-details {
        margin-top: 0.5rem;
    }

    .conflict-details .message {
        margin-bottom: 0;
    }

    .conflict-details .message-body {
        padding: 0.75rem;
        font-size: 0.85rem;
        display: block;
    }
</style>
