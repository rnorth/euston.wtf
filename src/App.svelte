<script lang="ts">
  // @ts-ignore: no types are available?
  import AutoComplete from "simple-svelte-autocomplete";
  import { type Journey, type Departures, fetchDepartures, departures } from "./lib/departures";
  import JourneyPane from "./lib/JourneyPane.svelte";
  import Title from "./lib/Title.svelte";
  import { onMount } from "svelte";

  const stations = [
    "Milton Keynes Central (MKC)",
    "Birmingham New Street (BHM)",
    "Kings Langley (KGL)",
    "Tring (TRI)",
    "Coventry (COV)",
    "Northampton (NMP)",
    "Liverpool Lime Street (LIV)",
  ];
  let selectedDestination = "";
  let destination = "";

  let nextRefresh = 0;
  let now = new Date().getTime();

  onMount(() => {
    setInterval(() => {
      now = new Date().getTime();
    }, 1000);
  });

  $: {
    let match = selectedDestination.match(/\(([^)]+)\)/);
    destination = match ? match[1] : "";
    nextRefresh = 0;
  }

  $: {
    if (destination !== "" && now > nextRefresh) {
      fetchDepartures(destination).then(() => {
        nextRefresh = now + 60000;
      });
    }
  }
</script>

<header>
  <Title/>
</header>

<main>
  <section>
    <p>No fuss platform and departure times for your journey from Euston</p>
  </section>

  <section>
    <AutoComplete items={stations} bind:selectedItem={selectedDestination} placeholder="Trains to..." />
  </section>

  {#if $departures}
    <section>
      <h2>Departures to {selectedDestination}</h2>
      <ul>
        {#each $departures.journeys.slice(0, 5) as journey, i}
          <JourneyPane {journey} isLastTrain={i == $departures.journeys.length - 1}/>
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

<style>
  li.elipsis {
    list-style-type: none;
  }
</style>
