---
tags: [AI, agent]
featured: true
---

# ADRS: Agent Discovery and Reputation System

![](/images/blog/2026-03-02-adrs-agent-discovery-and-reputation-system.jpg)

**Protocol Specification — v0.7 (Public Draft)**

**Authors:** Erik Eliasson  
**Created:** 2026-02-26  
**Revised:** 2026-03-14  
**Status:** Public Draft  
**Discussion:** TBD

---

## Abstract

ADRS is a peer-to-peer protocol for agent discovery and reputation that requires nothing more than a keypair and an internet connection to participate. It provides a decentralized alternative to centralized agent directories and a lower barrier to entry than on-chain registry systems, while remaining compatible with blockchain-based identity and reputation standards such as ERC-8004.

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

The evolution from Napster through Gnutella to BitTorrent/DHT demonstrates that a protocol with zero participation cost, implicit reputation, and optional infrastructure upgrades can scale to very large networks. ADRS applies these principles to agent ecosystems.

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

```text
┌─────────────────────────────────────────────────────┐
│  Layer 4: Anchoring                                │
│  Optional on-chain checkpointing (e.g., ERC-8004)  │
│  Merkle roots of receipt batches, staking          │
├─────────────────────────────────────────────────────┤
│  Layer 3: Reputation                               │
│  Interaction receipts, gossip propagation          │
│  Local trust graphs, EigenTrust-local              │
├─────────────────────────────────────────────────────┤
│  Layer 2: Discovery                                │
│  Capability announcements, topic-based gossip      │
│  Reputation aggregators, semantic matching         │
├─────────────────────────────────────────────────────┤
│  Layer 1: Identity & Presence                      │
│  Ed25519 keypairs, gossip mesh (libp2p GossipSub)  │
│  Bootstrap peers, optional trust anchors           │
└─────────────────────────────────────────────────────┘
```

### 2.1 Participation Tiers

**Tier 1 — Full Nodes.** Run libp2p, participate in gossip, store and validate messages, and compute trust locally. Aggregators operate here.

**Tier 2 — Light Nodes.** Publish announcements and sign ADRS messages, but rely on aggregators for discovery.

**Tier 3 — Clients Only.** Use HTTPS to aggregators. Minimum integration is one HTTP request.

---

## 3. Encoding and Conventions (Normative)

These rules apply throughout ADRS. Implementations MUST follow them exactly.

### 3.1 Hash Identifiers

All hash values use **multihash** encoding. No exceptions.

Default hash function: SHA-256 (multihash function code `0x12`, digest length 32 bytes).

**In JSON:** multihash bytes MUST be encoded as base64url without padding, prefixed with multibase `u`:

```json
"uEiB..."
```

**In binary contexts** (signature inputs, Merkle leaf inputs, proof inputs): raw multihash bytes with **no** multibase prefix.

Implementations MUST NOT use `sha256:` strings, hex-encoded digests except where explicitly permitted, or ad hoc formats.

### 3.2 Canonicalization

All JSON payloads and signing objects are canonicalized using **RFC 8785 JSON Canonicalization Scheme (JCS)** before hashing or signing.

- **Embeddings:** base64url unpadded of packed float32 little-endian bytes.
- **Ratings, scores, trust values:** integers in `[0, 1000]` representing thousandths.
- **Timestamps:** ISO 8601 UTC, second precision, trailing `Z`. No milliseconds and no numeric offsets.

### 3.3 Agent Identity Encoding

Agent IDs MUST be **Bech32m** encoding of the agent’s **Ed25519 public key bytes** (32 bytes), with human-readable prefix `adrs`.

Implementations MUST reject non-Bech32m encodings.

### 3.4 Base64url

All base64url is **unpadded**.

### 3.5 Hex Encoding (Limited Exceptions)

The following fields use lowercase hex with no `0x` prefix:

- `pow.nonce`
- `interaction-token.challenge`

No other ADRS field may use hex unless explicitly added in a future version.

---

## 4. Wire Protocol (Normative)

### 4.1 Message Envelope

All ADRS messages share a single envelope.

```json
{
  "msg_id": "<multihash of JCS(id_object)>",
  "prev": "<msg_id of previous message in this chain> | null",
  "payload": { ... },
  "pow": { ... } | null,
  "sig": "<Ed25519 signature over JCS(signing_object)>"
}
```

Where:

- `id_object = { "payload": payload, "prev": prev }`
- `signing_object = { "msg_id": msg_id, "pow": pow_or_null }`

Field order in prose examples is non-normative; JCS determines canonical key ordering.

