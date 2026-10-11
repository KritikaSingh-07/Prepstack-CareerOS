# Prepstack CareerOS

**One platform. The entire job-seeking journey.** A MERN-stack evolution of Prepstack Interview Ace that connects four steps students usually handle in separate tools:

| Step | What it does here |
|---|---|
| **Discover** | Job portal with recommendations ranked by evidence-based fit and career preferences, filters, a shortlist and stale-listing flags |
| **Evaluate** | Resume → structured profile; each job requirement is classified as *demonstrated*, *partial evidence* or *not evidenced* |
| **Improve** | Gaps become an ordered learning plan linked to the **existing** Prepstack roadmap, coding practice and mock interviews |
| **Execute** | Kanban application tracker; each application gets one workspace with the JD, resume version, gaps, notes, events, Copilot drafts and interview pack |

The modules share data. If a job asks for React, Node.js, MongoDB, testing and Docker, CareerOS shows which of these the student's resume and projects already demonstrate, which have only partial evidence, and what to do next. A finished learning task then counts as evidence in later analyses.

---

## Quick start

Requirements: **Node.js 20+**. MongoDB is optional for local development.

```bash
npm run install:all     # installs root, server and client dependencies
npm run dev             # API on :5000, web app on :5173
```

Open http://localhost:5173 and click **Use demo account (Rahul)** (`rahul@example.com` / `password123`).

When `MONGO_URI` is empty (the default in `server/.env`), the API starts an **in-memory MongoDB** and seeds demo data: 18 fictional job listings, Rahul's resume and profile, and an application pipeline. Changes are lost on restart. The MongoDB binary is downloaded once, during `npm install`.

To use a real database, set `MONGO_URI` in `server/.env`, then run:

```bash
npm run seed            # wipes and seeds the database in MONGO_URI
```

### Other commands

```bash
npm test                # server unit + API integration tests (in-memory MongoDB)
npm run build           # production build of the client
NODE_ENV=production npm start   # API also serves client/dist
docker compose up --build       # app + MongoDB (needs JWT_SECRET set)
```

### Configuration (`server/.env`)

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string. Leave empty to use in-memory demo mode (development only). |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Auth token signing. Production refuses to start with the default secret. |
| `CLIENT_ORIGIN` | CORS origin for the web app. |
| `PREPSTACK_BASE_URL` | Base URL of the existing Prepstack app. Learning tasks and interview packs deep-link here. |
| `PREPSTACK_API_URL` | Optional. Roadmap lookups query `GET {PREPSTACK_API_URL}/roadmap/modules?skill=…` first and fall back to the local catalog. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Optional. When set, Claude (`claude-opus-5-5` by default) writes Copilot cover-letter drafts. Without a key, grounded templates are used. |

---

## Architecture

```
client/  React 18 + Vite + React Router (no UI framework; plain CSS with dark mode)
server/  Express 5 + Mongoose 8, JWT auth, multer + pdf-parse for resumes
  src/services/
    skills/taxonomy.js   canonical skills: aliases, implied-by, weak signals, prerequisites
    skills/extractor.js  skill extraction, JD requirement derivation (mandatory vs nice-to-have)
    resumeParser.js      PDF text → contact, education, experience, projects, skills + issues
    matchEngine.js       requirement classification, fit score, grounded suggestions, keyword coverage
    recommender.js       ranking + "why recommended" + "requirements that matter most"
    jobFreshness.js      open / closing soon / stale (unverified > 21 days) / closed
    prepstack.js         adapter to the existing Prepstack roadmap, practice and mock interviews
    copilot.js, llm.js   project selection, bullet rewrites, checklist, interview pack, cover letter
    insights.js          conversion rates, weekly activity, skill trends, reminders, next actions
```

### Data model

| Collection | Key fields |
|---|---|
| `User` | profile (skills, education, experience, projects), preferences (roles, locations, work mode, level, weekly goal), primaryResume |
| `Job` | requirements `[{skill, importance: mandatory\|preferred}]`, workMode, level, closingDate, **lastVerifiedAt**, status, `createdBy` (private jobs a student adds) |
| `Resume` | versioned (`version`, `source: upload\|tailored`, `basedOn`, `targetJob`), rawText, parsed, issues |
| `MatchAnalysis` | versioned per job: results with evidence, summary, suggestions, keywordCoverage |
| `Application` | stage, timeline, events (deadline/assessment/interview/follow-up), contacts, notes, nextAction, resumeVersion, coverLetter, checklist, interviewPack |
| `LearningTask` | skill, gapStatus, status, sourceJobs, `prepstack` links (roadmap module, practice, mock interview) |

