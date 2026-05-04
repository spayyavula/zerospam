# ZeroSpam Mobile App - Phase A React Native MVP Plan

> For agentic workers: execute tasks in order, check off each step, and do not skip verification commands.

## Goal

Ship a production-viable mobile MVP (iOS and Android) using React Native with Expo that supports:
- Authentication
- Mailbox switching
- Screener Yes/No triage
- Quarantine and Inbox read-only message browsing
- Basic account settings (Screener SLA)

Phase A focuses on fast, correct delivery and shared API contracts with the existing server.

## Why this phase uses React Native

- Current web app is React plus TypeScript, so team velocity is higher.
- Existing backend already supports session and bearer-compatible auth patterns.
- Shared TypeScript domain models reduce duplicate logic and drift risk.
- Expo enables fast internal builds, OTA updates, and simpler device testing.

## Scope

In scope:
- New mobile app workspace with Expo + TypeScript
- Secure token/session strategy for mobile
- Shared API client and contract types package
- Auth flows and guarded navigation
- Inbox, Quarantine, Screener screens
- Yes/No Screener actions and domain expansion prompt
- Mailbox SLA update screen
- Minimal observability and crash reporting hooks

Out of scope:
- Rich message composer
- Attachment upload workflows
- Offline sync and background fetch
- Push notifications
- Advanced search and keyboard shortcuts
- Feature parity with full web tools

## Architecture

## App structure

- apps/mobile: Expo React Native app
- packages/shared-api: shared TypeScript API types and client helpers
- server: existing Fastify API (extended only if needed for mobile-specific auth ergonomics)

## State and data

- TanStack Query for remote cache and retries
- Zustand for lightweight app UI state (selected mailbox, transient flags)
- Strictly typed API responses from shared package

## Navigation

- Auth stack: Login, optional TOTP
- Main tabs: Screener, Inbox, Quarantine, Settings
- Message detail stack nested under Inbox and Quarantine

## Security choices

- Use device token (bearer) for mobile sessions when available; fallback to cookie session only for local dev if needed.
- Store token in secure storage (Expo SecureStore).
- Never store secrets in AsyncStorage.
- Add token rotation endpoint in later phase if needed.

## UX principles for Phase A

- Triage-first: Screener is default landing tab after login.
- Fast actions: Yes/No actions are one tap with optimistic UI.
- Clear trust model copy: unknown senders are quarantined by default.
- Keep mobile interactions thumb-friendly with large tap targets.

## Milestones and timeline

Week 1:
- Mobile workspace scaffold
- Shared API package
- Auth screens and protected navigation

Week 2:
- Screener list and actions
- Inbox and Quarantine read-only lists + message detail
- Mailbox picker

Week 3:
- Settings (Screener SLA), polish, error states
- QA pass, smoke checklist, internal beta build

## Task plan

### Task 1: Scaffold mobile workspace

