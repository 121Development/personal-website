---
tags: [AI, agent]
---

# ADRS: Agent Discovery and Reputation System

![](/images/blog/2026-03-02-adrs-agent-discovery-and-reputation-system.jpg)

**Protocol Specification — v0.5 (Public Draft)**

**Authors:** Erik Eliasson
**Created:** 2026-02-26
**Revised:** 2026-03-01
**Status:** Public Draft
**Discussion:** TBD

---

## Abstract

ADRS is a peer-to-peer protocol for agent discovery and reputation that requires nothing more than a keypair and an internet connection to participate. It provides a decentralized alternative to centralized agent directories and a lower barrier to entry than on-chain registry systems, while remaining fully compatible with blockchain-based identity and reputation standards such as ERC-8004.

ADRS is infrastructure for machine-to-machine delegation at internet scale.

The protocol is organized in layers: free, ephemeral, and fast at the base; permanent, economic, and verifiable at the top. Agents choose their level of participation based on their needs.

ADRS is best understood as a **probabilistic routing layer for delegation**: discovery answers “who might do this?”, reputation answers “how risky is delegation to them in my context?”, and payments and anchors answer “what collateral signals reduce that risk?” The system is honest about uncertainty and does not attempt to produce a single universal truth score.

---

## 1. Motivation

### 1.1 The Discovery Gap

Agent communication protocols — MCP, A2A, and others emerging — solve how agents talk to each other. They do not solve how agents find each other. Current approaches:

**Centralized directories.** Simple and fast but introduce a single point of failure, a gatekeeper, and a scaling bottleneck.

**On-chain registries.** Standards like ERC-8004 provide censorship resistance and permanence but require a wallet, gas, and on-chain tooling before an agent can be discovered.

Neither addresses the fundamental need: **zero upfront cost**, **zero gatekeepers**, **zero infrastructure dependencies**.

### 1.2 Lessons from File-Sharing Networks

The evolution from Napster through Gnutella to BitTorrent/DHT demonstrates that a protocol with zero participation cost, implicit reputation, and optional infrastructure upgrades can scale to hundreds of millions of nodes. ADRS applies these principles to agent ecosystems.

### 1.3 Design Principles

