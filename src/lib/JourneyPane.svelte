<script lang="ts">
    import type {Journey} from "./departures";

    interface Props {
        journey: Journey;
        isLastTrain?: boolean;
    }

    let { journey, isLastTrain = false }: Props = $props();

    function rowClass() {
        return journey.isCancelled ? "is-danger" : journey.isDelayed ? "is-warning" : "";
    }

    function titlecase(str: string) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
</script>

<article class="message {rowClass()}">
    <div class="message-body">
        <div>
            {#if journey.isDelayed}
                <span>{journey.departureTime}</span>
                <span class="strikethrough">{journey.scheduledDepartureTime}</span>
            {:else}
                {journey.departureTime}
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

            {#if journey.isDelayed}
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
</style>
