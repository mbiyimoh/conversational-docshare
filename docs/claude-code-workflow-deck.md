# Claude Code Workflow System
## A Visual Guide to AI-Assisted Software Development

---

# SLIDE 1: The Spec Pipeline Overview

## From Idea to Execution: A 5-Stage Workflow

```
┌─────────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐    ┌─────────┐
│   IDEATE    │───▶│ IDEATE-TO-   │───▶│ VALIDATE │───▶│ DECOMPOSE │───▶│ EXECUTE │
│             │    │    SPEC      │    │          │    │           │    │         │
│ /spec:ideate│    │/spec:ideate- │    │/spec:    │    │/spec:     │    │/spec:   │
│             │    │   to-spec    │    │ validate │    │ decompose │    │ execute │
└─────────────┘    └──────────────┘    └──────────┘    └───────────┘    └─────────┘
      │                  │                  │                │               │
      ▼                  ▼                  ▼                ▼               ▼
  Exploration       Decisions          Quality          Task Lists      Parallel
  + Research        + Spec Doc         Checks           + Phases        Agents
```

### The Philosophy

This pipeline enforces a disciplined approach to AI-assisted development:

1. **Understand before building** - Research the codebase and external patterns
2. **Decide before coding** - Make architectural choices explicit
3. **Validate before committing** - Catch scope creep and over-engineering
4. **Decompose for execution** - Break work into LLM-optimized tasks
5. **Execute with oversight** - Parallel agents with code review gates

---

# SLIDE 2: /spec:ideate - Deep Discovery

## "Know Your Terrain Before You Build"

### What It Does

The ideate command is about **comprehensive reconnaissance** before any implementation begins. It serves two critical purposes:

**1. Codebase Mapping**
- Scans your repository for related patterns, components, and conventions
- Identifies dependencies, data flows, and potential "blast radius"
- Finds existing specs, developer guides, and architectural docs

**2. External Research**
- Searches the web for existing libraries, patterns, and prior art
- Finds examples of similar implementations in open-source projects
- Discovers best practices and common pitfalls

### Why This Matters

> "The goal is never to rebuild the wheel. It's to find the wheel, understand how it works, and customize only the spokes that need changing."

### The Output: An Ideation Document

```
docs/ideation/{task-slug}.md
├── Intent & Assumptions
├── Pre-reading Log (what docs/code were examined)
├── Codebase Map (affected files, dependencies, data flow)
├── Root Cause Analysis (for bugs)
├── Research Findings (external patterns, libraries, solutions)
└── Clarifications (decisions for the user to make)
```

### Visual: The Discovery Process

```
                    ┌──────────────────────────────────┐
                    │          TASK BRIEF              │
                    │   "Add user preferences sync"    │
                    └─────────────┬────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
    │   CODEBASE    │    │   EXTERNAL    │    │   EXISTING    │
    │    SEARCH     │    │   RESEARCH    │    │     DOCS      │
    └───────────────┘    └───────────────┘    └───────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
    │ Components:   │    │ Libraries:    │    │ Guides:       │
    │ - UserPrefs   │    │ - zustand     │    │ - state.md    │
    │ - SyncService │    │ - tanstack    │    │ - api.md      │
    │ - Settings UI │    │ - jotai       │    │ - testing.md  │
    └───────────────┘    └───────────────┘    └───────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  ▼
                    ┌──────────────────────────────────┐
                    │      IDEATION DOCUMENT           │
                    │  docs/ideation/user-prefs.md     │
                    └──────────────────────────────────┘
```

### Key Insight

Ideation prevents the "just start coding" trap that leads to:
- Duplicating existing functionality
- Ignoring established patterns
- Reinventing libraries that already exist
- Breaking conventions unknowingly

---

# SLIDE 3: /spec:ideate-to-spec - From Exploration to Plan

## "Turn Research Into a Blueprint"

### What It Does

This command bridges ideation and implementation by:

1. **Reading the ideation document** and extracting key insights
2. **Walking the user through decisions** identified during research
3. **Creating a formal specification** using those decisions
4. **Validating the spec** automatically after creation

### The Interactive Decision Process

```
┌────────────────────────────────────────────────────────────────┐
│  CLARIFICATION FROM IDEATION:                                  │
│                                                                │
│  "How should we handle offline sync conflicts?"                │
│                                                                │
│  Options (from research):                                      │
│    A) Last-write-wins (simpler, potential data loss)           │
│    B) Merge with conflict UI (complex, safe)                   │
│    C) Queue for manual resolution (middle ground)              │
│                                                                │
│  Recommended: Option C based on similar patterns in codebase   │
│                                                                │
│  Your choice: [A/B/C/other]                                    │
└────────────────────────────────────────────────────────────────┘
```

### The Workflow

```
┌──────────────────┐
│ IDEATION DOC     │
│ (research done)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ EXTRACT          │
│ CLARIFICATIONS   │ ◀─── What decisions need user input?
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ INTERACTIVE      │
│ DECISION SESSION │ ◀─── User makes choices with context
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ BUILD SPEC       │
│ CREATION PROMPT  │ ◀─── Construct detailed /spec:create input
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ CREATE SPEC      │
│ (/spec:create)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ VALIDATE SPEC    │
│ (/spec:validate) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ SUMMARY +        │
│ NEXT STEPS       │
└──────────────────┘
```

### Why This Matters

The ideate-to-spec transition ensures:
- Research findings aren't lost in translation
- User decisions are explicit and documented
- The spec inherits context from ideation
- Validation happens automatically

---

# SLIDE 4: /spec:validate - The Quality Gate

## "Catch Over-Engineering Before It Starts"

### What It Does

The validate command analyzes specifications for:

1. **Completeness** - Does it have enough detail to implement autonomously?
2. **Clarity** - Are there ambiguous statements or assumed knowledge?
3. **Over-Engineering** - Is it building more than necessary?

### The Three Assessment Pillars

