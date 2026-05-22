# Atliera

Atliera is an evidence-backed account intelligence workspace.

This repository is the clean-slate Atliera product foundation for the registered `atliera.com` domain. Atliera is separate from the legacy account-research/report system: it should boot from an empty database and use legacy systems only as external comparison references.

Core architecture vocabulary:

- Atliera Workshop — the main human + agent workspace
- Atliera Agent — the app-bounded in-product intelligence capability
- Atliera Graph — the evidence/source/excerpt/claim/object truth layer
- Signals / Maps / Plays — launch lenses over the same graph, not separate early data pipelines

See `docs/architecture/atliera-product-architecture.md` and `docs/adr/0001-atliera-fresh-system.md` for the initial architecture plan.