1. **Zero-cost entry.** A keypair is all you need.
2. **Participation tiers.** A single HTTP call at the floor; full P2P node at the ceiling.
3. **Communication-protocol agnostic.** How agents talk once connected is out of scope.
4. **Blockchain-optional.** On-chain anchoring is a trust upgrade, not a prerequisite.
5. **Reputation is subjective.** No global score. Trust is computed locally.
6. **Honest about uncertainty.** Results are ranked candidates, not guaranteed answers.
7. **One way to do each thing.** One signing model, one hash format, one encoding convention.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Layer 4: Anchoring                                 │
│  Optional on-chain checkpointing (e.g., ERC-8004)    │
│  Merkle roots of receipt batches, staking            │
├─────────────────────────────────────────────────────┤
│  Layer 3: Reputation                                │
│  Interaction receipts, gossip propagation            │
│  Local trust graphs, EigenTrust-local                │
├─────────────────────────────────────────────────────┤
│  Layer 2: Discovery                                 │
│  Capability announcements, topic-based gossip        │
│  Reputation aggregators, semantic matching           │
├─────────────────────────────────────────────────────┤
│  Layer 1: Identity & Presence                        │
│  Ed25519 keypairs, gossip mesh (libp2p GossipSub)    │
│  Bootstrap peers, optional trust anchors             │
└─────────────────────────────────────────────────────┘
```

### 2.1 Participation Tiers

**Tier 1 — Full Nodes.** Run libp2p, participate in gossip, store/validate messages, and compute trust locally. Aggregators operate here.

**Tier 2 — Light Nodes.** Publish announcements and sign reputation messages, but rely on aggregators for discovery.

**Tier 3 — Clients Only.** Use HTTPS to aggregators. Minimum integration is one HTTP request.

---

## 3. Encoding and Conventions (Normative)

These rules apply throughout ADRS. Implementations MUST follow them exactly.

### 3.1 Hash Identifiers

All hash values use **multihash** encoding. No exceptions.

Default hash function: SHA-256 (multihash function code `0x12`, digest length 32 bytes).

**In JSON:** multihash bytes MUST be encoded as base64url without padding, prefixed with multibase `u`:

```
"uEiB..."   ← 'u' + base64url(multihash_bytes)
```

**In binary contexts** (signature inputs, Merkle leaf inputs): raw multihash bytes with **no** multibase prefix.

Implementations MUST NOT use `sha256:` strings, hex-encoded digests (except where explicitly permitted), or any ad hoc format.

### 3.2 Canonicalization

All payloads are canonicalized using **RFC 8785 JSON Canonicalization Scheme (JCS)** before hashing or signing.

* **Embeddings:** base64url (unpadded) of packed float32 **little-endian** bytes.
* **Ratings, scores, trust values:** integers in `[0, 1000]` representing thousandths.
* **Timestamps:** ISO 8601 UTC, second precision, trailing `Z`. No milliseconds, no offsets.

### 3.3 Agent Identity Encoding

Agent IDs MUST be **Bech32m** (BIP-350) encoding of the agent’s **Ed25519 public key bytes** (32 bytes), with human-readable prefix `adrs`.

Implementations MUST reject non-Bech32m encodings.

### 3.4 Base64url

All base64url is **unpadded** (no `=`), per RFC 4648 §5.

### 3.5 Hex Encoding (Single Exception)

`pow.nonce` is hex-encoded bytes (lowercase, no `0x` prefix).
This is the only field in ADRS that uses hex encoding.

---

## 4. Wire Protocol (Normative)

### 4.1 Message Envelope

All ADRS messages share a single envelope. There is **exactly one signature per message**, on the envelope. Payloads MUST NOT contain signature fields.

```json
{
  "msg_id": "<multihash of JCS(payload)>",
  "prev": "<msg_id of previous message in this chain> | null",
  "payload": { ... },
  "pow": { ... },
  "sig": "<Ed25519 signature over msg_id raw bytes>"
}
```

| Field     | Required | Description                                                     |
| --------- | -------- | --------------------------------------------------------------- |
| `msg_id`  | MUST     | Multihash(SHA-256, JCS(payload)). Canonical message identifier. |
| `prev`    | MAY      | Hash-chain link (Section 4.2).                                  |
| `payload` | MUST     | Message content for the message type.                           |
| `pow`     | MAY      | Proof-of-work stamp (Section 4.5).                              |
| `sig`     | MUST     | Ed25519 signature over raw `msg_id` multihash bytes.            |

**Signature authority rule (absolute):**

> For all ADRS message types, the envelope `sig` MUST verify against the Ed25519 public key encoded by `payload.agent_id`. No other signer model is permitted.

**Verification procedure:**

1. Extract `payload`.
2. Compute `JCS(payload)` → canonical bytes.
3. Compute `multihash(SHA-256, canonical_bytes)` → expected `msg_id`.
4. Verify the envelope `msg_id` equals expected `msg_id`.
5. Decode `payload.agent_id` (Bech32m) → Ed25519 public key bytes.
6. Verify `sig` over raw `msg_id` multihash bytes using that public key.
7. If `pow` present, verify per Section 4.5.

### 4.2 Hash Chains (`prev`)

`prev` links form ordering chains per `(agent_id, message_type)` pair.

**Rules:**

* First message of a given type: `prev: null`.
* Subsequent messages: SHOULD set `prev` to the most recent prior `msg_id` of the same type from the same agent.
* `prev` is an ordering hint and MUST NOT be treated as consensus.

**Conflict resolution (normative):**

> If two valid messages claim the same `prev` (a fork), the canonical tip is the one with the **lexicographically greater `msg_id`** compared as raw bytes.

### 4.3 Transport

ADRS Tier 1/2 communication uses libp2p.

| Protocol                     | Purpose                |
| ---------------------------- | ---------------------- |
| `/noise`                     | Encrypted transport    |
| `/yamux/1.0.0`               | Stream multiplexing    |
| `/meshsub/1.1.0` (GossipSub) | Topic-based pub/sub    |
| `/kad/1.0.0` (Kademlia)      | Peer discovery and DHT |
| `/adrs/identity/1.0.0`       | Identity exchange      |

Tier 3 uses HTTPS to aggregators (Section 6.4).

### 4.4 GossipSub Topics and Routing

Topics are flat strings. ADRS uses a multi-publish rule to approximate hierarchy.

**Multi-publish rule (normative):**
Publishing to domain `a.b.c` MUST also publish to `a.b` and `a`. Max depth = 3 segments.

**Topic formats (normative):**

* Capability announcements: `adrs/v1/capabilities/{domain}`
* Receipts and receipt-related messages: `adrs/v1/receipts/{domain}`
* Endorsements: `adrs/v1/endorsements`
* Anchor sets: `adrs/v1/anchors`

**Domain derivation for receipts (normative):**

* For `interaction-receipt`, `countersignature`, `receipt-summary`, and `receipt-response`, the `{domain}` used for gossip MUST be the `domain` of the referenced capability announcement for `capability_id`.
* If the domain cannot be resolved, the message MUST be published to `adrs/v1/receipts/unknown`.

### 4.5 Proof of Work

PoW is computed over `msg_id` and stored outside the payload.

```json
"pow": {
  "algorithm": "sha256",
  "nonce": "000000000000302b",
  "difficulty": 16,
  "hash": "uEiAAAEn7FBUeHEe8VKlCtFuEmgQJKxT4A3dnstS0ePcWZg"
}
```

**Computation (normative):**

1. Compute `msg_id_raw_bytes` (the raw multihash bytes of `msg_id`).
2. Find `nonce_bytes` such that `SHA-256(msg_id_raw_bytes || nonce_bytes)` has ≥ `difficulty` leading zero bits.
3. Let `digest = SHA-256(msg_id_raw_bytes || nonce_bytes)`.
4. `pow.hash` MUST equal `multihash(SHA-256, digest)` encoded per Section 3.1.

**Verification (normative):**

1. Decode `msg_id` → raw multihash bytes.
2. Decode `pow.nonce` from hex → `nonce_bytes`.
3. Compute `digest = SHA-256(msg_id_raw_bytes || nonce_bytes)`.
4. Verify leading zero bits ≥ `difficulty`.
5. Verify `pow.hash == multihash(SHA-256, digest)`.

### 4.6 Message Size and Field Constraints

GossipSub messages MUST be ≤ **64 KiB**.

For capability announcements:

| Field                | Constraint                                     |
| -------------------- | ---------------------------------------------- |
| `capabilities` array | max 10                                         |
| `description`        | max 500 UTF-8 chars                            |
| `tags`               | max 20; each max 50 chars                      |
| `embedding`          | exactly 256 dims (1024 bytes before base64url) |
| `constraints`        | max 2 KiB serialized                           |
| `protocols` map      | max 10 entries; each value max 1 KiB           |

### 4.7 Anti-Spam and Rate Limiting

**Scope:** per `(agent_id, message_type, root_domain)` where `root_domain` is the first segment of `{domain}`.

| Type                       | Limit            | Burst        |
| -------------------------- | ---------------- | ------------ |
| Capability announcements   | 1/min per scope  | 3 on startup |
| Receipts & receipt-related | 10/min per agent | —            |
| Endorsements               | 5/min per agent  | —            |

**Announcement TTL bounds:** `[300, 86400]` seconds.

**Aggregator operational guidance (normative guidance):** Aggregators SHOULD apply additional rate limits based on IP address, peer ID, stake anchor presence, and receipt-quality signals.

### 4.8 Time and Clock Skew

* Peers MUST accept timestamps up to **5 minutes in the future**.
* Messages more than **5 minutes in the future** MUST be dropped.
* Announcements older than `timestamp + ttl` SHOULD be dropped.
* Receipts older than **90 days** SHOULD be dropped (configurable).

Bucketed receipt timestamps MAY be used (hour boundaries) for privacy.

---

## 5. Layer 1: Identity and Presence

### 5.1 Agent Identity

Agents are identified by an Ed25519 public key. The agent exists upon key generation.

### 5.2 Trust Anchors

Optional external bindings:

| Type      | Proves                | Verification                                 |
| --------- | --------------------- | -------------------------------------------- |
| `eip8004` | On-chain identity     | Verify registry ownership on specified chain |
| `dns`     | Domain control        | TXT record or `/.well-known/adrs.json`       |
| `ens`     | ENS ownership         | On-chain resolution                          |
| `x509`    | Organization identity | Certificate chain validation                 |

### 5.3 Presence

Tier 1/2 agents:

1. Connect to bootstrap peers.
2. Establish peer connections via DHT/PEX/mDNS.
3. Subscribe to relevant topics.
4. Publish capability announcements.

Tier 3 agents use aggregator HTTPS only.

---

## 6. Layer 2: Discovery

### 6.1 Capability Announcements

Payload:

```json
{
  "protocol": "adrs/v1",
  "type": "capability-announcement",
  "agent_id": "adrs1...",
  "timestamp": "2026-03-01T14:30:00Z",
  "ttl": 3600,
  "capabilities": [
    {
      "id": "cap_bgremove_v2",
      "domain": "image-processing.segmentation",
      "tags": ["background-removal", "transparency", "png", "webp"],
      "description": "Remove backgrounds from images with transparency support",
      "embedding": "<base64url(1024 bytes float32le)>",
      "embedding_suite": "adrs-embeddings/2026-03-01",
      "protocols": {
        "mcp": { "endpoint": "https://bgremove.agent/mcp", "version": "2025-06-18" }
      },
      "schema": { "type": "mcp-tools", "uri": "https://bgremove.agent/mcp/schema.json", "hash": "uEiB..." },
      "constraints": { "max_file_size_mb": 50, "supported_formats": ["png", "jpg", "webp"] }
    }
  ],
  "trust_anchors": { "dns": "bgremove.agent" },
  "payment": { "x402": { "endpoint": "https://bgremove.agent/.well-known/x402-manifest.json" } }
}
```

Field requirements are as in your v0.5 text (retained), with the added constraint:

**`capabilities[].domain`** MUST be present for every capability and MUST be used for gossip topics (Section 4.4).

### 6.2 Capability Domains

Dot-notation, lowercase, hyphenated.

Reserved prefixes:

* `adrs.*` protocol-level
* `org.*` organization namespaces
* `vendor.*` vendor namespaces

Aggregator taxonomies MAY exist but are advisory.

### 6.3 Embedding Suites (Pinned)

Embedding suites are identified as `adrs-embeddings/{YYYY-MM-DD}`.

#### 6.3.1 Reference Suite for ADRS v0.5

**Suite ID:** `adrs-embeddings/2026-03-01`

**Model (normative):**

* SentenceTransformers-compatible model: `google/embeddinggemma-300M` ([Google AI for Developers][1])
* Output representation: use the model’s Matryoshka representation and **produce exactly 256 dimensions** by taking the **first 256 float32 values** of the model output vector. ([Google AI for Developers][1])
* Normalization: vectors MUST be L2-normalized prior to truncation and encoding (SentenceTransformers `Normalize()` behavior).

**Query/document prompting (normative):**

* For query embeddings: prefix with `task: retrieval | query: `
* For document embeddings: prefix with `task: retrieval | document: `
* The embedding input text to the model is exactly the prefix + the UTF-8 text.

**Encoding (normative):**

* Pack the 256 float values as float32 little-endian bytes (1024 bytes).
* Encode as base64url unpadded (Section 3.4).

Agents MAY omit embeddings (tags/domains remain baseline), but if `embedding` is present then `embedding_suite` MUST be present and MUST match a suite the receiver supports.

Aggregators MUST declare supported suites (e.g., in their own capability announcement constraints) and SHOULD support at least the two most recent suites.

---

## 6.4 Reputation Aggregators

Aggregators are Tier 1 agents that provide discovery and trust scoring over HTTPS.

Aggregators MUST publish a capability announcement with at least one capability in domain `adrs.aggregator`.

### 6.4.1 Discovery Query API (HTTPS)

**Endpoint:** `POST /adrs/v1/discover`
**Request body:** arbitrary JSON, but MUST include:

* `max_results` (integer ≥ 1)
* `constraints` (object; MAY be empty)
* either `query` (string) or `query_embedding` + `embedding_suite`

**Response body (normative minimum):**

```json
{
  "results": [
    {
      "agent_id": "adrs1...",
      "capability_id": "cap_...",
      "relevance_score": 0,
      "trust": {
        "score": 0,
        "confidence": 0,
        "data_coverage": {
          "receipts_count": 0,
          "unique_clients": 0,
          "grounded_pct": 0,
          "double_signed_pct": 0,
          "paid_pct": 0,
          "recency_window_days": 0
        }
      },
      "evidence": ["uEiB...", "uEiB..."],
      "protocols": { }
    }
  ],
  "aggregator_id": "adrs1...",
  "timestamp": "2026-03-01T14:31:00Z"
}
```

**Signing (normative):**

* The aggregator MUST return the response as an ADRS envelope where:

  * `payload` is exactly the JSON response body above,
  * `payload.agent_id` MUST equal `aggregator_id`,
  * the envelope `sig` MUST validate per Section 4.1.

### 6.4.2 Evidence Audit API (HTTPS)

**Endpoint:** `POST /adrs/v1/evidence`
**Request body:**

```json
{ "msg_ids": ["uEiB..."], "requester_id": "adrs1..." }
```

**Response body:**

```json
{
  "receipts": [
    { "msg_id": "uEiB...", "status": "available", "envelope": { ... } },
    { "msg_id": "uEiB...", "status": "summary_only", "summary": { ... } },
    { "msg_id": "uEiB...", "status": "requires_auth", "auth_endpoint": "..." },
    { "msg_id": "uEiB...", "status": "unavailable", "reason": "..." }
  ]
}
```

Aggregators MUST NOT fabricate or modify receipts. Clients verify each returned envelope independently.

### 6.4.3 Multi-Aggregator Queries

Clients SHOULD consult ≥ 2 independent aggregators for high-stakes delegation.

### 6.4.4 Aggregator Economics

Aggregators MAY charge (x402 or other). Pay-to-rank is prohibited: aggregators MUST NOT improve ranking solely due to payment unrelated to query execution (e.g., “listing fees”).

---

## 6.5 Capability Schemas

```json
"schema": { "type": "mcp-tools", "uri": "...", "hash": "uEiB..." }
```

* `hash` is REQUIRED unless `uri` is content-addressed (e.g., `ipfs://...`).
* Well-known `type`: `mcp-tools`, `openapi`, `jsonschema`, `proto`, `a2a-skills`.