```
┌─────────────────────────────────────────────────────────────────┐
│                        SPEC VALIDATION                          │
├─────────────────────┬─────────────────────┬─────────────────────┤
│        WHY          │        WHAT         │        HOW          │
│  Intent & Purpose   │  Scope & Reqs       │  Implementation     │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ • Problem clear?    │ • Features defined? │ • Architecture?     │
│ • Goals stated?     │ • Deliverables?     │ • Error handling?   │
│ • Success criteria? │ • API contracts?    │ • Testing strategy? │
│ • Justification?    │ • Data models?      │ • Deploy plan?      │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

### Over-Engineering Detection

This is where validate truly shines. It applies the **YAGNI principle** aggressively:

**Patterns It Catches:**

| Pattern | Example | Verdict |
|---------|---------|---------|
| Premature Optimization | "Cache with Redis for rarely accessed data" | Cut it |
| Feature Creep | "Support 5 export formats when only JSON needed" | Cut to 1 |
| Over-abstraction | "Plugin system for 3 known validators" | Implement directly |
| Testing Extremism | "100% coverage on prototype features" | 70% is fine |
| Future-proofing | "Handle 10,000 connections when expecting 100" | Let it fail at scale |

### The Decision Framework

```
Is this feature needed NOW?
        │
        ├── YES ──▶ Is it in the original request?
        │                   │
        │                   ├── YES ──▶ Include
        │                   │
        │                   └── NO ───▶ Is it a natural extension?
        │                                      │
        │                                      ├── YES ──▶ Include
        │                                      │
        │                                      └── NO ───▶ Move to Future Improvements
        │
        └── NO ───▶ Move to Future Improvements
```

### Output Format

```
┌────────────────────────────────────────────────┐
│ VALIDATION RESULTS                             │
├────────────────────────────────────────────────┤
│ Summary: NOT READY (needs revision)            │
├────────────────────────────────────────────────┤
│ Critical Gaps:                                 │
│   • No error handling for API failures         │
│   • Missing data migration strategy            │
├────────────────────────────────────────────────┤
│ Over-Engineering Detected:                     │
│   • Multi-phase rollout for single feature     │
│   • Caching layer for < 100 users              │
│   • 5 export formats when only JSON needed     │
├────────────────────────────────────────────────┤
│ Features to Cut:                               │
│   • Real-time notifications (not requested)    │
│   • Admin analytics dashboard                  │
├────────────────────────────────────────────────┤
│ Essential Scope (keep only):                   │
│   • Core preference storage                    │
│   • Basic sync on login                        │
│   • Conflict detection (no resolution UI)      │
└────────────────────────────────────────────────┘
```

---

# SLIDE 5: /spec:decompose - Task Breakdown for LLMs

## "Optimize Work for AI Execution"

### What It Does

Decompose takes a validated spec and breaks it into:
- **Actionable tasks** with single, clear objectives
- **Dependency chains** showing what must complete first
- **Parallel opportunities** where tasks can run simultaneously
- **Self-contained units** with all context embedded

### Why LLMs Need Different Task Structures

Traditional project management: "Add authentication feature"

LLM-optimized decomposition:
```
Phase 1: Foundation
├── Task 1.1: Create user schema with email, password_hash, created_at
│            └── Dependencies: None
│            └── Files: prisma/schema.prisma, src/types/user.ts
│            └── Can parallel with: Task 1.2
│
├── Task 1.2: Set up bcrypt utility with hash/compare functions
│            └── Dependencies: None
│            └── Files: src/utils/password.ts
│            └── Can parallel with: Task 1.1

Phase 2: Core Logic
├── Task 2.1: Implement login endpoint with rate limiting
│            └── Dependencies: Task 1.1, Task 1.2
│            └── Implementation code: [FULL CODE BLOCK]
```

### The Content Preservation Principle

**Critical Rule:** Tasks must be self-contained. No "as specified in the spec" references.

```
❌ WRONG:
--details "Create the auth service as specified in the spec"

✅ CORRECT:
--details "Create src/services/auth.ts with:

import { hash, compare } from '../utils/password';
import { prisma } from '../db';

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AuthError('User not found');

  const valid = await compare(password, user.password_hash);
  if (!valid) throw new AuthError('Invalid password');

  return createSession(user.id);
}
"
```

### Visual: Dependency Graph

```
                    ┌───────────────────┐
                    │    START          │
                    └─────────┬─────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │  Task 1.1   │    │  Task 1.2   │    │  Task 1.3   │
    │  (Schema)   │    │  (Bcrypt)   │    │  (Config)   │
    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
             ┌─────────────┐     ┌─────────────┐
             │  Task 2.1   │     │  Task 2.2   │
             │  (Login)    │     │  (Register) │
             └──────┬──────┘     └──────┬──────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │    Task 3.1     │
                    │  (Integration)  │
                    └─────────────────┘

    Legend:
    ═══ Can run in parallel (no dependencies)
    ─── Must wait for predecessor
```

### Output Artifacts

```
specs/{feature}-tasks.md          ← Detailed breakdown document
STM (Simple Task Manager)         ← Task tracking system
├── stm list --status pending     ← View all pending tasks
├── stm show [task-id]            ← Full task details
└── stm update [id] --status done ← Mark complete
```

---

# SLIDE 6: /spec:execute - Orchestrated Implementation

## "Parallel Agents with Quality Gates"

### What It Does

Execute orchestrates the actual implementation by:
1. Loading tasks from the decomposed spec
2. Launching specialist subagents for each task
3. Enforcing code review before marking complete
4. Committing atomic changes after validation

### The Execution Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    FOR EACH TASK                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: IMPLEMENT                                              │
│                                                                 │
│  Task(subagent_type="react-expert")                             │
│  "First run: stm show [task-id]                                 │
│   Implement the component based on requirements..."             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: WRITE TESTS                                            │
│                                                                 │
│  Task(subagent_type="playwright-expert")                        │
│  "Write comprehensive tests for the component.                  │
│   Cover edge cases, aim for >80% coverage."                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: CODE REVIEW (Required)                                 │
│                                                                 │
│  Task(subagent_type="code-review-expert")                       │
│  "Review for:                                                   │
│   1. COMPLETENESS - All requirements implemented?               │
│   2. QUALITY - Security, error handling, tests                  │
│                                                                 │
│  Categorize issues: CRITICAL | IMPORTANT | MINOR"               │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
          ┌─────────────────┐ ┌─────────────────┐
          │ Issues Found?   │ │ All Clear       │
          │                 │ │                 │
          │ → Fix & Re-run  │ │ → Mark Complete │
          │ → Re-test       │ │ → Commit        │
          │ → Re-review     │ │ → Next Task     │
          └─────────────────┘ └─────────────────┘
```

### Parallel Execution