`sig` signs the canonical bytes of `JCS(signing_object)`.

This means:

- `payload` is authenticated through `msg_id`
- `prev` is authenticated through `msg_id`
- `pow` is authenticated directly by `sig`

Payloads MUST NOT contain signature fields.

| Field     | Required | Description |
| --------- | -------- | ----------- |
| `msg_id`  | MUST     | Multihash(SHA-256, JCS(id_object)). Canonical message identifier. |
| `prev`    | MAY      | Hash-chain link. Use `null` for first message in a chain. |
| `payload` | MUST     | Message content for the message type. |
| `pow`     | MAY      | Proof-of-work stamp. If absent, canonicalize as `null` in signing contexts. |
| `sig`     | MUST     | Ed25519 signature over JCS(signing_object). |

**Signature authority rule (absolute):**

> For all ADRS message types, the envelope `sig` MUST verify against the Ed25519 public key encoded by `payload.agent_id`. No other signer model is permitted.

**Verification procedure:**

1. Extract `prev`, `payload`, and `pow`.
2. Compute `JCS({"payload": payload, "prev": prev})`.
3. Compute `multihash(SHA-256, canonical_bytes)` to obtain expected `msg_id`.
4. Verify envelope `msg_id` equals expected `msg_id`.
5. Compute `JCS({"msg_id": msg_id, "pow": pow_or_null})`.
6. Decode `payload.agent_id` (Bech32m) to Ed25519 public key bytes.
7. Verify `sig` over the canonical bytes from step 5 using that public key.
8. If `pow` is present, verify it per Section 4.5.

### 4.2 Hash Chains (`prev`)

`prev` links form ordering chains per `(agent_id, type)` pair.

**Rules:**

- First message of a given type: `prev: null`.
- Subsequent messages: SHOULD set `prev` to the most recent prior `msg_id` of the same `type` from the same `agent_id`.
- `prev` is an ordering hint and MUST NOT be treated as consensus.

**Conflict resolution (normative):**

> If two valid messages claim the same `prev`, the canonical tip is the one with the lexicographically greater `msg_id` compared as raw bytes.

### 4.3 Transport and Node Identity

ADRS Tier 1 and Tier 2 communication uses libp2p.

| Protocol | Purpose |
| -------- | ------- |
| `/noise` | Required encrypted transport |
| `/yamux/1.0.0` | Required stream multiplexing |
| `/meshsub/1.1.0` | Required topic-based pub/sub |
| `/ipfs/id/1.0.0` | Required peer identify |
| `/adrs/kad/1.0.0` | ADRS DHT / peer discovery |

Tier 3 uses HTTPS to aggregators.

#### 4.3.1 ADRS Identity Binding

For Tier 1 and Tier 2 nodes, the ADRS `agent_id` and the libp2p host identity MUST be bound in one of the following ways:

- **Preferred mode:** the libp2p host key is the same Ed25519 key whose public key bytes encode `payload.agent_id`.
- **Bound mode:** if a distinct libp2p host key is used, the node MUST publish a valid ADRS `peer-binding` message proving the binding.

Tier 1 implementations SHOULD use preferred mode.

#### 4.3.2 Peer Binding Message

```json
{
  "protocol": "adrs/v1",
  "type": "peer-binding",
  "agent_id": "adrs1...",
  "peer_id": "<libp2p peer id>",
  "timestamp": "2026-03-14T12:00:00Z"
}
```

The `peer-binding` message is an ordinary ADRS message and is signed by `agent_id` per Section 4.1.

### 4.4 GossipSub Topics and Routing

Topics are flat strings. ADRS uses a multi-publish rule to approximate hierarchy.

**Multi-publish rule (normative):**
Publishing to domain `a.b.c` MUST also publish to `a.b` and `a`. Maximum depth is 3 segments.

**Topic formats (normative):**

- Capability announcements: `adrs/v1/capabilities/{domain}`
- Receipts and receipt-related messages: `adrs/v1/receipts/{domain}`
- Endorsements: `adrs/v1/endorsements`
- Anchor sets: `adrs/v1/anchors`
- Peer bindings: `adrs/v1/bindings`

**Domain derivation for receipts (normative):**

- For `interaction-receipt`, `countersignature`, `receipt-summary`, and `receipt-response`, the `{domain}` used for gossip MUST be the `domain` of the referenced capability announcement for `capability_id`.
- If the domain cannot be resolved, the message MUST be published to `adrs/v1/receipts/unknown`.

### 4.5 Proof of Work

