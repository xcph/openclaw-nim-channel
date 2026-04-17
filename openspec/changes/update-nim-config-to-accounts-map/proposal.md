# Change: Replace NIM `instances[]` Config With `accounts.<key>`

## Why

The current multi-instance configuration uses `channels.nim.instances.<index>`, which is awkward for CLI-based configuration and inconsistent with OpenClaw's common named-account configuration style.

We want NIM multi-instance configuration to use stable, named account keys under `channels.nim.accounts.<accountKey>.*`, and we explicitly do **not** want to preserve the old `instances[]` format.

## What Changes

- **BREAKING**: replace `channels.nim.instances[]` with `channels.nim.accounts.{accountKey}`
- Require all multi-instance NIM configuration to be stored under a record/object map keyed by user-defined account names
- Keep per-account credential and policy fields unchanged (`nimToken`, `appKey`, `account`, `token`, `p2p`, `team`, `qchat`, `advanced`, `enabled`)
- Keep the internal derived runtime `accountId` format as `"<appKey>:<accid>"`
- Enforce the maximum of 3 configured accounts across the `accounts` map
- Reject duplicate resolved credentials (`appKey:accid`) across account entries
- Remove support for reading or writing the legacy `instances[]` structure
- Update README / README-en examples and CLI snippets to use `channels.nim.accounts.<accountKey>.*`

## Impact

- Affected specs: `nim-channel`
- Affected code:
  - `src/config-schema.ts`
  - `src/types.ts`
  - `src/accounts.ts`
  - `src/channel.ts`
  - `README.md`
  - `README-en.md`