When tasks have no dependencies, they run simultaneously:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│   Task 1.1 ─────┬─────┬───────────▶ ✓ Complete                │
│                 │     │                                        │
│   Task 1.2 ─────┘     │───────────▶ ✓ Complete                │
│                       │                                        │
│   Task 1.3 ───────────┴───────────▶ ✓ Complete                │
│                                                                │
│   ═══════════════ Parallel Phase ═══════════════               │
│                                                                │
│   Task 2.1 ────────────┬──────────▶ ✓ Complete                │
│                        │                                       │
│   Task 2.2 ────────────┴──────────▶ ✓ Complete                │
│                                                                │
│   ═══════════════ Sequential Phase ═════════════               │
│                                                                │
│   Task 3.1 ───────────────────────▶ ✓ Complete                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
         TIME ──────────────────────────────────────────▶
```

### Available Specialist Agents

| Agent | Use For |
|-------|---------|
| `react-expert` | React components, hooks, state management |
| `typescript-expert` | Type systems, generics, build config |
| `nestjs-expert` | Nest.js modules, guards, middleware |
| `playwright-expert` | E2E tests, cross-browser automation |
| `code-review-expert` | Quality, security, completeness |
| `database-expert` | Schema design, query optimization |
| `css-styling-expert` | Layouts, responsive design, themes |
| `devops-expert` | CI/CD, Docker, deployment |

---

# SLIDE 7: The Complete Pipeline Visual

## End-to-End: From Brief to Deployed Code

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER: "Add dark mode toggle"                      │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  /spec:ideate                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Scan codebase: Found ThemeProvider, useTheme hook                  │   │
│  │ • Research: next-themes, Tailwind dark mode, CSS custom properties   │   │
│  │ • Existing patterns: Already using Tailwind, no theme system yet     │   │
│  │ • Clarifications: System preference sync? Persist to localStorage?   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  OUTPUT: docs/ideation/add-dark-mode-toggle.md                             │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  /spec:ideate-to-spec docs/ideation/add-dark-mode-toggle.md                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Decision 1: Use next-themes (recommended from research)              │   │
│  │ Decision 2: Yes, sync with system preference                         │   │
│  │ Decision 3: Yes, persist to localStorage                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  OUTPUT: specs/feat-dark-mode-toggle.md                                    │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  /spec:validate specs/feat-dark-mode-toggle.md                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ Completeness: PASS                                                 │   │
│  │ ✓ Clarity: PASS                                                      │   │
│  │ ⚠ Over-engineering detected:                                        │   │
│  │   - Animated toggle transition (not requested) → Move to Future      │   │
│  │   - Custom color picker (not requested) → CUT                        │   │
│  │ ✓ After revision: READY FOR IMPLEMENTATION                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  /spec:decompose specs/feat-dark-mode-toggle.md                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Phase 1: Setup (parallel)                                            │   │
│  │   Task 1.1: Install next-themes, configure ThemeProvider             │   │
│  │   Task 1.2: Add CSS custom properties for colors                     │   │
│  │                                                                       │   │
│  │ Phase 2: Implementation                                               │   │
│  │   Task 2.1: Create ThemeToggle component with icon switch            │   │
│  │   Task 2.2: Update existing components to use CSS variables          │   │
│  │                                                                       │   │
│  │ Phase 3: Testing                                                      │   │
│  │   Task 3.1: E2E tests for theme toggle and persistence               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  OUTPUT: specs/feat-dark-mode-toggle-tasks.md + STM tasks                  │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  /spec:execute specs/feat-dark-mode-toggle.md                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ▶ Task 1.1: react-expert → Implement → Test → Review → ✓           │   │
│  │ ▶ Task 1.2: css-styling-expert → Implement → Test → Review → ✓     │   │
│  │     [PARALLEL - no dependencies]                                     │   │
│  │                                                                       │   │
│  │ ▶ Task 2.1: react-expert → Implement → Test → Review                 │   │
│  │     → Issues found → Fix → Re-review → ✓                             │   │
│  │                                                                       │   │
│  │ ▶ Task 2.2: react-expert → Implement → Test → Review → ✓           │   │
│  │                                                                       │   │
│  │ ▶ Task 3.1: playwright-expert → Implement → Run → ✓                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  OUTPUT: Working dark mode toggle, committed to git                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# SLIDE 8: Debugging Commands

## Two Approaches for Different Situations

### /methodical-debug - Process Instrumentation

**When to use:** The bug is in YOUR code. You need to trace execution.

```
┌─────────────────────────────────────────────────────────────────┐
│                    METHODICAL DEBUG                             │
└─────────────────────────────────────────────────────────────────┘

Step 1: Review & Understand
├── Read all relevant docs, guides, configs
├── Build mental model of intended behavior
└── Note expected data shapes and dependencies

Step 2: Map the Expected Flow
├── Trace the FULL path from input to output
├── Document: Input → Function → Transform → State → Output
└── Note expected values at each stage

Step 3: Instrument for Visibility
├── Add debug logging at EVERY critical point
├── Log: function entry/exit, inputs, outputs, branches
└── Make logs chronologically traceable
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  ACTUAL EXECUTION WITH LOGS                                     │
│                                                                 │
│  [12:01:00] handleSubmit() ENTRY: { email: "test@..." }        │
│  [12:01:00] validateEmail() ENTRY: "test@..."                  │
│  [12:01:00] validateEmail() EXIT: true                         │
│  [12:01:01] createUser() ENTRY: { email: "test@..." }          │
│  [12:01:01] createUser() ERROR: "password is undefined"        │  ← Found it!
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Step 4: Identify & Fix
└── Pinpoint exactly WHERE and WHY it fails

Step 5: Verify
└── Use quick-check-expert for E2E confirmation

Step 6: Clean Up
└── Remove all debug logging after confirmation
```

### /research-driven-debug - External Investigation

**When to use:** The bug is environmental, infrastructure-related, or involves systems you don't control.

```
┌─────────────────────────────────────────────────────────────────┐
│                    RESEARCH-DRIVEN DEBUG                        │
└─────────────────────────────────────────────────────────────────┘

Step 1: Issue Summary
├── Document all symptoms, logs, behaviors
└── Create clear problem statement for research

Step 2: External Research
├── Understand the class of system involved
│   (e.g., Railway deployment, Docker networking)
├── How do these systems typically behave?
├── What are known causes of this symptom?
└── What fixes have others found?

Step 3: Findings Summary
└── Structured writeup for ramping up quickly

Step 4: Documentation Updates
├── Add to CLAUDE.md / developer guides
└── Capture "gotchas" and troubleshooting flows

