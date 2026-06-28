# Adapter Layer

Real wiring goes here.

Recommended adapters:

```text
sheetAdapter.ts
folderWatcherAdapter.ts
ledgerAdapter.ts
muxAdapter.ts
hostChatAdapter.ts
kexQueryAdapter.ts
```

Safe flow:

```text
sheet row
→ validate
→ build intent packet
→ ledger preflight
→ apply allowlisted action
→ ledger result
→ update dashboard
```
