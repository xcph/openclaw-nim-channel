## 1. Spec And Schema

- [x] 1.1 Update NIM config schema to accept `channels.nim.accounts` as an object map
- [x] 1.2 Enforce a maximum of 3 configured account entries in the map
- [x] 1.3 Preserve existing per-account fields and validation rules
- [x] 1.4 Reject duplicate resolved credential identities across account entries
- [x] 1.5 Remove `instances[]` support from schema validation

## 2. Account Resolution And Runtime

- [x] 2.1 Update account resolution helpers to enumerate `accounts` entries instead of `instances[]`
- [x] 2.2 Preserve derived runtime `accountId` as `"<appKey>:<accid>"`
- [x] 2.3 Ensure resolve/list/default account selection works with named account keys
- [x] 2.4 Remove any remaining runtime reads of `channels.nim.instances`

## 3. Plugin Config Operations

- [x] 3.1 Update plugin `configSchema` metadata in `src/channel.ts` to expose `accounts`
- [x] 3.2 Update `setAccountEnabled` to rewrite the `accounts` map
- [x] 3.3 Update `deleteAccount` to remove from the `accounts` map and delete the channel when empty
- [x] 3.4 Update setup/default-account helpers to operate on the `accounts` map

## 4. Documentation

- [x] 4.1 Replace README CLI examples using `instances.<index>` with `accounts.<accountKey>`
- [x] 4.2 Replace README JSON/YAML examples to use `accounts`
- [x] 4.3 Update English README examples and wording consistently
- [x] 4.4 Explicitly document that `instances[]` is no longer supported

## 5. Verification

- [x] 5.1 Validate the OpenSpec change with `openspec validate update-nim-config-to-accounts-map --strict --no-interactive`
- [x] 5.2 Run TypeScript validation after implementation