Step 5: Solution Recommendation
├── Most likely root cause
├── Step-by-step resolution
└── Preventive measures
```

### Choosing the Right Approach

```
                 ┌─────────────────────────────┐
                 │ Where is the bug likely?    │
                 └─────────────┬───────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │ MY CODE      │   │ INTEGRATION  │   │ INFRASTRUCTURE│
   │              │   │              │   │              │
   │ Functions,   │   │ APIs, DB,    │   │ Deploy, CI,  │
   │ state, logic │   │ libraries    │   │ networking   │
   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
          │                  │                  │
          ▼                  ▼                  ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │ /methodical- │   │ BOTH (start  │   │ /research-   │
   │    debug     │   │ methodical,  │   │   driven-    │
   │              │   │ then research│   │    debug     │
   └──────────────┘   └──────────────┘   └──────────────┘
```

---

# SLIDE 9: Documentation Commands

## Keeping Knowledge Current and Discoverable

### /create-dev-guide - Comprehensive Component Documentation

**What it does:** Creates a complete developer guide for any part of your codebase.

```
developer-guides/{component-name}-guide.md
├── 0. Architecture Overview (ASCII diagram)
├── 1. Dependencies & Key Functions
├── 2. User Experience Flow
├── 3. File & Code Mapping
├── 4. Connections to Other Parts
├── 5. Critical Notes & Pitfalls
├── 6. Common Development Scenarios
├── 7. Testing Strategy
└── 8. Quick Reference
```

**Example output structure:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ARCHITECTURE OVERVIEW                                          │
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │ Frontend │────▶│  API     │────▶│ Database │                │
│  │ ChatUI   │     │ /chat/*  │     │ messages │                │
│  └──────────┘     └──────────┘     └──────────┘                │
│       │                │                │                       │
│       ▼                ▼                ▼                       │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │ Context  │     │ Service  │     │ Prisma   │                │
│  │ Provider │◀────│  Layer   │◀────│ Client   │                │
│  └──────────┘     └──────────┘     └──────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

CRITICAL NOTES & PITFALLS

• Security: Always sanitize user input before storing messages
• Performance: Batch DB writes for high-volume conversations
• Data Integrity: Use optimistic locking for concurrent edits
• Known Edge Case: Empty message content crashes on line 142
```

### /docs:sync - Forward-Looking Knowledge Transfer

**What it does:** Analyzes recent work and updates ALL documentation with knowledge that future developers need.

**The philosophy:** This isn't about documenting what you did (change logs). It's about documenting what future contributors need to KNOW before they start working.

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: DISCOVERY                                             │
│                                                                 │
│  • Find all .md files in the project                           │
│  • Analyze recent git commits                                   │
│  • Identify changed files and patterns                          │
└──────────────────────────────────────────────┬──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: KNOWLEDGE EXTRACTION                                  │
│                                                                 │
│  For each area of recent work, extract:                         │
│  • Patterns & Conventions established                           │
│  • Gotchas & Pitfalls discovered                                │
│  • Dependencies & Integration Points                            │
│  • Critical Context embedded in code                            │
└──────────────────────────────────────────────┬──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: DOCUMENTATION UPDATES                                 │
│                                                                 │
│  CLAUDE.md: New agent protocols, SOPs, gotchas                  │
│  README.md: New features, setup requirements                    │
│  Developer Guides: How to extend new features                   │
└─────────────────────────────────────────────────────────────────┘
```

**Quality checklist for each update:**
- [ ] **Actionable** - Can someone act on this?
- [ ] **Forward-looking** - Does this help with future work?
- [ ] **Concise** - Brief but useful?
- [ ] **Contextual** - Does it explain WHY, not just WHAT?
- [ ] **Discoverable** - Is it in the right place to find?

---

# SLIDE 10: /task-context - Pre-Work Reconnaissance

## "Gather Context Before Coding"

### What It Does

Quick, focused reconnaissance for any task. It's "ideate lite" - reconnaissance without the full specification pipeline.

**Use when:** You want to understand relevant context before diving into a task, but don't need a full ideation document.

### The Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  INPUT: Task brief                                              │
│  "Add magazine name extraction to the dashboard filter"         │
└──────────────────────────────────────────────┬──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Echo & Scope                                           │
│                                                                 │
│  Understanding: Add extraction of magazine names from existing  │
│  data sources and integrate into the dashboard filtering UI.   │
│  Goal: Enable users to filter content by magazine.             │
│  Out of scope: Creating new magazines, editing magazine data.  │
└──────────────────────────────────────────────┬──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Pre-Reading & Codebase Reconnaissance                  │
│                                                                 │
│  Documentation found:                                           │
│  ├── developer-guides/dashboard-guide.md                        │
│  ├── specs/feat-filtering-system.md                            │
│  └── e2e-testing-plans/dashboard-e2e.md                        │
│                                                                 │
│  Code found:                                                    │
│  ├── components/DashboardFilters.tsx                           │
│  ├── hooks/useFilterState.ts                                    │
│  ├── api/filters.ts                                             │
│  └── prisma/schema.prisma (Magazine model)                     │
└──────────────────────────────────────────────┬──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Analyze & Synthesize                                   │
│                                                                 │
│  For each finding:                                              │
│  • WHY is this relevant?                                       │
│  • HOW will it influence approach?                             │
│  • WHAT decisions does it help make?                           │
└──────────────────────────────────────────────┬──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  OUTPUT: Task Context Summary                                   │
│                                                                 │
│  ## Key Insights                                                │
│  1. Existing filter system uses useFilterState hook             │
│  2. Magazine model already exists, just needs extraction        │
│  3. Similar pattern implemented for category filtering          │
│                                                                 │
│  ## Recommended Approach                                        │
│  Follow the category filter pattern. Add magazine to the       │
│  FilterState type, create getMagazines() query, add            │
│  MagazineFilter component following existing patterns.         │
│                                                                 │
│  ## Potential Risks                                             │
│  - Large dataset may need pagination/search                     │
│  - Magazine names may have duplicates across publishers         │
└─────────────────────────────────────────────────────────────────┘
```

### Principles

1. **Breadth over depth** - Survey widely, read strategically
2. **Relevance filter** - Only include context that directly informs the task
3. **Actionable insights** - Every finding connects to "how this shapes my approach"
4. **Concise output** - Clarity and brevity over exhaustive detail

---

# SLIDE 11: CLAUDE.md - Your AI's Operating Manual

## "The Single Source of Truth for AI Behavior"

### What It Is

CLAUDE.md is a project-level instruction file that configures how AI agents behave when working on your codebase. It's automatically loaded when Claude Code starts in your project.

### The Mental Model

Think of CLAUDE.md as a combination of:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAUDE.md                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │  PROJECT    │   │ TECHNICAL   │   │ OPERATIONAL │           │
│  │  CONTEXT    │   │  DETAILS    │   │   RUNBOOK   │           │
│  └─────────────┘   └─────────────┘   └─────────────┘           │
│        │                 │                 │                    │
│        ▼                 ▼                 ▼                    │
│  What this       Architecture,     How to run,                 │
│  project does    patterns, stack   deploy, test                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Structure

```markdown
# Project Name - Claude Context

## Working with This User
- User profile (technical level, preferences)
- Critical rules (what never to do, what always to do)

## Project Purpose
- What the project does
- Who uses it
- Core innovation/value prop

## Tech Stack
- Frontend: React + Vite + TypeScript, Tailwind, etc.
- Backend: Express, PostgreSQL + Prisma, etc.
- Deploy: Docker, Railway, etc.

## Critical Patterns
- Key architectural patterns
- Data flow examples
- Common gotchas with solutions

## Database / Schema Changes
- How to apply migrations
- Safety rules

## Key Files & Components
- Core files with descriptions
- Entry points
- Configuration locations

## Operational Commands
- Dev server: npm run dev
- Production: npm run start
- Database: npm run db:push
- Deploy: /deploy:push-and-check-railway

## Test Credentials
- Email / password for testing
```

### What Makes a Good CLAUDE.md

**Include:**
- Critical gotchas that cause recurring bugs
- Architectural decisions and their rationale
- Patterns with code examples
- Commands for common operations
- Integration points between systems

**Avoid:**
- Information that changes frequently (move to docs)
- Exhaustive API documentation
- Duplicate content from README

### Example Section: Critical Gotcha

```markdown
## Scroll Containment (CRITICAL)

**Problem:** `scrollIntoView()` scrolls viewport instead of document panel.

**Solution:** Use `container.scrollTo()` with manual calculation:

‍‍‍typescript
const scrollToSection = useCallback((sectionId: string) => {
  const element = sectionRefs.current.get(sectionId)
  const container = scrollContainerRef.current
  if (!element || !container) return

  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const elementTop = elementRect.top - containerRect.top + container.scrollTop
  const targetScroll = elementTop - (container.clientHeight / 2)

  container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
}, [])
‍‍‍

**Key files:** `frontend/src/components/DocumentContentViewer.tsx:77-123`
```

---

# SLIDE 12: Command Categories Overview

## The Full Toolkit

### Specification Pipeline

| Command | Purpose |
|---------|---------|
| `/spec:ideate` | Deep discovery and research |
| `/spec:ideate-to-spec` | Transform ideation to spec with decisions |
| `/spec:create` | Create comprehensive specification |
| `/spec:create-lean` | Create focused, minimal specification |
| `/spec:validate` | Quality gate and over-engineering check |
| `/spec:decompose` | Break into LLM-optimized tasks |
| `/spec:execute` | Parallel agent implementation |

### Debugging

| Command | Purpose |
|---------|---------|
| `/methodical-debug` | Trace execution with instrumentation |
| `/research-driven-debug` | External research for infrastructure issues |

### Documentation

| Command | Purpose |
|---------|---------|
| `/create-dev-guide` | Comprehensive component documentation |
| `/docs:sync` | Update all docs with recent knowledge |

### Context & Research

| Command | Purpose |
|---------|---------|
| `/task-context` | Quick reconnaissance before work |
| `/research` | Deep parallel research with subagents |

### Git & Deployment

| Command | Purpose |
|---------|---------|
| `/git:commit` | Commit with project conventions |
| `/git:status` | Intelligent status analysis |
| `/git:push` | Push with safety checks |
| `/deploy:push-and-check-railway` | Deploy and verify |

### Quality & Validation

| Command | Purpose |
|---------|---------|
| `/code-review` | Multi-aspect code review |
| `/validate-and-fix` | Run checks and auto-fix |

---

# SLIDE 13: When to Use What

## Decision Tree for Choosing Commands

```
                        ┌─────────────────────────────┐
                        │    What do you need?        │
                        └─────────────┬───────────────┘
                                      │
     ┌────────────────────────────────┼────────────────────────────────┐
     │                                │                                │
     ▼                                ▼                                ▼
┌─────────────┐                ┌─────────────┐                ┌─────────────┐
│ BUILD       │                │ DEBUG       │                │ UNDERSTAND  │
│ SOMETHING   │                │ SOMETHING   │                │ SOMETHING   │
└──────┬──────┘                └──────┬──────┘                └──────┬──────┘
       │                              │                              │
       ▼                              ▼                              ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ Complex feature?    │     │ In your code?       │     │ Before starting     │
│                     │     │                     │     │ work?               │
│ YES → Full pipeline │     │ YES → /methodical-  │     │ YES → /task-context │
│ /spec:ideate        │     │       debug         │     │                     │
│ → ideate-to-spec    │     │                     │     │ Deep research?      │
│ → validate          │     │ NO → /research-     │     │ YES → /research     │
│ → decompose         │     │      driven-debug   │     │                     │
│ → execute           │     │                     │     │ Document a feature? │
│                     │     │                     │     │ YES → /create-dev-  │
│ Simple feature?     │     │                     │     │       guide         │
│ YES → /spec:create- │     │                     │     │                     │
│       lean          │     │                     │     │ Sync all docs?      │
│                     │     │                     │     │ YES → /docs:sync    │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### Quick Reference Matrix

| Situation | Command(s) |
|-----------|------------|
| "I need to build a complex feature" | `/spec:ideate` → full pipeline |
| "I need to add a simple feature" | `/spec:create-lean` → `/spec:execute` |
| "Something is broken in my code" | `/methodical-debug` |
| "Deploy/infra is failing" | `/research-driven-debug` |
| "I want to understand this feature" | `/task-context` or `/create-dev-guide` |
| "I finished major work" | `/docs:sync` |
| "I need background research" | `/research` |

---

# SLIDE 14: Key Principles Summary

## The Philosophy Behind the System

### 1. Research Before Building
Don't start coding until you understand:
- What already exists in your codebase
- What patterns the project uses
- What external solutions are available

### 2. Make Decisions Explicit
Every architectural choice should be:
- Documented in a spec
- Validated against over-engineering
- Preserved for future reference

### 3. Validate Before Committing
Every spec gets checked for:
- Completeness (can it be implemented?)
- Clarity (is it unambiguous?)
- Scope (is it over-engineered?)

### 4. Optimize for AI Execution
Tasks should be:
- Self-contained (no "see the spec" references)
- Single-objective (one clear goal)
- Parallelizable (when dependencies allow)

### 5. Enforce Quality Gates
Every implementation goes through:
- Tests
- Code review
- Completeness check
- Only then marked done

### 6. Document Forward
Update documentation to help:
- Future developers
- Future AI agents
- Your future self

---

# Appendix: ASCII Diagram Reference

For creating architecture diagrams in your documentation:

```
BOXES AND ARROWS

┌──────────┐     ┌──────────┐
│  Box 1   │────▶│  Box 2   │
└──────────┘     └──────────┘

FLOW DIRECTIONS

─── horizontal
│   vertical
├── branch
└── end
▶ ▼ ◀ ▲ arrows

NESTING

┌─────────────────────────────┐
│  Outer                      │
│  ┌──────────┐  ┌──────────┐ │
│  │  Inner 1 │  │  Inner 2 │ │
│  └──────────┘  └──────────┘ │
└─────────────────────────────┘

TABLES

┌────────┬────────┬────────┐
│ Col 1  │ Col 2  │ Col 3  │
├────────┼────────┼────────┤
│ Data   │ Data   │ Data   │
└────────┴────────┴────────┘

TIMELINES

──────┬──────┬──────┬──────▶
      │      │      │
    Step1  Step2  Step3
```

---

═══════════════════════════════════════════════════════════════════════════════
# PART 2: SUBAGENTS & HOOKS
## The Automated Quality Infrastructure
═══════════════════════════════════════════════════════════════════════════════

---

# SLIDE 15: Hooks - Automated Quality Gates

## "Quality Enforcement Without Thinking About It"

### What Are Hooks?

Hooks are shell commands that run automatically at specific points during Claude Code execution. They enforce quality standards without requiring manual intervention.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOOK LIFECYCLE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   SessionStart ────▶ UserPromptSubmit ────▶ PreToolUse ────▶ Tool Runs     │
│        │                    │                    │               │          │
│        ▼                    ▼                    ▼               ▼          │
│   [codebase-map]      [thinking-      [file-guard]       PostToolUse       │
│                        level]                                  │            │
│                                                                ▼            │
│                                                    ┌───────────────────┐    │
│                                                    │ • lint-changed    │    │
│                                                    │ • typecheck       │    │
│                                                    │ • test-changed    │    │
│                                                    │ • check-comments  │    │
│                                                    └───────────────────┘    │
│                                                                             │
│   ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│                            Claude says "I'm done"                           │
│                                      │                                      │
│                                      ▼                                      │
│                               ┌─────────────┐                               │
│                               │    Stop     │ ◀── THE BIG ONE               │
│                               └──────┬──────┘                               │
│                                      │                                      │
│                    ┌─────────────────┼─────────────────┐                    │
│                    │                 │                 │                    │
│                    ▼                 ▼                 ▼                    │
│            ┌─────────────┐   ┌─────────────┐   ┌─────────────┐             │
│            │ typecheck-  │   │ lint-       │   │ test-       │             │
│            │   project   │   │   project   │   │   project   │             │
│            └─────────────┘   └─────────────┘   └─────────────┘             │
│                    │                 │                 │                    │
│                    └─────────────────┼─────────────────┘                    │
│                                      ▼                                      │
│                            ┌─────────────────┐                              │
│                            │  self-review    │ ◀── Code Review Hook        │
│                            └─────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Stop Hooks (Most Important)

When Claude says "I'm done," these hooks run automatically:

| Hook | What It Does |
|------|--------------|
| `typecheck-project` | Runs `tsc --noEmit` across entire project |
| `lint-project` | Runs ESLint/Biome on all files |
| `test-project` | Runs full test suite |
| `check-todos` | Validates todo completions match reality |
| `self-review` | **Critical** - Prompts self-review for integration issues |

**If any hook fails, Claude must fix the issue before truly finishing.**

### The Self-Review Hook (Code Review)

This is the automated code review that runs at the end of every implementation:

```
┌─────────────────────────────────────────────────────────────────┐
│  SELF-REVIEW PROMPT (injected automatically)                    │
│                                                                 │
│  Before marking this task complete, critically review:          │
│                                                                 │
│  1. INTEGRATION                                                 │
│     • Do all modified files work together correctly?            │
│     • Are there any orphaned imports or broken references?      │
│     • Did I update all call sites when changing signatures?     │
│                                                                 │
│  2. REFACTORING COMPLETENESS                                    │
│     • Did I remove ALL old code that was replaced?              │
│     • Are there any TODO comments I left behind?                │
│     • Did I clean up debug logging?                             │
│                                                                 │
│  3. EDGE CASES                                                  │
│     • What happens with empty/null/undefined inputs?            │
│     • Did I handle error states?                                │
│     • Are there race conditions or async issues?                │
│                                                                 │
│  If you find issues, FIX THEM before responding.                │
└─────────────────────────────────────────────────────────────────┘
```

### PostToolUse Hooks (Real-Time Feedback)

These run after every Write/Edit operation:

| Hook | Purpose |
|------|---------|
| `lint-changed` | Immediately lint modified files |
| `typecheck-changed` | Type-check modified files |
| `test-changed` | Run tests affected by changes |
| `check-comment-replacement` | Detect when code is replaced with `// ...` comments |
| `check-unused-parameters` | Catch lazy `_param` prefixing instead of removal |

### PreToolUse Hooks (Protection)

| Hook | Purpose |
|------|---------|
| `file-guard` | Prevents access to sensitive files (.env, credentials, etc.) |

### Configuration (settings.json)

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "claudekit-hooks run typecheck-project" },
          { "type": "command", "command": "claudekit-hooks run lint-project" },
          { "type": "command", "command": "claudekit-hooks run test-project" },
          { "type": "command", "command": "claudekit-hooks run self-review" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "claudekit-hooks run lint-changed" },
          { "type": "command", "command": "claudekit-hooks run typecheck-changed" }
        ]
      }
    ]
  }
}
```

---

# SLIDE 16: Core Subagents (High-Frequency)

## "Specialist Experts on Demand"

### The Subagent Model

Instead of one generalist, Claude Code can spawn specialist subagents for specific tasks:

```
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN CLAUDE SESSION                        │
│                                                                 │
│   "Implement this feature with TypeScript, React, and tests"   │
│                                                                 │
│                              │                                  │
│               ┌──────────────┼──────────────┐                   │
│               │              │              │                   │
│               ▼              ▼              ▼                   │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│   │  typescript-  │  │    react-     │  │  playwright-  │      │
│   │    expert     │  │    expert     │  │    expert     │      │
│   └───────────────┘  └───────────────┘  └───────────────┘      │
│          │                  │                  │                │
│          ▼                  ▼                  ▼                │
│   Types & build      Components &       E2E tests              │
│   configuration      hooks & state      & assertions           │
│                                                                 │
│               └──────────────┼──────────────┘                   │
│                              │                                  │
│                              ▼                                  │
│                    ┌───────────────┐                            │
│                    │  code-review- │                            │
│                    │    expert     │                            │
│                    └───────────────┘                            │
│                              │                                  │
│                              ▼                                  │
│                    Quality verified                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Most-Used Subagents