Files:
- apps/mobile/* (new)
- package.json (workspace update)

- [ ] Create Expo TypeScript app under apps/mobile
- [ ] Add workspace scripts for mobile start/build/test
- [ ] Install baseline deps: expo-router or react-navigation, tanstack query, zustand, zod
- [ ] Add lint and typecheck scripts
- [ ] Run app on one Android and one iOS simulator/device

Verification:
- npm run typecheck --workspace @zerospam/mobile
- npm run start --workspace @zerospam/mobile

### Task 2: Create shared API package

Files:
- packages/shared-api/src/types.ts
- packages/shared-api/src/client.ts
- packages/shared-api/package.json

- [ ] Extract and normalize shared types used by web and mobile
- [ ] Implement typed fetch client with auth header support
- [ ] Add mobile-safe error mapping (401, 404, 422, network timeout)
- [ ] Wire web and mobile imports to shared package for overlapped types

Verification:
- npm run build --workspace @zerospam/shared-api
- npm run build --workspace @zerospam/web

### Task 3: Mobile auth foundation

Files:
- apps/mobile/src/features/auth/*
- apps/mobile/src/lib/secureStore.ts
- apps/mobile/src/navigation/*

- [ ] Build login screen with optional TOTP follow-up
- [ ] Persist bearer token in SecureStore
- [ ] Add bootstrap auth check on app launch
- [ ] Add logout flow and token clear
- [ ] Add guard to block main routes when unauthenticated

Verification:
- Login success and app enters main tabs
- Logout returns to login and protected routes are blocked

### Task 4: Screener MVP implementation

Files:
- apps/mobile/src/features/screener/ScreenerScreen.tsx
- apps/mobile/src/features/screener/components/*

- [ ] Fetch GET /api/screener for active mailbox
- [ ] Render sender cards with message count and latest preview
- [ ] Implement Yes action via POST /api/screener/allow with optimistic removal
- [ ] Implement No action via POST /api/screener/reject with optimistic removal
- [ ] Add domain expansion prompt from server response gate only

Verification:
- Seed test messages and complete triage for at least 3 senders
- Confirm backend state: inbox moves, trash moves, mute rows

### Task 5: Inbox/Quarantine read-only flows

Files:
- apps/mobile/src/features/messages/*

- [ ] Build Inbox list and Quarantine list screens
- [ ] Build message detail screen (subject, sender, preview/body text)
- [ ] Add pull-to-refresh and retry state
- [ ] Add mailbox switcher and refresh on mailbox change

Verification:
- Folder counts and message lists align with server responses

### Task 6: Settings and SLA update

Files:
- apps/mobile/src/features/settings/SettingsScreen.tsx

- [ ] Add Screener SLA input (1 to 720)
- [ ] PATCH mailbox with screener SLA
- [ ] Show success and validation error states

Verification:
- SLA update persisted and affects Screener inclusion window

### Task 7: Reliability and instrumentation

Files:
- apps/mobile/src/lib/logger.ts
- apps/mobile/src/lib/monitoring.ts

- [ ] Add centralized API error logging
- [ ] Add lightweight screen-view logging
- [ ] Add global error boundary and fallback screen

Verification:
- Simulate API failure and confirm graceful UX plus logs

### Task 8: QA, smoke, and beta package

Files:
- docs/mobile-phase-a-smoke.md
- apps/mobile/app.json or app.config.ts

- [ ] Create smoke checklist for auth, screener, lists, settings
- [ ] Run checklist on Android and iOS
- [ ] Build internal preview package with EAS
- [ ] Document known issues and defer list

Verification:
- Smoke checklist fully green
- Internal build install succeeds on tester devices

## API checklist for Phase A

Required existing endpoints:
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout
- GET /api/mailboxes
- GET /api/mailboxes/:id/counts
- GET /api/messages
- GET /api/messages/:id
- GET /api/screener
- POST /api/screener/allow
- POST /api/screener/reject
- POST /api/screener/allow-domain
- PATCH /api/mailboxes/:id

Potential small server additions if needed:
- Mobile token exchange endpoint if cookie-first auth is cumbersome for native flows
- Optional me endpoint payload extension for app version gating

## Definition of done for Phase A

- Mobile app logs in and persists auth securely.
- User can triage senders in Screener with Yes/No actions.
- User can browse Inbox and Quarantine messages.
- User can update Screener SLA from Settings.
- Shared API types are used by both web and mobile where practical.
- Smoke tests pass on both iOS and Android.
- Internal beta build is delivered.

## Risks and mitigations

Risk: Cookie-centric auth may complicate native flows.
Mitigation: Prefer bearer token strategy for mobile and keep secure storage strict.

Risk: Contract drift between web and mobile clients.
Mitigation: Shared package for types and request/response parsing.

Risk: Scope creep into full-feature parity.
Mitigation: Hard stop at triage + read-only + settings in Phase A.

Risk: Performance on large message lists.
Mitigation: Use FlatList virtualization and paginated APIs where needed.
