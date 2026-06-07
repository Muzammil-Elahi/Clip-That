# Clip-That

## What This Is

Clip-That is a web platform for students and learners who want to study video content faster. A user enters a YouTube video URL and a topic, then receives a stitched video containing the relevant parts of the source video, a transcript of that stitched video, and study notes that can be downloaded as a PDF.

## Core Value

Students can turn a long video into a focused study artifact for a specific topic without rewatching the whole video.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet - ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] User can submit a YouTube video URL and topic.
- [ ] User can choose exact transcript matching or enable optional semantic reference matching.
- [ ] System can identify topic mentions and relevant references in videos that have usable captions or transcripts.
- [ ] System can include surrounding context around each relevant moment so clips make sense.
- [ ] User receives one continuous stitched video made from all relevant segments.
- [ ] User receives a transcript of the stitched video.
- [ ] User receives study notes with clear explanations, key points, and definitions.
- [ ] User can download the study notes as a PDF.
- [ ] Anonymous users can use the v1 flow without creating an account.

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- User-uploaded videos - planned after YouTube URL support is working.
- Permanent video storage - v1 should avoid storing processed videos longer than needed.
- Required user accounts - v1 should support anonymous use.
- Guaranteed processing for very long lectures - desirable, but optional for the first working version.
- Support for arbitrary public video URLs - too broad for the first version because each source handles access, metadata, and media formats differently.

## Context

The initial product is designed for students and learners working with video lectures, tutorials, educational talks, and similar YouTube content. The main workflow is URL plus topic in, focused study material out.

Topic detection should support two modes. Exact matching should use the spoken transcript to find direct mentions. Semantic matching should be optional and should find related or indirect references when the user wants broader coverage.

The stitched video should be a single continuous output, not separate clips. Each included segment should preserve useful context around the mention or reference, such as roughly 30 seconds before and after when that makes sense.

The notes should be study-oriented: clear explanations, key points, and definitions rather than creator talking points or research citations.

## Constraints

- **Source support**: YouTube first - keeps the MVP focused and reduces source handling complexity.
- **Cost**: Low-cost operation - the platform should avoid expensive processing patterns where practical.
- **Storage**: Avoid permanent video storage - processed media should be temporary unless a later product decision changes this.
- **Access**: Anonymous v1 - users should not need accounts for the first version.
- **Reliability**: Works on most YouTube videos with usable captions or transcripts - videos without transcript access may not be supported initially.
- **Performance**: Long lecture support is desirable but optional - the first version can prioritize common videos before optimizing 30-90 minute processing.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Support YouTube URLs first | Focuses the MVP on the most common education video source and reduces integration risk. | - Pending |
| Add user-uploaded videos after YouTube support | Uploads are valuable but change storage, processing, and UX requirements. | - Pending |
| Provide exact matching plus optional semantic matching | Exact matching is predictable; semantic matching helps find indirect references when the user wants broader coverage. | - Pending |
| Return one continuous stitched video | Matches the desired study workflow and avoids making users manage separate clip outputs. | - Pending |
| Generate study notes, not creator or research notes | The initial audience is students and learners. | - Pending |
| Keep v1 anonymous | Reduces friction and avoids account/auth scope in the first version. | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. "What This Is" still accurate? Update if drifted.

**After each milestone**:
1. Review all sections.
2. Check whether Core Value is still the right priority.
3. Audit Out of Scope and confirm reasons still hold.
4. Update Context with current state, feedback, and known constraints.

---
*Last updated: 2026-06-07 after initialization*
