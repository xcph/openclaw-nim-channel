# Change: Add nimToken Shorthand Credential Field

## Why

当前配置需要分别填写 `appKey`、`account`、`token` 三个字段，配置较为繁琐。支持一个三合一字段 `nimToken`（格式 `appKey-accid-token`）可以简化配置流程，同时保持向后兼容。

## What Changes

- 在 `NimConfigSchema` 中新增可选字段 `nimToken`（string 类型）
- 修改 `resolveNimCredentials` 函数：优先解析 `nimToken` 字段（按 `-` 分隔为 appKey、account、token），若未提供或格式不正确则回退到原有的三个独立字段
- 更新 spec 文档记录新的配置方式

## Impact

- Affected specs: `nim-channel`
- Affected code: `src/config-schema.ts`, `src/accounts.ts`
