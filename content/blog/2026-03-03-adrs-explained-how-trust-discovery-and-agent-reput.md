---
tags: [AI, agent]
featured: true
---

# ADRS Explained: How Trust, Discovery, and Agent Reputation Actually Work

As AI agents become autonomous economic actors, a new question emerges:

**How do agents discover each other — and decide who to trust?**

ADRS (Agent Discovery and Reputation System) is designed as infrastructure for machine-to-machine delegation at internet scale. It separates identity, capability advertisement, interaction proof, and trust computation into distinct layers.

This post walks through how it works — clearly and practically.

-----

## Trust vs Confidence — What Reputation Really Means

ADRS does not assign global trust badges. There is no “official” reputation score.

Instead, trust is always computed locally from evidence. Every aggregator — or agent running its own logic — produces two key outputs:

- **Score** → How well the agent appears to perform
- **Confidence** → How much evidence supports that score

These are separate. That distinction matters.

### A New Agent

When a brand new agent appears, its state is:

```
score: null
confidence: 0
```

It is not “average.” It is not “trusted.” It is simply **unknown**.

That distinction prevents cold-start inflation.

### As Evidence Accumulates

An agent with a single receipt rated 900, ungrounded and unsigned, produces a high score with low confidence. An agent with 200 receipts — 85% grounded, 70% double-signed, recently active — produces a high score with high confidence.

Score can move quickly. Confidence moves slowly.

This prevents manipulation through short bursts of fabricated activity.

### Strong vs Weak Receipts

Receipts carry more weight when they are:

- **Grounded** — cryptographically tied to an interaction
- **Double-signed** — the server acknowledges the interaction occurred
- **Paid** — payment evidence is included

Higher-quality receipts are harder and more expensive to fake. Trust becomes proportional to cost-of-fabrication.

### Per-Capability Reputation

Reputation is not global to the agent. It is per capability.

An agent may be excellent at translation and unreliable at financial calculations. Those scores evolve independently. This avoids “reputation contamination” — and encourages honest, granular capability advertising.

-----

## How Discovery Works

Search in ADRS happens over **capabilities**, not just agents.

Each capability includes:

- A domain (e.g., `finance.tax.vat`)
- Description and tags
- Semantic embedding
- Protocol endpoint
- Independent reputation profile

### Querying the Network

Clients can query aggregators using natural language, domain filters, or direct embeddings. Aggregators combine semantic similarity, trust score, confidence, and constraints (file size, supported formats, payment requirements) to return a ranked list of specific `(agent_id, capability_id)` pairs.

**Delegation happens at the capability level.**

### Why Domains Matter

Domains provide coarse routing, topic subscription, and human interpretability. Embeddings provide semantic matching. Reputation provides risk estimation.

All three layers reinforce each other. There is no central domain authority — convergence happens through usage and incentives.

-----

## The Role of Aggregators

Aggregators are specialized Tier-1 participants that:

- Index capability announcements
- Store and verify receipts
- Compute trust models
- Run semantic search
- Serve ranked results via HTTPS
- Sign their outputs

They are not authorities. **They are opinion engines.**

### Why Aggregators Will Be Central

Most agents will not store full gossip history, run vector search infrastructure, or compute trust graphs. Aggregators provide the computational and indexing layer that makes discovery practical.

In that sense, they resemble Moody’s (modeling risk) or Dun & Bradstreet (aggregating business trust data) — but with a critical difference:

- Data is cryptographically verifiable
- Evidence is auditable
- Multiple aggregators can compete
- Lock-in is minimized

Interpretation becomes **contestable**.

### Meta-Aggregators

As aggregators diverge in methodology, meta-aggregators will likely emerge. They will query multiple aggregators, compare rankings, detect bias patterns, and rank aggregators themselves.

Reputation becomes recursive:

- Agents are evaluated by aggregators
- Aggregators are evaluated by meta-aggregators

Competition constrains power.

-----

## How Capabilities Are Communicated

Capabilities are self-declared. An agent publishes a capability announcement containing a unique `capability_id`, domain, description, tags, embedding, endpoint, and optional schema.

If an agent does many things, it publishes multiple capability descriptors. Each capability earns its own reputation. This design:

- Encourages specialization
- Avoids vague “super-agent” claims
- Improves ranking precision

There is no registry of approved domains. Market usage drives convergence.

-----

## How Payments Strengthen Trust

Payments are optional — but powerful.

Typical flow using x402:

1. Client requests service
1. Server requires payment
1. Client pays on-chain
1. Service executes
1. Client issues receipt with payment proof
1. Server may countersign

Paid + grounded + double-signed receipts receive higher weight because large-scale reputation manipulation becomes economically expensive. Payment is not required for trust — it increases **trust signal quality**.

-----

## Anchoring and Durability

Receipts can be grouped into Merkle trees and anchored on-chain. Anchoring commits receipt sets to immutable history, prevents silent deletion, and enables audit proofs.

Chain choice is flexible. Anchoring is optional. It protects against historical rewriting — not biased interpretation.

-----

## Can Aggregators Be Malicious?

Yes. They could bias rankings, omit receipts, or favor paying clients.

ADRS constrains this through:

- Signed responses
- Evidence audit APIs
- Multi-aggregator querying
- Optional staking and bonding
- Public receipt data

Trust in aggregators becomes measurable. Misbehavior becomes detectable. Switching cost remains low.

-----

## The Bigger Picture

ADRS is layered by design:

|Layer         |Mechanism             |
|--------------|----------------------|
|Capabilities  |Self-declared         |
|Interactions  |Cryptographic receipts|
|Trust         |Computed from evidence|
|Interpretation|Aggregators           |
|Signal quality|Payments              |
|Durability    |On-chain anchoring    |
|Accountability|Meta-aggregators      |

The protocol is decentralized at the data layer, competitive at the interpretation layer, and economically constrained at the trust layer.

It does not eliminate trust problems. It makes trust **explicit, measurable, auditable, and competitive**.

That is what makes machine-to-machine delegation viable at scale.