#### 1. `code-review-expert`

**Use:** Quality assurance, completeness checks, security review

```
Task(subagent_type="code-review-expert")
"Review implementation for:
 1. COMPLETENESS - All requirements implemented?
 2. QUALITY - Security, error handling, test coverage
 Categorize issues: CRITICAL | IMPORTANT | MINOR"
```

**Covers 6 aspects:**
- Architecture & design
- Code quality
- Security & dependencies
- Performance & scalability
- Testing coverage
- Documentation & API design

#### 2. `git-expert`

**Use:** Branching, merging, conflict resolution, history management

```
Task(subagent_type="git-expert")
"Create feature branch, manage merges, resolve conflicts"
```

**Handles:**
- Complex merge conflicts
- Branching strategies
- History rewriting (when safe)
- Repository recovery
- Performance optimization

#### 3. `research-expert`

**Use:** Web research, documentation lookup, pattern discovery

```
Task(subagent_type="research-expert")
"Deep dive: Find all academic papers on transformer architectures"
```

**Depth modes (trigger with keywords):**
- `Quick check:` - 3-5 searches, verification
- `Investigate:` - 5-10 searches, focused exploration
- `Deep dive:` - 10-15 searches, comprehensive research

#### 4. `typescript-expert` / `typescript-type-expert`

