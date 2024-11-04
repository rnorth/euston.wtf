<script lang="ts">
  import type Journey from "./departures";

  export let journey: Journey;
  export let isLastTrain: boolean = false;
</script>

<li>
  <div>Platform {journey.platform}</div>

  {#if isLastTrain}
    <div>Last train!</div>
  {:else}
    <div></div>
  {/if}
  <div>{journey.departureTime}</div>
</li>

<style>
  /* li displays as a box with rounded borders all round */
  li {
    display: flex;
    justify-content: space-between;
    align-items: top;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 0.5rem;
    margin: 0.5rem 0;
  }
</style>
