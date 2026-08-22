import {mount} from 'svelte'
import './app.css'
import App from './App.svelte'
import {get, minObservations} from './lib/history'

const app = mount(App, {
    target: document.getElementById('app')!,
})

// Dev console hook for experimenting with the history display, e.g.:
//   __euston.minObservations      - read the current minimum-observations threshold
//   __euston.minObservations = 1  - show history from just one observed departure
//   __euston.minObservations = 7  - back to the default
window.__euston = {
    get minObservations() {
        return get(minObservations);
    },
    set minObservations(value: number) {
        minObservations.set(value);
    },
}

export default app