**Use:** Type systems, generics, build configuration

```
Task(subagent_type="typescript-type-expert")
"Fix complex generic type inference issue in this utility"
```

**typescript-type-expert** handles advanced patterns:
- Conditional types
- Template literals
- Recursive types
- Type-level programming
- 18 advanced error patterns

#### 5. `react-expert`

**Use:** Component patterns, hooks, state management

```
Task(subagent_type="react-expert")
"Implement custom hook with proper memoization"
```

**Covers:**
- Component architecture
- Hook patterns and rules
- Re-rendering optimization
- State management patterns

#### 6. `playwright-expert`

**Use:** E2E testing, browser automation

```
Task(subagent_type="playwright-expert")
"Write cross-browser tests for checkout flow"
```

**Handles:**
- Test structure and assertions
- Cross-browser testing
- Visual regression
- CI/CD integration

#### 7. `triage-expert`

**Use:** Initial diagnosis before engaging specialists

```
Task(subagent_type="triage-expert")
"Diagnose this error and recommend which expert to use"
```

**Good first step when:**
- Unclear what's wrong
- Multiple possible causes
- Need initial context gathering

---

# SLIDE 17: Specialized Subagents (Domain-Specific)

## "Deep Expertise When You Need It"

### Frontend / UI

| Agent | When to Use |
|-------|-------------|
| `css-styling-expert` | Layout issues, responsive design, theming, CSS architecture |
| `react-performance-expert` | Slow renders, DevTools profiling, Core Web Vitals |
| `ui-design-expert` | Dashboard design, data visualization, visual hierarchy |

