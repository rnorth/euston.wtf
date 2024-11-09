<script lang="ts">
  import type Journey from "./departures";

  export let journey: Journey;
  export let isLastTrain: boolean = false;
</script>

<li>
  <div>
    {#if journey.isDelayed}
      <span>{journey.departureTime}</span>
      <span class="strikethrough">{journey.scheduledDepartureTime}</span>
    {:else}
      {journey.departureTime}
    {/if}
  </div>

  <span class="platform">Platform</span>

  <div class="platform">
    {journey.platform}
  </div>

  <div>
    {#if journey.isPlatformConfirmed}
      <span title="Platform confirmed - very likely">Confirmed</span>
    {:else}
      <span title="As scheduled - could change still">May change</span>
    {/if}
  </div>

  <div class="updates">
    {#if isLastTrain}
      <span>Last train!</span>
    {/if}

    {#if journey.isPlatformChanged}
      <span>Platform has changed</span>
    {/if}

    {#if journey.isCancelled}
      <span title="{journey.cancelReasonShortText}">Cancelled</span>
    {/if}

    {#if journey.isDelayed}
      <span>Delayed by {journey.delayInMinutes} mins</span>
    {/if}
  </div>
</li>

<style>
  /* li displays as a box with rounded borders all round */
  li {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr 1fr 2fr;
    gap: 0;
    padding: 0.5rem;
    border: 1px solid gray;
    border-radius: 0.5rem;
    margin: 0.5rem 0;
  }

  li > div {
    align-self: start;
  }

  #platform {
    text-align: right;
  }

  .platform {
    font-weight: 800;
    margin-left: 2ch;
  }

  span[title] {
    text-decoration-style: dashed;
    text-decoration-line: underline;
    color: gray;
  }

  .updates span {
    /* pill */
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 1rem;
    border: 0.25px solid gray;
    font-size: 0.75rem;
  }

  .strikethrough {
    text-decoration: line-through;
  }
</style>
