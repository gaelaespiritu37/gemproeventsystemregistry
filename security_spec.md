# Security Specification — NoelCheck Single-QR Event Registration

## 1. Data Invariants

1. **Event Ownership**: Every `/events/{eventId}` and `/publicEvents/{eventId}` document must have `ownerId == request.auth.uid` with a verified email (`request.auth.token.email_verified == true`). Only the owner may read private `/events/{eventId}`, list events, or manage attendees.
2. **Public Event Header Isolation**: `/publicEvents/{eventId}` exposes only `title`, `eventDate`, `venue`, `ownerId`, and `kioskEnabled` via direct `get` (`allow list: if false;`). It never contains `kioskCode` or any attendee PII.
3. **Token-Gated Single-QR Self-Check-In**: Employees scanning the single shared Event QR code submit immutable receipts to `/events/{eventId}/selfCheckins/{checkinId}` containing `employeeNo`, `fullName`, `department`, `quantity`, and `kioskCode`. Firestore validates `kioskCode` and `kioskEnabled == true` directly against `/events/{eventId}`.
4. **Zero-Read Isolation for Employees**: Unauthenticated employees scanning the single Event QR code cannot `get` or `list` `/events/{eventId}/attendees` or `/events/{eventId}/selfCheckins`. Only the verified organizer can read or list check-in records.
5. **Quantity & Field Bounds**: `quantity` must be an integer between `1` and `50` inclusive; `employeeNo` must match `^[a-zA-Z0-9_\-\.]+$` (max 40 chars); `createdAt` must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Identity Spoofing on Event Create**: Creating `/events/evt_spoof` with `ownerId: "victim_uid"` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Verified-email gate rejects writes with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Ghost Field Shadow Write**: Adding `isAdmin: true` on `/events`, `/publicEvents`, `/attendees`, or `/selfCheckins` -> `PERMISSION_DENIED`.
4. **Wrong Kiosk Code on Self-Check-In**: Submitting `/events/{eventId}/selfCheckins/{id}` with an invalid `kioskCode` -> `PERMISSION_DENIED`.
5. **Disabled Event QR Submission**: Submitting `/events/{eventId}/selfCheckins/{id}` when `kioskEnabled == false` -> `PERMISSION_DENIED`.
6. **Unauthorized List on SelfCheckIns / Attendees**: Calling `list` on `/events/{eventId}/selfCheckins` or `/publicEvents` as a non-owner -> `PERMISSION_DENIED`.
7. **Client-Spoofed Timestamp**: Submitting `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
8. **Quantity Boundary Violation**: Submitting `quantity: 0` or `quantity: 500` -> `PERMISSION_DENIED`.
9. **Immutable Receipt Tampering**: Attempting `update` on `/events/{eventId}/selfCheckins/{id}` -> `PERMISSION_DENIED`.
10. **Status-Timestamp Desync**: Setting `status: "absent"` with a non-null `checkedInAt` on `attendees` -> `PERMISSION_DENIED`.
11. **Oversized Document ID Poisoning**: Creating `/events/<150-char-id>` or `selfCheckins/<150-char-id>` -> `PERMISSION_DENIED`.
12. **OwnerId Hijack on Self-Check-In**: Submitting `ownerId` that does not match `/events/{eventId}.data.ownerId` -> `PERMISSION_DENIED`.