PoW is computed over `msg_id` and stored outside the payload. `pow` is NOT part of `msg_id` computation.

```json
"pow": {
  "algorithm": "sha256",
  "nonce": "000000000000302b",
  "difficulty": 16,
  "hash": "uEiAAAEn7FBUeHEe8VKlCtFuEmgQJKxT4A3dnstS0ePcWZg"
}
```

**Computation (normative):**

1. Compute `msg_id_raw_bytes`.
2. Find `nonce_bytes` such that `SHA-256(msg_id_raw_bytes || nonce_bytes)` has at least `difficulty` leading zero bits.
3. Let `digest = SHA-256(msg_id_raw_bytes || nonce_bytes)`.
4. `pow.hash` MUST equal `multihash(SHA-256, digest)` encoded per Section 3.1.

**Verification (normative):**

1. Decode `msg_id` to raw multihash bytes.
2. Decode `pow.nonce` from hex to `nonce_bytes`.
3. Compute `digest = SHA-256(msg_id_raw_bytes || nonce_bytes)`.
4. Verify leading zero bits are at least `difficulty`.
5. Verify `pow.hash == multihash(SHA-256, digest)`.

### 4.6 Message Size and Field Constraints

GossipSub messages MUST be at most **64 KiB**.

For capability announcements:

| Field | Constraint |
| ----- | ---------- |
| `capabilities` array | max 10 |
| `description` | max 500 UTF-8 chars |
| `tags` | max 20; each max 50 chars |
| `embedding` | exactly 256 dims (1024 bytes before base64url) |
| `constraints` | max 2 KiB serialized |
| `protocols` map | max 10 entries; each value max 1 KiB |

### 4.7 Anti-Spam and Rate Limiting

**Scope:** per `(agent_id, type, root_domain)` where `root_domain` is the first segment of `{domain}`.

| Type | Limit | Burst |
| ---- | ----- | ----- |
| Capability announcements | 1/min per scope | 3 on startup |
| Receipts and receipt-related | 10/min per agent | — |
| Endorsements | 5/min per agent | — |
| Peer bindings | 2/hour per agent | — |

**Announcement TTL bounds:** `[300, 86400]` seconds.

**Aggregator operational guidance:** Aggregators SHOULD apply additional rate limits based on IP address, peer ID, stake anchor presence, and receipt-quality signals.

### 4.8 Time and Clock Skew

- Peers MUST accept timestamps up to **5 minutes in the future**.
- Messages more than **5 minutes in the future** MUST be dropped.
- Announcements older than `timestamp + ttl` SHOULD be dropped.
- Receipts older than **90 days** SHOULD be dropped unless policy says otherwise.

Bucketed receipt timestamps MAY be used for privacy.

---

## 5. Layer 1: Identity and Presence

### 5.1 Agent Identity

Agents are identified by an Ed25519 public key. The agent exists upon key generation.

### 5.2 Trust Anchors

Optional external bindings:

| Type | Proves | Verification |
| ---- | ------ | ------------ |
| `erc8004` | On-chain identity | Verify registry ownership on specified chain |
| `dns` | Domain control | TXT record or `/.well-known/adrs.json` |
| `ens` | ENS ownership | On-chain resolution |
| `x509` | Organization identity | Certificate chain validation |

### 5.3 Presence

Tier 1 and Tier 2 agents:

1. Connect to bootstrap peers.
2. Establish peer connections via DHT, peer exchange, and local discovery where available.
3. Exchange identify information.
4. Resolve ADRS identity binding.
5. Subscribe to relevant topics.
6. Publish capability announcements.

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

`capabilities[].domain` MUST be present for every capability and MUST be used for gossip topics.

### 6.2 Capability Domains

Dot-notation, lowercase, hyphenated.

Reserved prefixes:

- `adrs.*` protocol-level
- `org.*` organization namespaces
- `vendor.*` vendor namespaces

Aggregator taxonomies MAY exist but are advisory.

### 6.3 Embedding Suites (Pinned)

Embedding suites are identified as `adrs-embeddings/{YYYY-MM-DD}`.

#### 6.3.1 Reference Suite for ADRS v0.7

**Suite ID:** `adrs-embeddings/2026-03-01`

**Model (normative):**

- SentenceTransformers-compatible model: `google/embedding-gemma-300M`
- Produce exactly 256 dimensions by truncating the model output vector to the first 256 float32 values
- Vectors MUST be L2-normalized after truncation and before encoding

**Query/document prompting (normative):**

- Query prefix: `task: retrieval | query: `
- Document prefix: `task: retrieval | document: `

