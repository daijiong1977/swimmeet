# SwimMeet Multi-Tab Workflow Implementation Plan

## 1. Navigation & Layout
- Introduce a top-level tabbed navigation component (e.g., `AppTabs`) to switch between **Generate Meets**, **Draft Meets**, and **Meets Shared**.
- Preserve existing styles; ensure tab state is persisted in `localStorage` so the last active view reopens.
- Refactor the current `App` render flow into tab-specific containers.

## 2. Storage Model Enhancements
- Extend share metadata to track status (`draft` vs `published`), associated GitHub file path, and last-modified timestamps.
- Maintain two local arrays (`draftMeets`, `publishedMeets`) hydrated from GitHub folder listings on demand.
- Cache fetched meet payloads in memory/localStorage to avoid redundant network calls during a session.

## 3. Generate Meets Tab
- Keep current upload/config panel UI.
- After extraction completes, automatically upload the `StoredShareData` JSON to GitHub using existing helper.
- Record the resulting metadata as a draft and display a success message directing the user to the Draft tab (no inline editor here).
- Retain error handling/logging for upload failures.

## 4. Draft Meets Tab
- Render two panels: `Drafts` (not yet published) and `Published` (already published but editable), each as a list/table of meets with metadata.
- Clicking an entry loads the payload (fetch from raw URL if not cached) into an editable editor view reused from current `EventTable` + `MeetInfoDisplay` stack.
- Provide buttons to **Delete**, **Publish/Republish**, and **Save** updates (upload revised JSON, update metadata timestamps, refresh listing).
- Deleting removes metadata locally and deletes the GitHub JSON via REST API.

## 5. Meets Shared Tab
- Display all published meets with their share URLs and basic stats.
- Selecting a meet loads a read-only view (reuse existing shared rendering). Offer copy-link and delete buttons.
- Deletion removes the GitHub JSON and local metadata, then updates the tab lists.

## 6. Shared Utilities & Components
- Extract an `MeetEditor` component encapsulating meet info editing, filters, event table interactions, and save/publish triggers.
- Add GitHub directory listing helper (`listShareFiles`) and wrapper to fetch raw JSON plus metadata (add caching).
- Centralize status management in a new hook (e.g., `useMeetStorage`) to surface operations (loading, saving, deleting) and state arrays to tabs.

## 7. Config Panel Adjustments
- Ensure GitHub storage section clarifies new workflow (automatic uploads after extraction, drafts list, etc.).
- Optionally allow configuring default folder names per status (e.g., drafts vs published) if needed for organization.

## 8. Testing & Validation
- `npm run build` to confirm no compile issues.
- Manual flow check: generate sample meet, verify draft entry appears, edit & publish, confirm share tab updates and link works.
- Validate deletion cleans up GitHub JSON and removes UI entry.
- Confirm shared view via URL remains functional.
