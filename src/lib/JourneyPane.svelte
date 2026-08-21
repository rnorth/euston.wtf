<script lang="ts">
    import { slide } from "svelte/transition";
    import { departuresByPlatform, validatePlatform, type Journey } from "./departures";
    import { historyByService, minObservations } from "./history";

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
    let history = $derived($historyByService?.get(journey.serviceUid) ?? null);

    let showHistory = $derived(
        history !== null && history.departuresObserved >= $minObservations
    );

    // A sub-minute early average is a single train pulling out a minute early, not
    // a pattern - and for a passenger it reads as on time anyway.
    let delaySummary = $derived.by(() => {
        if (history === null) return "";
        const mean = Math.round(history.meanDelayMinutes);
        if (mean >= 1) return `Usually ~${mean} min late`;
        return "Usually on time";
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

            {#if showHistory && history}
                <p class="history"
                   title="Based on {history.departuresObserved} observed departures in the last 90 days">
                    {delaySummary}
                    {#if history.usualPlatform && history.usualPlatform !== history.plannedPlatform}
                        · usually platform {history.usualPlatform}
                    {/if}
                    {#if history.cancellations > 0}
                        · cancelled {history.cancellations}×
                    {/if}
                </p>
            {/if}
        </div>

        <div>
            {#if !journey.isCancelled}

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
                <span class="tag is-info">Last train!</span>
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

            {#if journey.serviceType !== "train"}
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
        margin: 0.25rem 0 0;
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
