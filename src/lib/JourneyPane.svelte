<script lang="ts">
  import type Journey from "./departures";

  export let journey: Journey;
  export let isLastTrain: boolean = false;
</script>

<li>
  <div>{journey.departureTime}</div>

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

    {#if journey.isCancelled}
      <span title="Train has been cancelled">Cancelled</span>
    {/if}
  </div>

  <div>
    {#if isLastTrain}
      Last train!
    {/if}
    {#if journey.isPlatformChanged}
      Platform has changed!
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
</style>