**Encoding (normative):**

- Pack the 256 float values as float32 little-endian bytes
- Encode as base64url unpadded

Agents MAY omit embeddings, but if `embedding` is present then `embedding_suite` MUST also be present and MUST match a suite the receiver supports.

Aggregators MUST declare supported suites and SHOULD support at least the two most recent suites they advertise compatibility with.

### 6.4 Reputation Aggregators

Aggregators are Tier 1 agents that provide discovery and trust scoring over HTTPS.

Aggregators MUST publish a capability announcement with at least one capability in domain `adrs.aggregator`.

#### 6.4.1 Discovery Query API (HTTPS)

**Endpoint:** `POST /adrs/v1/discover`

**Request body:** arbitrary JSON, but MUST include:

- `max_results` (integer >= 1)
- `constraints` (object; MAY be empty)
- either `query` (string) or `query_embedding` plus `embedding_suite`
- `requester_id` SHOULD be included when available

**Response payload (normative minimum):**

```json
{
  "protocol": "adrs/v1",
  "type": "discovery-response",
  "agent_id": "adrs1...",
  "timestamp": "2026-03-01T14:31:00Z",
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
          "paid_claimed_pct": 0,
          "paid_verified_pct": 0,
          "recency_window_days": 0
        }
      },
      "evidence": ["uEiB...", "uEiB..."],
      "protocols": {}
    }
  ]
}
```

**Signing (normative):**

- The HTTP response body MUST be a complete ADRS envelope.
- The envelope `payload` MUST be exactly the discovery-response object above.
- `payload.agent_id` identifies the aggregator and MUST verify the envelope signature per Section 4.1.

#### 6.4.2 Evidence Audit API (HTTPS)

**Endpoint:** `POST /adrs/v1/evidence`

**Request body:**

```json
{ "msg_ids": ["uEiB..."], "requester_id": "adrs1..." }
```

**Response payload:**

```json
{
  "protocol": "adrs/v1",
  "type": "evidence-response",
  "agent_id": "adrs1...",
  "timestamp": "2026-03-01T14:31:10Z",
  "receipts": [
    { "msg_id": "uEiB...", "status": "available", "envelope": { } },
    { "msg_id": "uEiB...", "status": "summary_only", "summary": { } },
    { "msg_id": "uEiB...", "status": "requires_auth", "auth_endpoint": "..." },
    { "msg_id": "uEiB...", "status": "unavailable", "reason": "..." }
  ]
}
```

The HTTP response body MUST be a complete ADRS envelope.

Aggregators MUST NOT fabricate or modify receipts. Clients verify each returned envelope independently.

#### 6.4.3 Multi-Aggregator Queries

Clients SHOULD consult at least 2 independent aggregators for high-stakes delegation.

#### 6.4.4 Aggregator Economics

Aggregators MAY charge for query execution. Aggregators MUST NOT improve ranking solely due to payment unrelated to executing or serving the current query.

### 6.5 Capability Schemas

```json
"schema": { "type": "mcp-tools", "uri": "...", "hash": "uEiB..." }
```

- `hash` is REQUIRED unless `uri` is content-addressed
- Known `type` values: `mcp-tools`, `openapi`, `jsonschema`, `proto`, `a2a-skills`

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

`challenge` MUST be 32 random bytes hex-encoded.

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

- Raw bytes: `multihash(SHA-256, raw_bytes)`
- JSON: `multihash(SHA-256, JCS(json))`
- Streaming: `multihash(SHA-256, frame_count_u32le || len_u32le || bytes || ...)`

No size shortcuts. All committed responses are hashed in full.

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

- **Public receipt:** gossip full receipt envelope
- **Receipt summary:** gossip summary and keep full receipt private
- **Private receipt:** do not gossip

**Countersignature existence check (normative):** `double_signed` is true if and only if at least one valid countersignature envelope exists whose payload `receipt_msg_id` equals the full receipt `msg_id`.

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

The trust output schema and recency weighting are intentionally subjective, but aggregator outputs MUST at minimum expose:

- `score`
- `confidence`
- `data_coverage.receipts_count`
- `data_coverage.unique_clients`
- `data_coverage.grounded_pct`
- `data_coverage.double_signed_pct`
- `data_coverage.paid_claimed_pct`
- `data_coverage.paid_verified_pct`
- `data_coverage.recency_window_days`

Aggregators MUST NOT conflate claimed payments with verified payments. `paid_claimed_pct` measures receipts that assert payment occurred, while `paid_verified_pct` measures receipts for which the aggregator has independently verified payment by a supported payment-verification method. How these are combined into trust is implementation-specific unless pinned by a future profile such as companion proposal AGG-TRUST-001.