---

## 7. Layer 3: Reputation

### 7.1 Interaction Tokens

Servers SHOULD issue an interaction token as an ADRS message:

```json
{
  "protocol": "adrs/v1",
  "type": "interaction-token",
  "agent_id": "adrs1srv...",
  "client_id": "adrs1cli...",
  "capability_id": "cap_...",
  "timestamp": "2026-03-01T15:00:00Z",
  "challenge": "<64 hex chars>"
}
```

`challenge` MUST be 32 random bytes hex-encoded (lowercase, no `0x`).

Tokens are not gossiped by default.

### 7.2 Interaction Receipts

Client-signed ADRS messages:

```json
{
  "protocol": "adrs/v1",
  "type": "interaction-receipt",
  "agent_id": "adrs1cli...",
  "server_id": "adrs1srv...",
  "capability_id": "cap_...",
  "timestamp": "2026-03-01T15:05:00Z",
  "rating": 870,
  "grounding": {
    "interaction_token_msg_id": "uEiB...",
    "result_commitment": "uEiB...",
    "challenge_response": "uEiB..."
  }
}
```

Canonical identifier is the envelope `msg_id`.

### 7.2.1 Result Commitment (Normative)

Commitment is the multihash of the service response:

* Raw bytes: `multihash(SHA-256, raw_bytes)`
* JSON: `multihash(SHA-256, JCS(json))`
* Streaming: `multihash(SHA-256, frame_count_u32le || len_u32le || bytes || ...)`

