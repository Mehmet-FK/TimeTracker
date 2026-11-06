# Disabled workflows

GitHub runs only files in `.github/workflows/`. These workflows came from upstream Super
Productivity (store, Docker, Cloudflare and TestFlight publishing, issue bots, scheduled jobs)
and need secrets or accounts this fork does not have, or would publish on its behalf.
`dependabot.yml` is here too (it named the upstream maintainer as reviewer).

To enable one again, move it back to `.github/workflows/` (`dependabot.yml` back to `.github/`)
and check its triggers and secrets first.