---

## 8. Layer 4: Anchoring

### 8.1 Anchor Sets

Anchor sets are ADRS messages published on topic `adrs/v1/anchors` and MAY be checkpointed on-chain.

Aggregate statistics are informational and MUST NOT be trusted without receipt inclusion proofs.

### 8.2 Merkle Tree Construction (Normative)

- Leaf input is `msg_id_raw_bytes`
- Leaf hash: `SHA-256(0x00 || msg_id_raw_bytes)`
- Sort leaves lexicographically by `msg_id_raw_bytes`
- Inner hash: `SHA-256(0x01 || left || right)` where children are raw 32-byte digests
- Odd node is promoted and not duplicated
- Only final root digest is wrapped as multihash for storage

**Empty tree root (normative):**

- `root_digest = SHA-256("")`
- `root = multihash(SHA-256, root_digest)` encoded per Section 3.1

### 8.3 Announcements Digest (Normative)

Compute `multihash(SHA-256, concat(sorted(announcement_msg_id_raw_bytes)))`. Empty set uses empty concatenation.

### 8.4 On-Chain Checkpointing (Optional)

Anchors MAY be checkpointed on-chain by publishing:

- `receipts_root`
- `responses_root`
- `announcements_digest`
- `period`

The chain and method are out of scope.

### 8.5 Cross-Network Verification

A verifier MAY request receipts and Merkle proofs from an anchor publisher and apply verified receipts with a recommended cross-network discount of `0.5x`.

---

## 9. Security Considerations

Sybil resistance is strengthened by:

- local trust graphs and subjective computation
- receipt grounding and double-signing
- anchor priors and optional economic stake
- multi-aggregator corroboration
- libp2p peer scoring and rate limits
- binding between ADRS identity and transport identity

Implementations MUST treat unsigned, unverifiable, or unbound peer claims as untrusted.

---

## 10. Payment Integration

Payments are orthogonal but may strengthen trust signals.

Supported payment identifiers include `x402`, `lightning`, `stripe`, and `free`.

Payment verification methodology is aggregator-defined unless a future ADRS payment profile standardizes it.

---

## 11. Implementation Guidelines

### 11.1 Minimum Viable (Tier 3)

A minimal Tier 3 client needs only:

1. ADRS key generation and `agent_id` derivation
2. HTTPS support for `/adrs/v1/discover`
3. Envelope verification per Section 4.1
4. Optional `/adrs/v1/evidence` verification

### 11.2 Recommended Implementations

Recommended stacks:

- Rust for Tier 1
- TypeScript for Tier 2 and Tier 3
- Python for Tier 2 and Tier 3

### 11.3 Versioning

Protocol version appears in:

- topic strings: `adrs/v1/...`
- payload field: `protocol: "adrs/v1"`

Clients MAY subscribe to multiple versions during migration.

### 11.4 Upgrade Notes from v0.6.1

Compared with v0.5, this version makes the following implementation-critical clarifications:

- `msg_id` is now computed from `{payload, prev}` only, eliminating the `pow` recursion bug
- the signed material now covers `pow`, while `prev` is authenticated through `msg_id`
- aggregator HTTPS responses are first-class ADRS payloads with `payload.agent_id`
- ADRS identity is explicitly bound to libp2p node identity
- ADRS defines its own DHT protocol ID as `/adrs/kad/1.0.0`
- `peer-binding` is introduced for nodes that separate ADRS and libp2p keys
- hex usage is explicitly limited to `pow.nonce` and `interaction-token.challenge`
- companion trust-profile work such as AGG-TRUST-001 remains out of scope for the core wire protocol

---

## 12. Open Questions

The following remain intentionally open for future profiles rather than this core protocol:

- pinned trust computation profiles
- payment verification profiles
- richer aggregator transparency requirements
- receipt-summary standardization details
- formal interoperability with external on-chain registries beyond anchor references
- standardized trust profiles such as AGG-TRUST-001

---

## Appendix A: Canonical Signing Summary

For any ADRS envelope `E`:

1. Construct `id_object = {payload, prev}`.
2. `msg_id = multihash(SHA-256, JCS(id_object))`
3. Construct `signing_object = {msg_id, pow}` using `null` when `pow` is absent.
4. `sig = Ed25519.Sign(private_key(agent_id), JCS(signing_object))`

This separates message identity from proof-of-work and avoids recursive hashing.