### Backend / Database

| Agent | When to Use |
|-------|-------------|
| `database-expert` | Schema design, query optimization, transactions |
| `postgres-expert` | PostgreSQL-specific: JSONB, indexes, partitioning |
| `nestjs-expert` | Nest.js modules, guards, dependency injection |

### DevOps / Infrastructure

| Agent | When to Use |
|-------|-------------|
| `devops-expert` | CI/CD, infrastructure as code, monitoring |
| `docker-expert` | Dockerfile optimization, compose, container security |
| `github-actions-expert` | Workflow automation, custom actions |

### Testing

| Agent | When to Use |
|-------|-------------|
| `playwright-expert` | E2E tests, browser automation |
| `quick-check-expert` | Ephemeral tests for quick verification (auto-deleted) |

### Code Quality

| Agent | When to Use |
|-------|-------------|
| `refactoring-expert` | Code smell detection, systematic refactoring |
| `linting-expert` | ESLint/Biome configuration, static analysis |
| `documentation-expert` | Doc structure, cohesion, information architecture |

### Analysis & Research

| Agent | When to Use |
|-------|-------------|
| `data-analyst-consultant` | Data exploration, trend analysis, strategic insights |
| `research-expert` | Web research, pattern discovery |

---

# SLIDE 18: The Hook + Subagent Workflow

## "Automated Quality at Every Step"