No size shortcuts. All responses are hashed in full.

### 7.2.2 Countersignatures

Server MAY publish a countersignature:

```json
{
  "protocol": "adrs/v1",
  "type": "countersignature",
  "agent_id": "adrs1srv...",
  "receipt_msg_id": "uEiB...",
  "timestamp": "2026-03-01T15:06:00Z"
}
```

### 7.3 Receipt Privacy

* **Public receipt:** gossip full receipt envelope.
* **Receipt summary:** gossip summary + keep full receipt private.
* **Private receipt:** do not gossip.

Summary verification rules remain as in your v0.5, with one clarification:

**Countersignature existence check (normative):** `double_signed` is true iff at least one valid countersignature envelope exists whose payload `receipt_msg_id` equals the full receipt `msg_id`.

### 7.4 Receipt Responses

Server MAY publish a response:

```json
{
  "protocol": "adrs/v1",
  "type": "receipt-response",
  "agent_id": "adrs1srv...",
  "receipt_msg_id": "uEiB...",
  "response": "Refund issued...",
  "evidence_uri": "ipfs://...",
  "evidence_hash": "uEiB..."
}
```

### 7.5 Trust Computation

The trust output schema and recency weighting remain as in your v0.5 and are normative for aggregators.

---

## 8. Layer 4: Anchoring