Field order shown above is illustrative only; RFC 8785 JCS determines the canonical byte sequence.

Verification repeats the same steps and verifies against the public key encoded by `payload.agent_id`.



## Appendix B: Core Interoperability Test Vectors

This appendix provides deterministic interoperability vectors for independent implementations. Unless otherwise noted, all JSON is canonicalized with RFC 8785 JCS, all multihashes use SHA-256, and all base64url is unpadded.

The vectors in this appendix are normative for conformance testing of:

- `msg_id` derivation
- `sig` derivation
- `prev` handling
- PoW verification inputs
- Merkle tree construction
- announcements digest construction

### B.1 Common Key Material

**Ed25519 private key seed (hex):**

```text
000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
```

**Ed25519 public key (hex):**

```text
03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8
```

**Derived `agent_id` (Bech32m over raw public-key bytes, HRP `adrs`):**

```text
adrs1qwss00lnecgtu8tsm5vwwj7qn9n7f43snwjs6hcamjrxgyj4xxuqa90ukn
```

### B.2 Envelope Signing Vector (`pow: null`, `prev: null`)

**Payload object:**

```json
{
  "agent_id": "adrs1qwss00lnecgtu8tsm5vwwj7qn9n7f43snwjs6hcamjrxgyj4xxuqa90ukn",
  "protocol": "adrs/v1",
  "receipt_msg_id": "uEiD-pTlqf0MlxAixtlszpNd7pUhs66lBgE2IiahUbPurlg",
  "timestamp": "2026-03-10T12:00:00Z",
  "type": "countersignature"
}
```

**Canonical `id_object`:**

```json
{
  "payload": {
    "agent_id": "adrs1qwss00lnecgtu8tsm5vwwj7qn9n7f43snwjs6hcamjrxgyj4xxuqa90ukn",
    "protocol": "adrs/v1",
    "receipt_msg_id": "uEiD-pTlqf0MlxAixtlszpNd7pUhs66lBgE2IiahUbPurlg",
    "timestamp": "2026-03-10T12:00:00Z",
    "type": "countersignature"
  },
  "prev": null
}
```

**JCS(`id_object`) UTF-8 bytes as text:**

```text
{"payload":{"agent_id":"adrs1qwss00lnecgtu8tsm5vwwj7qn9n7f43snwjs6hcamjrxgyj4xxuqa90ukn","protocol":"adrs/v1","receipt_msg_id":"uEiD-pTlqf0MlxAixtlszpNd7pUhs66lBgE2IiahUbPurlg","timestamp":"2026-03-10T12:00:00Z","type":"countersignature"},"prev":null}
```

**`msg_id` raw multihash bytes (hex):**

```text
12201994df4d48699989daf9c156f4e73e7fae47a5fea7e8cc9a392ee8ea0e637516
```

**`msg_id` JSON encoding:**

```text
uEiAZlN9NSGmZidr5wVb05z5_rkel_qfozJo5LujqDmN1Fg
```

**Canonical `signing_object`:**

```json
{
  "msg_id": "uEiAZlN9NSGmZidr5wVb05z5_rkel_qfozJo5LujqDmN1Fg",
  "pow": null
}
```

**JCS(`signing_object`) UTF-8 bytes as text:**

```text
{"msg_id":"uEiAZlN9NSGmZidr5wVb05z5_rkel_qfozJo5LujqDmN1Fg","pow":null}
```

**Ed25519 signature raw bytes (hex):**

```text
c4a737e9dea7b7ff97e60f69a1720162c823398d4187aeb98203968864ac3415c3695e45ede70dc6bf84274a9a0a2ce01e63d288a21b11b80179d1980e090b0d
```

**Ed25519 signature base64url (unpadded):**

```text
xKc36d6nt_-X5g9poXIBYsgjOY1Bh665ggOWiGSsNBXDaV5F7ecNxr-EJ0qaCizgHmPSiKIbEbgBedGYDgkLDQ
```

### B.3 Envelope Signing Vector (`prev` non-null)

**Payload object:**

```json
{
  "agent_id": "adrs1qwss00lnecgtu8tsm5vwwj7qn9n7f43snwjs6hcamjrxgyj4xxuqa90ukn",
  "protocol": "adrs/v1",
  "receipt_msg_id": "uEiAZlN9NSGmZidr5wVb05z5_rkel_qfozJo5LujqDmN1Fg",
  "response": "Refund issued",
  "timestamp": "2026-03-10T12:10:00Z",
  "type": "receipt-response"
}
```

**`prev`:**

