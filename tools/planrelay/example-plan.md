# Authentication rollout

## Goal
Replace shared credentials with scoped access tokens.

## Implementation
1. Add a token table with expiration and revocation.
2. Validate permissions before every write.
3. Release behind a feature flag.

## Verification
- Test expired and revoked tokens.
- Confirm rollback preserves existing sessions.

## Open decision
Define token retention and rotation ownership.
