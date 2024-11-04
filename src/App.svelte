<script lang="ts">
  // @ts-ignore: no types are available?
  import AutoComplete from "simple-svelte-autocomplete";
  import type { Journey, Departures } from "./lib/departures";
  import JourneyPane from "./lib/JourneyPane.svelte";

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

  let departures: Departures | null = null;

  $: {
    (async () => {
      departures = null;
      let match = selectedDestination.match(/\(([^)]+)\)/);
      let destination = match ? match[1] : "";

      if (destination !== "") {
        try {
          const response = await fetch(
            `https://rtt-journey-api.rnorth.workers.dev/journeys/EUS/${destination}`,
            {
              headers: {
                Accept: "application/json",
              },
            }
          );

          if (!response.ok) {
            throw new Error(
              "Network response was not ok " + response.statusText
            );
          }

          const data = await response.json();
          console.log(data);
          departures = data;
        } catch (error) {
          console.error(
            "There has been a problem with your fetch operation:",
            error
          );
        }
      }
    })();
  }
</script>

<header>
  <h1>euston.wtf</h1>
</header>

<main>
  <section>
    <p>No fuss platform and departure times for your journey from Euston</p>
  </section>

  <section>
    <label for="destination"
      >Destination
      <AutoComplete items={stations} bind:selectedItem={selectedDestination} />
    </label>

    <button>Get times</button>
  </section>

  {#if departures}
    <section>
      <h2>Departures to {selectedDestination}</h2>
      <ul>
        {#each departures.journeys.slice(0, 5) as journey}
          <JourneyPane {journey} />
        {/each}

        <!-- if more than five journeys also display the final item -->
        {#if departures.journeys.length > 5}
          <li aria-hidden="true">...</li>
          <JourneyPane
            journey={departures.journeys[departures.journeys.length - 1]}
            isLastTrain={true}
          />
        {/if}
      </ul>
    </section>
  {/if}
</main>
