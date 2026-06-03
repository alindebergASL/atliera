# Runtime Model-Only Live Transport Harness

Status: no-call harness contract. This PR does not execute a provider call.

The harness defines the contract for a future injected model-only live transport without performing live provider access. It validates response fixtures only and never calls an injected transport function.

Required boundary:
- exact top-level request shape
- exact top-level response shape
- synthetic request input graph ref
- synthetic prompt contract ref
- no tools
- no shell
- no file access
- no web search
- no plugins
- no MCP
- no retrieval
- safe provider/model logical IDs with no slash characters
- plain own-data objects only; no prototype-backed fields, accessors, symbols, or non-enumerable smuggling
- response cost must remain within the approved cap

Safety markers:
- provider_calls_executed: 0
- provider_spend: false
- authorizes_provider_call: false
- authorizes_candidate_calls: false
- authorizes_comparison_run: false
- model_only_live_transport_implemented: false

Interpretation:
- This proves only the no-call harness boundary with fake transport injection.
- It does not prove a live transport.
- It does not authorize a live proof.
- A future live proof still requires a fresh approval packet and private raw evidence outside the repository.