```text
uEiAZlN9NSGmZidr5wVb05z5_rkel_qfozJo5LujqDmN1Fg
```

**JCS(`id_object`) UTF-8 bytes as text:**

```text
{"payload":{"agent_id":"adrs1qwss00lnecgtu8tsm5vwwj7qn9n7f43snwjs6hcamjrxgyj4xxuqa90ukn","protocol":"adrs/v1","receipt_msg_id":"uEiAZlN9NSGmZidr5wVb05z5_rkel_qfozJo5LujqDmN1Fg","response":"Refund issued","timestamp":"2026-03-10T12:10:00Z","type":"receipt-response"},"prev":"uEiAZlN9NSGmZidr5wVb05z5_rkel_qfozJo5LujqDmN1Fg"}
```

**`msg_id` raw multihash bytes (hex):**

```text
1220320723e7669d551bfa17a12d676d63b4a1199c3e34b75152d32645fb26032a1f
```

**`msg_id` JSON encoding:**

```text
uEiAyByPnZp1VG_oXoS1nbWO0oRmcPjS3UVLTJkX7JgMqHw
```

**JCS(`signing_object`) UTF-8 bytes as text:**

```text
{"msg_id":"uEiAyByPnZp1VG_oXoS1nbWO0oRmcPjS3UVLTJkX7JgMqHw","pow":null}
```

**Ed25519 signature raw bytes (hex):**

```text
5e681e28c49bd5c78660e92e70511833628b952ec6d38d136afed6010128444b83746b145961323df438d1c9aa0b7501e20d2b89cde324599b27807647f6fd05
```

**Ed25519 signature base64url (unpadded):**

```text
XmgeKMSb1ceGYOkucFEYM2KLlS7G040Tav7WAQEoREuDdGsUWWEyPfQ40cmqC3UB4g0ric3jJFmbJ4B2R_b9BQ
```

### B.4 Envelope Signing Vector (populated `pow`)

**Payload object:**

```json
{
  "agent_id": "adrs1qwss00lnecgtu8tsm5vwwj7qn9n7f43snwjs6hcamjrxgyj4xxuqa90ukn",
  "capabilities": [
    {
      "description": "Echo input text",
      "domain": "utility.echo",
      "id": "cap_echo_v1",
      "protocols": {
        "mcp": {
          "endpoint": "https://echo.agent/mcp",
          "version": "2026-03-01"
        }
      },
      "tags": ["echo"]
    }
  ],
  "protocol": "adrs/v1",
  "timestamp": "2026-03-10T12:20:00Z",
  "ttl": 3600,
  "type": "capability-announcement"
}
```

**JCS(`id_object`) UTF-8 bytes as text:**

```text
{"payload":{"agent_id":"adrs1qwss00lnecgtu8tsm5vwwj7qn9n7f43snwjs6hcamjrxgyj4xxuqa90ukn","capabilities":[{"description":"Echo input text","domain":"utility.echo","id":"cap_echo_v1","protocols":{"mcp":{"endpoint":"https://echo.agent/mcp","version":"2026-03-01"}},"tags":["echo"]}],"protocol":"adrs/v1","timestamp":"2026-03-10T12:20:00Z","ttl":3600,"type":"capability-announcement"},"prev":null}
```

**`msg_id` raw multihash bytes (hex):**

```text
12209f6f439395cae1712e6bd6178bea26e6b55b6b38bfdc7c0cfcc67a57b78e7413
```

**`msg_id` JSON encoding:**

```text
uEiCfb0OTlcrhcS5r1heL6ibmtVtrOL_cfAz8xnpXt450Ew
```

**PoW object:**

```json
{
  "algorithm": "sha256",
  "difficulty": 12,
  "hash": "uEiAACzshdE5fkPFdhadoRMHNKFbKWN_sAQSK3OdD9OF9QA",
  "nonce": "1b24"
}
```

**PoW verification digest input (`msg_id_raw_bytes || nonce_bytes`) as hex:**

```text
12209f6f439395cae1712e6bd6178bea26e6b55b6b38bfdc7c0cfcc67a57b78e74131b24
```

**PoW digest `SHA-256(msg_id_raw_bytes || nonce_bytes)` (hex):**

```text
000b3b21744e5f90f15d85a76844c1cd2856ca58dfec01048adce743f4e17d40
```

**JCS(`signing_object`) UTF-8 bytes as text:**

```text
{"msg_id":"uEiCfb0OTlcrhcS5r1heL6ibmtVtrOL_cfAz8xnpXt450Ew","pow":{"algorithm":"sha256","difficulty":12,"hash":"uEiAACzshdE5fkPFdhadoRMHNKFbKWN_sAQSK3OdD9OF9QA","nonce":"1b24"}}
```

