<script lang="ts">
  // @ts-ignore: no types are available?
  import AutoComplete from "simple-svelte-autocomplete";
  import {
    type Journey,
    type Departures,
    fetchDepartures,
    departures,
  } from "./lib/departures";
  import JourneyPane from "./lib/JourneyPane.svelte";
  import Title from "./lib/Title.svelte";
  import { onMount } from "svelte";
  import {type Station, stations} from "./lib/stations";

  let selectedDestination: Station | null = null;
  let destinationCode = "";

  let nextRefresh = 0;
  let now = new Date().getTime();
  let isVisible = true;

  onMount(() => {
    setInterval(() => {
      now = new Date().getTime();
    }, 1000);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        console.log("hidden - suspending refresh");
        isVisible = false;
      } else {
        console.log("visible - resuming refresh");
        isVisible = true;
        nextRefresh = 0;
      }
    });
  });

  function doRefresh() {
    fetchDepartures(destinationCode).then(() => {
      nextRefresh = now + 60000;
    });
  }

  $: {
    if (selectedDestination !== null && now > nextRefresh && isVisible) {
      doRefresh();
    }
  }

  $: {
    if (selectedDestination !== null) {
      destinationCode = selectedDestination.code;
      doRefresh();
      departures.set(null);
    }
  }
</script>

<div class="container">
  <main>
    <section class="section">
      <Title />
    </section>

    <section class="section">
      <AutoComplete
        items={stations}
        labelFunction={(item) => item.station + " (" + item.code + ")"}
        bind:selectedItem={selectedDestination}
        placeholder="Trains to..."
      />
    </section>

    {#if $departures}
      <section class="section">
        <h2>
          Departures to {selectedDestination?.station} ({selectedDestination?.code})
          <span>
            {#if now > nextRefresh}
              (Updating)
            {:else}
              (Updating in { Math.round((nextRefresh - now) / 1000) } seconds)
            {/if}
          </span>
        </h2>
        <ul>
          {#each $departures.journeys.slice(0, 5) as journey, i}
            <JourneyPane
              {journey}
              isLastTrain={i == $departures.journeys.length - 1}
            />
          {/each}

          <!-- if more than five journeys also display the final item -->
          {#if $departures.journeys.length > 5}
            <li class="elipsis" aria-hidden="true">...</li>
            <JourneyPane
              journey={$departures.journeys[$departures.journeys.length - 1]}
              isLastTrain={true}
            />
          {/if}
        </ul>
      </section>
    {/if}
  </main>
</div>

<style>
  li.elipsis {
    list-style-type: none;
  }
</style>