### 8.1 Anchor Sets

Anchor sets are ADRS messages published on topic `adrs/v1/anchors` and MAY be checkpointed on-chain.

Aggregate statistics are informational and MUST NOT be trusted without receipt inclusion proofs.

### 8.2 Merkle Tree Construction (Normative)

* Leaf input is `msg_id_raw_bytes` (raw multihash bytes).
* Leaf hash: `SHA-256(0x00 || msg_id_raw_bytes)` → 32 bytes.
* Sort leaves lexicographically by `msg_id_raw_bytes`.
* Inner hash: `SHA-256(0x01 || left || right)` where children are raw 32-byte digests.
* Odd node is promoted (not duplicated).
* Only final root digest is wrapped as multihash for storage.

**Empty tree root (normative):**

* `root_digest = SHA-256("")`
* `root = multihash(SHA-256, root_digest)` encoded per Section 3.1

### 8.3 Announcements Digest (Normative)

Compute `multihash(SHA-256, concat(sorted(announcement_msg_id_raw_bytes)))`. Empty set uses empty concatenation (`""`).

### 8.4 On-Chain Checkpointing (Optional)

Anchors MAY be checkpointed on-chain by publishing:

* `receipts_root`
* `responses_root`
* `announcements_digest`
* `period`

The chain and method are out of scope; ERC-8004 is a supported option.

