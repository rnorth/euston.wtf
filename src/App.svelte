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
    // hash part of the URL is the destination code, if set
    if (window.location.hash) {
        const code = window.location.hash.slice(1);
        const station = stations.find((s) => s.code === code);
        if (station) {
            selectedDestination = station;
            doRefresh();
        }
    }

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
      window.location.hash = selectedDestination.code;
    }
  }
</script>

<div class="container">
  <main>
    <section>
      <Title />
    </section>

    <section class="section">
      <p></p>
      <AutoComplete
        items={stations}
        labelFunction={(item) => item.station + " (" + item.code + ")"}
        bind:selectedItem={selectedDestination}
        placeholder="Choose your destination station"
      />
    </section>

    {#if $departures && $departures.journeys.length > 0}
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
            <li class="ellipsis" aria-hidden="true">...</li>
            <JourneyPane
              journey={$departures.journeys[$departures.journeys.length - 1]}
              isLastTrain={true}
            />
          {/if}
        </ul>
      </section>
    {:else if $departures && $departures.journeys.length == 0}
      <section class="section">
        <article class="message is-info">
          <div class="message-header">
            <p>No departures found today</p>
            <button class="delete" aria-label="delete"></button>
          </div>
          <div class="message-body">
            No departures to {selectedDestination?.station} ({selectedDestination?.code}) could be found today.
            Consult official sources for travel information.
          </div>
        </article>
      </section>
    {/if}
  </main>

  <footer class="footer mt-6">
    <div class="content has-text-centered">
      <p>
        <strong>euston.wtf</strong> is a just-for-fun side project.
        Powered by the <a href="https://www.realtimetrains.co.uk">Realtime Trains</a> API.
      </p>
      <p>Contact <a href="mailto:admin@euston.wtf">admin@euston.wtf</a> with any enquiries.</p>
      <p>
        Always follow official sources for travel information. No guarantees are made about the accuracy of the
        information presented on this site.
      </p>
    </div>
  </footer>
</div>

<style>
  li.ellipsis {
    list-style-type: none;
    text-align: center;
  }
</style>