### How They Work Together

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   USER: "Add authentication to the API"                                    │
│                                                                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│   MAIN SESSION                                                               │
│                                                                              │
│   Spawns: typescript-expert ──────▶ Implements auth service                 │
│                                          │                                   │
│                                          ▼                                   │
│                                   [PostToolUse hooks]                        │
│                                   ├── lint-changed ✓                         │
│                                   ├── typecheck-changed ✓                    │
│                                   └── check-comments ✓                       │
│                                          │                                   │
│   Spawns: playwright-expert ─────▶ Writes E2E tests                         │
│                                          │                                   │
│                                          ▼                                   │
│                                   [PostToolUse hooks]                        │
│                                   └── test-changed ✓                         │
│                                          │                                   │
│   Spawns: code-review-expert ────▶ Reviews everything                       │
│                                          │                                   │
│                                          ▼                                   │
│                                   "All good" or "Issues found"               │
│                                          │                                   │
│   If issues ──────────────────────▶ Fix and re-review                       │
│                                          │                                   │
│   When satisfied ─────────────────▶ "I'm done"                              │
│                                          │                                   │
└──────────────────────────────────────────┼───────────────────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│   STOP HOOKS (automatic)                                                     │
│                                                                              │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐           │
│   │ typecheck-      │   │ lint-project    │   │ test-project    │           │
│   │   project       │   │                 │   │                 │           │
│   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘           │
│            │                     │                     │                     │
│            └─────────────────────┼─────────────────────┘                     │
│                                  ▼                                           │
│                    ┌─────────────────────────┐                               │
│                    │   ALL PASSING?          │                               │
│                    └────────────┬────────────┘                               │
│                                 │                                            │
│            ┌────────────────────┼────────────────────┐                       │
│            │                    │                    │                       │
│            ▼                    ▼                    ▼                       │
│         ┌─────┐             ┌─────┐            ┌──────────┐                  │
│         │ YES │             │ NO  │            │ BLOCKED  │                  │
│         └──┬──┘             └──┬──┘            │ (errors) │                  │
│            │                   │               └────┬─────┘                  │
│            ▼                   ▼                    │                        │
│   ┌─────────────────┐  ┌─────────────────┐         │                        │
│   │   self-review   │  │  Fix issues,    │◀────────┘                        │
│   │   (code review) │  │  run again      │                                  │
│   └────────┬────────┘  └─────────────────┘                                  │
│            │                                                                 │
│            ▼                                                                 │
│   ┌─────────────────────────────────────┐                                   │
│   │  Critical self-review prompts:      │                                   │
│   │  • Did I break any integrations?    │                                   │
│   │  • Are there orphaned imports?      │                                   │
│   │  • Did I leave debug code behind?   │                                   │
│   └────────┬────────────────────────────┘                                   │
│            │                                                                 │
│            ▼                                                                 │
│         TRULY DONE                                                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Insight

The combination of hooks + subagents means:

1. **Every file change** gets immediate lint/typecheck feedback
2. **Every implementation** gets specialist expertise
3. **Every completion** gets full project validation
4. **Every task** ends with self-review

You don't have to remember to run checks - they're enforced automatically.

---

# SLIDE 19: Available Hooks Reference

## Complete Hook Inventory

### Quality Enforcement Hooks

| Hook | When | Purpose |
|------|------|---------|
| `typecheck-project` | Stop | Full TypeScript compilation check |
| `typecheck-changed` | PostToolUse | Type-check modified files only |
| `lint-project` | Stop | ESLint/Biome on entire project |
| `lint-changed` | PostToolUse | Lint modified files only |
| `test-project` | Stop | Run full test suite |
| `test-changed` | PostToolUse | Run tests for changed files |
| `check-any-changed` | PostToolUse | Forbid `any` types in modified TS files |

### Code Quality Guards

| Hook | When | Purpose |
|------|------|---------|
| `check-comment-replacement` | PostToolUse | Detect `// ...` comment replacing real code |
| `check-unused-parameters` | PostToolUse | Catch lazy `_param` prefixing |
| `check-todos` | Stop | Validate todo completions |
| `self-review` | Stop | Prompts integration/refactoring review |

### Security & Protection

| Hook | When | Purpose |
|------|------|---------|
| `file-guard` | PreToolUse | Block access to sensitive files |

### Context Enhancement

| Hook | When | Purpose |
|------|------|---------|
| `codebase-map` | SessionStart | Add codebase map to context |
| `codebase-map-update` | PostToolUse | Update index when files change |
| `thinking-level` | UserPromptSubmit | Inject thinking keywords |

### Git Operations

| Hook | When | Purpose |
|------|------|---------|
| `create-checkpoint` | Stop | Auto-checkpoint via git stash |

---

# SLIDE 20: Subagent Quick Reference

## When to Reach for Which Expert

```
┌────────────────────────────────────────────────────────────────┐
│                     SUBAGENT DECISION TREE                     │
└────────────────────────────────────────────────────────────────┘

                    What are you doing?
                           │
     ┌─────────────────────┼─────────────────────┐
     │                     │                     │
     ▼                     ▼                     ▼
┌─────────┐          ┌─────────┐          ┌─────────┐
│ CODING  │          │ QUALITY │          │RESEARCH │
└────┬────┘          └────┬────┘          └────┬────┘
     │                    │                    │
     │                    │                    │
     ▼                    ▼                    ▼
┌─────────────────┐  ┌──────────────┐   ┌──────────────┐
│ What language/  │  │ What phase?  │   │ How deep?    │
│ framework?      │  │              │   │              │
├─────────────────┤  ├──────────────┤   ├──────────────┤
│ TypeScript      │  │ Pre-work     │   │ Quick lookup │
│ → typescript-   │  │ → triage-    │   │ → research-  │
│   expert        │  │   expert     │   │   expert     │
│                 │  │              │   │   (Quick:)   │
│ React           │  │ Post-impl    │   │              │
│ → react-expert  │  │ → code-      │   │ Deep dive    │
│                 │  │   review-    │   │ → research-  │
│ CSS/Styling     │  │   expert     │   │   expert     │
│ → css-styling-  │  │              │   │   (Thorough:)│
│   expert        │  │ Refactoring  │   │              │
│                 │  │ → refactor-  │   └──────────────┘
│ Nest.js         │  │   ing-expert │
│ → nestjs-expert │  │              │
│                 │  └──────────────┘
│ Database        │
│ → postgres-     │
│   expert        │
│                 │
│ Docker/DevOps   │
│ → docker-expert │
│ → devops-expert │
│                 │
│ Tests           │
│ → playwright-   │
│   expert        │
└─────────────────┘
```

### Frequency of Use (Personal Workflow)

**Daily (High Frequency):**
- `code-review-expert` - Every implementation
- `typescript-expert` - Type-heavy work
- `react-expert` - Frontend features
- `git-expert` - Branch management

**Weekly (Medium Frequency):**
- `research-expert` - New patterns/libraries
- `playwright-expert` - E2E test writing
- `css-styling-expert` - UI work
- `refactoring-expert` - Code cleanup

**As Needed (Lower Frequency):**
- `postgres-expert` - Schema changes
- `docker-expert` - Container issues
- `devops-expert` - CI/CD setup
- `nestjs-expert` - Backend modules
- `data-analyst-consultant` - Data exploration
