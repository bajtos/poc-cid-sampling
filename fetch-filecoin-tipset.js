import assert from "node:assert";
import * as Block from "multiformats/block";
import * as codec from "@ipld/dag-cbor";
import { blake2b256 as hasher } from "@multiformats/blake2/blake2b";

const LOTUS_ENDPOINT = "https://api.node.glif.io/rpc/v0";
let lastId = 0;
const STORAGE_MARKET_ACTOR_ADDR = "f05";

console.log("GETTING THE LATEST TIPSET");
let res = await rpc("Filecoin.ChainHead");
// console.log("%o", res);
console.log("Height", res.Height);
console.log("Tipset CIDs", res.Cids);
assert(res.Cids.length > 0, "empty tipset");
assert(
  res.Blocks.length === res.Cids.length,
  "Blocks have same length as Cids"
);
const tipset = res.Cids;

console.log("GETTING STORAGE MARKET STATE");
res = await rpc("Filecoin.StateReadState", [STORAGE_MARKET_ACTOR_ADDR, tipset]);
// console.log("%o", res);

// Proposals are deals that have been proposed and not yet cleaned up after expiry or termination.
// Proposals cid.Cid // AMT[DealID]DealProposal
// DealProposal v11 structure:
// https://github.com/ChainSafe/fil-actor-states/blob/c6448afe61eeb7721f4f85b4121c425edd799b4a/actors/market/src/v11/deal.rs#L96-L116
console.log("Proposals: %o", res.State.Proposals);
// States contains state for deals that have been activated and not yet cleaned up after expiry or termination.
// After expiration, the state exists until the proposal is cleaned up too.
// Invariant: keys(States) ⊆ keys(Proposals).
// States cid.Cid // AMT[DealID]DealState
// DealState v11 structure:
// https://github.com/ChainSafe/fil-actor-states/blob/c6448afe61eeb7721f4f85b4121c425edd799b4a/actors/market/src/v11/deal.rs#L141-L150
console.log("States: %o", res.State.States);

const stateCid = res.State.Proposals;
// Example CID: bafy2bzacebwg6zmvh62eplkwipho46zd5xe2dbeqkitgerc44bbrz6nbmkxn4
// base32 - cidv1 - dag-cbor - (blake2b-256 : 256 : 6C6F65953FB447AD5643CEEE7B23EDC9A18490522662445CE0431CF9A162AEDE)

console.log("INSPECTING MARKET STATE PROPOSALS ROOT NODE %s", stateCid);
res = await rpc("Filecoin.ChainReadObj", [stateCid]);
console.log("%o", res);

let stateRootNode = Buffer.from(res, "base64");
console.log(stateRootNode);
let { value } = await Block.decode({
  bytes: stateRootNode,
  cid: stateCid,
  codec,
  hasher,
});
console.log("decoded node block: %o", value);

/* Example output for Proposals AMT block
decoded node block: [
  5,
  5,
  45774365,
  [
    Uint8Array(4) [
      3,
      0,
      0,
      0,
      [BYTES_PER_ELEMENT]: 1,
      [length]: 4,
      [byteLength]: 4,
      [byteOffset]: 0,
      [buffer]: ArrayBuffer { byteLength: 4 }
    ],
    [
      CID(bafy2bzacedpaqymnlwb6vm3dqwqoppw3ttbhxkoom27wzbrltmpophem3n4ly),
      CID(bafy2bzacecitx6pxprl3du6h4ykrz4zmkdsyt2fklqxebdy3nbvtzjs4rdsou),
      [length]: 2
    ],
    [ [length]: 0 ],
    [length]: 3
  ],
  [length]: 4
]
*/

//=== helpers ===//

async function rpc(method, params = []) {
  const response = await fetch(LOTUS_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: ++lastId,
    }),
  });

  if (!response.ok) {
    console.log(
      "Cannot call %s: %s\n%s",
      method,
      response.status,
      await response.text()
    );
  }

  return JSON.parse(await response.text()).result;
}