### 8.5 Cross-Network Verification

A verifier MAY request receipts and Merkle proofs from an anchor publisher and apply verified receipts with a recommended cross-network discount of 0.5x.

---

## 9. Security Considerations

Sybil resistance is provided by:

* local trust graphs and subjective computation,
* receipt grounding and double-signing,
* anchor priors and (optional) economic stake,
* multi-aggregator corroboration,
* libp2p peer scoring and rate limits.

---

## 10. Payment Integration

Payments are orthogonal but strengthen trust signals.

Supported payment identifiers include `x402`, `lightning`, `stripe`, `free`. Payment verification methodology is aggregator-defined.

---

## 11. Implementation Guidelines

### 11.1 Minimum Viable (Tier 3)

(unchanged)

### 11.2 Reference Implementations

Recommended: Rust (Tier 1), TypeScript (Tier 2/3), Python (Tier 2/3).

### 11.3 Versioning

Protocol version is in:

* topic strings `adrs/v1/...`
* payload field `protocol: "adrs/v1"`

Clients MAY subscribe to multiple versions during migration.

[1]: https://ai.google.dev/gemma/docs/embeddinggemma/inference-embeddinggemma-with-sentence-transformers "Generate Embeddings with Sentence Transformers  |  Gemma  |  Google AI for Developers"