**Ed25519 signature raw bytes (hex):**

```text
e9ad673fdbf1cdf54bb58a00184f49dfe9617446b235e3d8a701a72cb358b1fdf4c31bec837ea1a195af64c7a3e162a2320c805cff49af48a55c0d5b81c4d00e
```

**Ed25519 signature base64url (unpadded):**

```text
6a1nP9vxzfVLtYoAGE9J3-lhdEayNePYpwGnLLNYsf30wxvsg36hoZWvZMej4WKiMgyAXP9Jr0ilXA1bgcTQDg
```

### B.5 Merkle Root Vector

This vector uses the three message IDs from sections B.2, B.3, and B.4.

**Sorted `msg_id_raw_bytes` inputs (hex):**

```text
12201994df4d48699989daf9c156f4e73e7fae47a5fea7e8cc9a392ee8ea0e637516
1220320723e7669d551bfa17a12d676d63b4a1199c3e34b75152d32645fb26032a1f
12209f6f439395cae1712e6bd6178bea26e6b55b6b38bfdc7c0cfcc67a57b78e7413
```

**Leaf hashes `SHA-256(0x00 || msg_id_raw_bytes)` (hex):**

```text
d939accef14df3d93eacd2cf6ef1fd45716c429dc80e64418dec1c49948e3faa
c44698bbe81c6dca760897947fb536a1b3c237fdf09d57f78bc7f500a7343991
61c4da137d39d5d19889d8d704dd46651a9388e0d8c41a7152e51708becdbbf6
```

**Level 1 inner hash `SHA-256(0x01 || leaf1 || leaf2)` (hex):**

```text
e5541b6d117114d31413c96ee758eafadeeea91a56a2c683d3540697d919bf11
```

**Promoted odd leaf (hex):**

```text
61c4da137d39d5d19889d8d704dd46651a9388e0d8c41a7152e51708becdbbf6
```

**Merkle root digest (hex):**

```text
42ac8a069f488e57e5a76e2f16774222695e5cb26058cbfaae0731a6fedab7fa
```

**Merkle root multihash JSON encoding:**

```text
uEiBCrIoGn0iOV-Wnbi8Wd0IiaV5csmBYy_quBzGm_tq3-g
```

### B.6 Announcements Digest Vector

This vector uses two capability-announcement message IDs: the B.4 message ID and the additional announcement below.

**Additional announcement payload:**

```json
{
  "agent_id": "adrs1qwss00lnecgtu8tsm5vwwj7qn9n7f43snwjs6hcamjrxgyj4xxuqa90ukn",
  "capabilities": [
    {
      "description": "Uppercase text",
      "domain": "utility.text-transform",
      "id": "cap_upper_v1",
      "protocols": {
        "mcp": {
          "endpoint": "https://echo.agent/mcp",
          "version": "2026-03-01"
        }
      },
      "tags": ["uppercase", "text"]
    }
  ],
  "protocol": "adrs/v1",
  "timestamp": "2026-03-10T12:25:00Z",
  "ttl": 3600,
  "type": "capability-announcement"
}
```

**Additional announcement `msg_id_raw_bytes` (hex):**

```text
1220efb306df1d99588887d9a208d1601a2f512f0f3649b0e66628e05d5af15a28db
```

**Additional announcement `msg_id` JSON encoding:**

```text
uEiDvswbfHZlYiIfZogjRYBovUS8PNkmw5mYo4F1a8Voo2w
```

**Sorted announcement `msg_id_raw_bytes` inputs (hex):**

```text
12209f6f439395cae1712e6bd6178bea26e6b55b6b38bfdc7c0cfcc67a57b78e7413
1220efb306df1d99588887d9a208d1601a2f512f0f3649b0e66628e05d5af15a28db
```

**Concatenated sorted bytes (hex):**

```text
12209f6f439395cae1712e6bd6178bea26e6b55b6b38bfdc7c0cfcc67a57b78e74131220efb306df1d99588887d9a208d1601a2f512f0f3649b0e66628e05d5af15a28db
```

**Announcements digest raw multihash bytes (hex):**

```text
1220b15fb9ea39ea0ec75b13027e9365f354e5dcd8592bab5c93fb36c990e3c3b57d
```

**Announcements digest JSON encoding:**

```text
uEiCxX7nqOeoOx1sTAn6TZfNU5dzYWSurXJP7NsmQ48O1fQ
```