### How evidence is classified

For every requirement in a job:

1. **Demonstrated** when a project or role uses the skill, or uses a skill that implies it (Jest → Automated Testing, Express → Node.js).
2. **Partial evidence** when the skill is only listed in the skills section, appears only as related wording ("created backend endpoints" for REST APIs, "manually tested" for testing), or the student completed a Prepstack learning task for it.
3. **Not evidenced** otherwise.

The fit score weights mandatory requirements double. The UI labels it as evidence coverage, not a proficiency score. Each suggestion points to the specific project it is based on. Keyword coverage reports terms that appear in the resume without evidence separately, which discourages keyword stuffing. Copilot rewrites only rephrase existing bullets, mention only technologies that the same entry already lists, and use `[placeholders]` where a metric would be needed.

---

## Integration with existing Prepstack

CareerOS does **not** rebuild the roadmap, coding editor or AI mock interviews. `server/src/services/prepstack.js` is the only integration point:

- `resourcesForSkill(skill)` returns `{ roadmapModule {id, title, url}, practice[] {id, title, url}, interviewQuestions[], mockInterviewUrl }`.
- URLs are built from `PREPSTACK_BASE_URL`: `/roadmap/:slug`, `/practice?topic=…&exercise=…`, `/mock-interview?topics=…&role=…`. Change these to match your existing routes.
- When `PREPSTACK_API_URL` is set, roadmap data is fetched from the existing API. The local catalog is the fallback and documents the expected shape.
- When a learning plan is created for a skill the student is already working on, the existing task is reused and linked to the new job instead of being duplicated. The student's general roadmap is never restarted.

## API overview

All routes are under `/api`. Every route except auth and health requires `Authorization: Bearer <token>`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Profile | `GET /profile`, `PUT /profile` |
| Jobs | `GET /jobs` (q, role, level, workMode, location, skills, sort=recent\|fit\|closing, includeClosed), `GET /jobs/recommended`, `GET /jobs/meta/filters`, `POST /jobs`, `GET /jobs/:id`, `POST /jobs/:id/analyze`, `GET /jobs/:id/analyses`, `POST\|DELETE /jobs/:id/save` |
| Resumes | `GET /resumes`, `POST /resumes/upload` (multipart `resume`), `GET /resumes/:id`, `POST /resumes/:id/primary`, `POST /resumes/:id/compare`, `POST /resumes/:id/tailor`, `DELETE /resumes/:id` |
| Applications | `GET /applications`, `POST /applications`, `GET /applications/:id` (workspace), `PATCH /applications/:id`, `PATCH /applications/:id/stage`, `DELETE /applications/:id` |
| Learning | `GET /learning`, `POST /learning/plan`, `PATCH /learning/:id`, `DELETE /learning/:id`, `GET /learning/resources/:skill` |
| Copilot | `GET /copilot/status`, `POST /copilot/:applicationId/{cover-letter,projects,bullets,checklist,interview-pack}` |
| Insights | `GET /insights` |

## Milestones → implementation

| Milestone | Delivered |
|---|---|
| **1. Job portal & tracker** | Listings, search and filters, recommendations, saved jobs, job details, freshness flags, Kanban with drag and drop, timeline, events, contacts |
| **2. Resume analysis & matching** | PDF parsing, structured profile, issue detection, JD comparison, match explanations, versioned analyses and resumes, tailored versions |
| **3. Connect to Prepstack** | Gap → ordered learning tasks (prerequisites first) linked to roadmap and practice; job-specific interview packs and mock interview links; completed tasks feed back as evidence |
| **4. Insights & polish** | Conversion rates, weekly activity, skill trends, common gaps, reminders and follow-ups, suggested next actions, tests, CI, Docker, docs |

## The Rahul walkthrough (seeded)

1. **Discover**: *Junior MERN Stack Developer @ Brightloop Labs* requires React, Node.js, MongoDB, REST APIs and automated testing; Docker and TypeScript are preferred.
2. **Evaluate**: React, Node.js and MongoDB are demonstrated. REST APIs and testing have partial evidence ("created backend endpoints", "manually tested"). Docker is not evidenced.
3. **Improve**: *Create targeted learning plan* adds testing and Docker tasks linked to the Prepstack roadmap.
4. **Prepare**: in the application workspace's Copilot tab, pick the projects, accept the bullet rewrites, save a tailored resume version, and draft a cover letter.
5. **Execute**: move the card to Applied, add the assessment date, and build the interview revision pack.
