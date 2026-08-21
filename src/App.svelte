<script lang="ts">
    import AutoComplete from "simple-svelte-autocomplete";
    import {slide} from "svelte/transition";
    import {departures, lastError, fetchDepartures} from "./lib/departures";
    import {fetchHistory} from "./lib/history";
    import JourneyPane from "./lib/JourneyPane.svelte";
    import Title from "./lib/Title.svelte";
    import {onMount} from "svelte";
    import {type Station, stations} from "./lib/stations";

    let selectedDestination: Station | null = null;
    let destinationCode = "";

    let nextRefresh = 0;
    let now = new Date().getTime();
    let isVisible = true;

    let hideLaterJourneys = true;
    let isNavigatingFromUrl = false;

    const currentYear = new Date().getFullYear();

    function reactToUrlChange() {
        isNavigatingFromUrl = true;
        if (window.location.pathname.length > 1) {
            // path part of the URL is the destination code, if set
            const code = window.location.pathname.slice(1);
            const station = stations.find((s) => s.code === code);
            if (station) {
                selectedDestination = station;
            }
        } else if (window.location.hash) {
            // hash part of the URL is the destination code, if set
            const code = window.location.hash.slice(1);
            const station = stations.find((s) => s.code === code);
            if (station) {
                selectedDestination = station;
            }
        }
        isNavigatingFromUrl = false;
    }

    onMount(() => {
        reactToUrlChange();

        window.addEventListener("popstate", () => {
            reactToUrlChange();
        });

        setInterval(() => {
            now = new Date().getTime();
        }, 1000);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                isVisible = false;
            } else {
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
            hideLaterJourneys = true;
            doRefresh();
            // Per origin, not per destination, and cached for the page - so this is
            // one fetch no matter how many destinations the visitor switches through.
            fetchHistory("EUS");
            departures.set(null);

            // use pushState to avoid page reload, but only when user selects from dropdown
            // (not when reacting to URL changes from initial load or browser back/forward)
            if (!isNavigatingFromUrl) {
                window.history.pushState(null, "", `/${selectedDestination.code}`);
            }
        }
    }

    $: {
        if (selectedDestination !== null) {
            document.title = `Departures to ${selectedDestination?.station} (${selectedDestination?.code}) - euston.wtf`;
        }
    }
</script>

<div class="container">
    <main>
        <section>
            <Title/>
        </section>

        <section class="section">
            <AutoComplete
                    items={stations}
                    labelFunction={(item: Station) => item.station + " (" + item.code + ")"}
                    bind:selectedItem={selectedDestination}
                    placeholder="Choose your destination station"
            />
        </section>

        {#if $lastError}
            <div class="message is-danger">
                <div class="message-body">{$lastError}</div>
            </div>
        {/if}

        {#if $departures && $departures.journeys.length > 0}
            <section class="section">
                <h2>
                    Departures to <strong>{selectedDestination?.station} ({selectedDestination?.code})</strong>
                </h2>
                <p>
                    {#if now > nextRefresh}
                        Updating automatically...
                    {:else}
                        Updating in <code>{ Math.round((nextRefresh - now) / 1000) }</code> seconds
                    {/if}
                </p>
                <div>

                    {#if $departures.journeys.length > 5 && hideLaterJourneys}
                        {#each $departures.journeys.slice(0, 5) as journey (journey.serviceUid)}
                            <div out:slide={{duration: 500}}>
                                <JourneyPane {journey} />
                            </div>
                        {/each}
                        <!-- if more than five journeys, hide later journeys but display the final item -->
                        <div class="has-text-centered">
                            <button class="button is-centered ellipsis" title="Show more"
                                    on:click={() => hideLaterJourneys=false}>...
                            </button>
                        </div>
                        <JourneyPane
                                journey={$departures.journeys[$departures.journeys.length - 1]}
                                isLastTrain={true}
                        />
                    {:else}
                        <!-- five or fewer journeys, or if the user has chosen to show all -->
                        {#each $departures.journeys.slice(0, -1) as journey, i (journey.serviceUid)}
                            <div out:slide={{duration: 500}}>
                                <JourneyPane
                                        {journey}
                                />
                            </div>
                        {/each}
                        <JourneyPane
                                journey={$departures.journeys[$departures.journeys.length - 1]}
                                isLastTrain={true}
                        />
                    {/if}
                </div>
            </section>
        {:else if $departures && $departures.journeys.length === 0}
            <section class="section">
                <article class="message is-info">
                    <div class="message-header">
                        <p>No departures found today</p>
                        <button class="delete" aria-label="delete"></button>
                    </div>
                    <div class="message-body">
                        No departures to {selectedDestination?.station} ({selectedDestination?.code}) could be found
                        today.
                        Consult official sources for travel information.
                    </div>
                </article>
            </section>
        {/if}
    </main>

    <footer class="footer mt-6">
        <div class="content has-text-centered">
            <p>
                <strong>Tip:</strong> Bookmark this page
                to quickly check departures to your destination in future.
            </p>
            <p>
                euston.wtf is a just-for-fun side project. Site and webapp &copy; Richard North {currentYear}.
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
    .ellipsis {
        list-style-type: none;
        text-align: center;
    }
</style>
