# Requirements: Clip-That

**Defined:** 2026-06-07
**Core Value:** Students can turn a long video into a focused study artifact for a specific topic without rewatching the whole video.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Submission

- [x] **SUB-01**: User can submit a YouTube video URL.
- [x] **SUB-02**: User can enter a topic or phrase to search for in the video.
- [ ] **SUB-03**: User can choose exact transcript matching.
- [ ] **SUB-04**: User can optionally enable semantic reference matching before processing.
- [x] **SUB-05**: User can submit a job without creating an account.

### Transcript Retrieval

- [ ] **TRN-01**: System can retrieve timestamped transcript or caption data for supported YouTube videos.
- [ ] **TRN-02**: System can detect when a YouTube video has no usable transcript and return a clear unsupported-video state.
- [ ] **TRN-03**: System can normalize transcript text for matching while preserving source timestamps.

### Topic Matching

- [ ] **MAT-01**: System can find direct topic mentions in the transcript using exact matching.
- [ ] **MAT-02**: System can find semantically related transcript segments when semantic matching is enabled.
- [ ] **MAT-03**: System keeps exact matches separate from semantic matches in the clip plan.
- [ ] **MAT-04**: System can include a reason or confidence indicator for semantic matches.

### Clip Planning

- [ ] **CLP-01**: System can create a clip plan from all relevant transcript segments.
- [ ] **CLP-02**: System can add surrounding context around each relevant segment, defaulting to approximately 30 seconds before and after where available.
- [ ] **CLP-03**: System can merge overlapping context windows before video processing.
- [ ] **CLP-04**: System can preserve source timestamps for every planned segment.

### Video Output

- [ ] **VID-01**: System can extract planned video segments from the source YouTube video.
- [ ] **VID-02**: System can stitch all planned segments into one continuous video.
- [ ] **VID-03**: User can play the stitched video in the browser.
- [ ] **VID-04**: System can avoid storing processed video artifacts permanently.

### Stitched Transcript

- [ ] **STR-01**: System can generate a transcript for the stitched video.
- [ ] **STR-02**: User can view the stitched transcript alongside the stitched video.
- [ ] **STR-03**: Stitched transcript entries can reference their original source timestamps.

### Study Notes

- [ ] **NOT-01**: System can generate study notes from the selected stitched transcript spans.
- [ ] **NOT-02**: Study notes include clear explanations of the searched topic.
- [ ] **NOT-03**: Study notes include key points from the selected segments.
- [ ] **NOT-04**: Study notes include relevant definitions when the source content supports them.
- [ ] **NOT-05**: User can download the study notes as a PDF.

### Job Status and Errors

- [x] **JOB-01**: User can see processing status after submitting a job.
- [x] **JOB-02**: User can see a clear failure state if transcript retrieval, matching, media processing, or note generation fails.
- [ ] **JOB-03**: System can expire anonymous job artifacts after a configured retention window.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Uploads

- **UPL-01**: User can upload a video file instead of providing a YouTube URL.
- **UPL-02**: System can transcribe uploaded video audio when no transcript exists.
- **UPL-03**: System can process uploaded videos through the same matching, stitching, transcript, notes, and PDF flow.

### Controls

- **CTL-01**: User can adjust the context window size.
- **CTL-02**: User can review planned segments before stitching.
- **CTL-03**: User can manually include or exclude planned segments.

### Accounts

- **ACC-01**: User can create an account to save processing history.
- **ACC-02**: User can revisit prior generated study artifacts.

### Performance

- **PER-01**: System can reliably process 30-90 minute lectures within an agreed time limit.
- **PER-02**: System can queue and retry long-running video jobs.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Arbitrary public video URLs | Too broad for v1 because every source has different access, metadata, and media behavior. |
| Required user accounts | v1 should be anonymous to reduce friction. |
| Permanent video storage | Conflicts with low-cost operation and the stated storage constraint. |
| Full long-lecture guarantee | Useful later, but optional for the first working version. |
| Separate clip collection as the primary output | The desired v1 output is one continuous stitched video. |
| Whole-video notes | Notes should focus on the searched topic and selected segments. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SUB-01 | Phase 1 | Complete |
| SUB-02 | Phase 1 | Complete |
| SUB-03 | Phase 2 | Pending |
| SUB-04 | Phase 6 | Pending |
| SUB-05 | Phase 1 | Complete |
| TRN-01 | Phase 2 | Pending |
| TRN-02 | Phase 2 | Pending |
| TRN-03 | Phase 2 | Pending |
| MAT-01 | Phase 2 | Pending |
| MAT-02 | Phase 6 | Pending |
| MAT-03 | Phase 6 | Pending |
| MAT-04 | Phase 6 | Pending |
| CLP-01 | Phase 2 | Pending |
| CLP-02 | Phase 3 | Pending |
| CLP-03 | Phase 3 | Pending |
| CLP-04 | Phase 3 | Pending |
| VID-01 | Phase 4 | Pending |
| VID-02 | Phase 4 | Pending |
| VID-03 | Phase 4 | Pending |
| VID-04 | Phase 4 | Pending |
| STR-01 | Phase 3 | Pending |
| STR-02 | Phase 3 | Pending |
| STR-03 | Phase 3 | Pending |
| NOT-01 | Phase 5 | Pending |
| NOT-02 | Phase 5 | Pending |
| NOT-03 | Phase 5 | Pending |
| NOT-04 | Phase 5 | Pending |
| NOT-05 | Phase 5 | Pending |
| JOB-01 | Phase 1 | Complete |
| JOB-02 | Phase 1 | Complete |
| JOB-03 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-06-07*
*Last updated: 2026-06-07 after roadmap creation*
