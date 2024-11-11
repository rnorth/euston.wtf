import {defineConfig} from 'vite'
import {svelte} from '@sveltejs/vite-plugin-svelte'
import Sitemap from 'vite-plugin-sitemap'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        svelte(),
        Sitemap({
            hostname: 'https://euston.wtf',
        })
    ],
})
