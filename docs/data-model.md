# Mezon Ta'lim — Data Model

PostgreSQL via Drizzle ORM. This is the **target schema for the MVP**, designed so the
"Later" features (community, gamification, referrals, subscriptions) slot in without a
rewrite. Conventions below, then entities.

## Conventions

- **Primary keys:** `uuid` (default `gen_random_uuid()`).
- **Timestamps:** `created_at`, `updated_at` (timestamptz, default now()).
- **Money:** `*_tiyin` columns are **`bigint` integers** (UZS × 100). Never float.
- **i18n content:** store per-locale text as JSONB `{ "uz": "...", "ru": "..." }`, or
  paired columns (`title_uz`, `title_ru`). Prefer JSONB for extensibility. **No Arabic.**
- **Enums:** Postgres enums or text + check constraints.
- **Soft delete:** `deleted_at` (nullable) on content tables; hard-delete only via admin.
- **Auth.js tables** (`users`, `accounts`, `sessions`, `verification_tokens`) come from
  the Drizzle adapter; we extend `users` with app fields below.

---

## Identity & accounts

### users  *(extends Auth.js users)*
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| role | enum | `student` \| `teacher` \| `super_admin` \| `accountant` |
| full_name | text | |
| email | citext unique | nullable if phone-only signup |
| email_verified | timestamptz | Auth.js |
| phone | text unique | E.164; primary login in UZ |
| phone_verified | timestamptz | via Eskiz OTP |
| password_hash | text | argon2; null for social-only (later) |
| locale | text | `uz` default, `ru` |
| notify_email | bool | default true |
| notify_sms | bool | default true |
| notify_telegram | bool | default false (Later) |
| telegram_chat_id | text | nullable (Later) |
| created_at / updated_at | timestamptz | |

`accounts`, `sessions`, `verification_tokens` — standard Auth.js adapter tables.

### phone_otps
| id | uuid | |
| phone | text | |
| code_hash | text | |
| expires_at | timestamptz | |
| consumed_at | timestamptz | |

---

## Catalog & content

### courses
| id | uuid PK | |
| slug | text unique | |
| title | jsonb | `{uz, ru}` |
| summary | jsonb | short, for cards |
| description | jsonb | long, course page |
| cover_url | text | |
| status | enum | `draft` \| `published` \| `archived` |
| price_tiyin | bigint | **TBD pricing**; per-course default |
| access_duration_days | int | default 365 (~1-year access) |
| certificate_enabled | bool | default true |
| pass_threshold_pct | int | default 70 (final exam) |
| created_by | uuid → users | teacher/admin |
| created_at / updated_at / deleted_at | | |

### modules
| id | uuid PK | |
| course_id | uuid → courses | |
| order_index | int | |
| title | jsonb | |
| created_at / updated_at | | |

### lessons
| id | uuid PK | |
| module_id | uuid → modules | |
| order_index | int | |
| title | jsonb | |
| body | jsonb | rich text / notes shown under the video |
| bunny_video_id | text | Bunny Stream GUID |
| duration_seconds | int | |
| is_preview | bool | free preview (B1) |
| created_at / updated_at / deleted_at | | |

### lesson_subtitles
| id | uuid | lesson_id → lessons | locale | url/text | (B5) |

### glossary_terms  *(izohli lug'at, B9)*
| id | uuid | course_id → courses (nullable = global) | term | jsonb definition `{uz,ru}` |

---

## Enrollment & progress

### enrollments
| id | uuid PK | |
| user_id | uuid → users | |
| course_id | uuid → courses | |
| status | enum | `active` \| `expired` \| `refunded` |
| source_payment_id | uuid → payments | |
| started_at | timestamptz | |
| expires_at | timestamptz | started_at + access_duration_days |
| unique (user_id, course_id) | | |

### lesson_progress
| id | uuid | |
| user_id | uuid → users | |
| lesson_id | uuid → lessons | |
| completed | bool | drives sequential unlock (B2) |
| last_position_seconds | int | resume (B3) |
| self_assessment | int | 1–5, "how well I understood" (B11) |
| updated_at | timestamptz | |
| unique (user_id, lesson_id) | | |

### bookmarks
| id | uuid | user_id | lesson_id | label | timestamp_seconds (optional) | (B8) |

### notes
| id | uuid | user_id | lesson_id | body text | created_at/updated_at | (B7, private) |

---

## Assessments

### assessments
| id | uuid PK | |
| type | enum | `lesson_quiz` \| `module_test` \| `final_exam` \| `mock_exam` |
| course_id | uuid → courses | |
| module_id | uuid → modules | nullable (module_test) |
| lesson_id | uuid → lessons | nullable (lesson_quiz) |
| title | jsonb | |
| time_limit_seconds | int | null = untimed; set for final (B14) |
| pass_threshold_pct | int | e.g. 70 (B13) |
| max_attempts | int | e.g. 3 for final (B15) |
| attempt_cooldown_hours | int | e.g. 24 between final attempts (B15) |
| is_scored | bool | false for mock (B17) |
| randomize | bool | pull/shuffle from bank (light integrity, TBD #4) |
| created_at / updated_at | | |

### questions
| id | uuid PK | |
| assessment_id | uuid → assessments | |
| order_index | int | |
| type | enum | `single` \| `multiple` \| `true_false` |
| prompt | jsonb | `{uz,ru}` |
| explanation | jsonb | shown in answer review (B16) |

### question_options
| id | uuid | question_id → questions | label jsonb | is_correct bool |

### attempts
| id | uuid PK | |
| user_id | uuid → users | |
| assessment_id | uuid → assessments | |
| attempt_no | int | |
| started_at | timestamptz | |
| submitted_at | timestamptz | |
| score_pct | int | |
| passed | bool | |
| unique (user_id, assessment_id, attempt_no) | | |

### attempt_answers
| id | uuid | attempt_id → attempts | question_id | selected_option_ids jsonb | is_correct bool |

---

## Certificates

### certificates
| id | uuid PK | |
| user_id | uuid → users | |
| course_id | uuid → courses | |
| verification_code | text unique | public, e.g. base32; powers /verify/:code |
| issued_at | timestamptz | |
| pdf_object_key | text | MinIO key (in-country) |
| revoked_at | timestamptz | nullable |

Public verification page reads by `verification_code` and shows minimal data (name,
course, date, valid/revoked) — no other personal data exposed.

> **TBD #2 (cert authority):** this is **Mezon's own completion certificate**. Leave a
> nullable `aaoifi_registration_ref` hook for a future official-exam handoff.

---

## Payments

### payments
| id | uuid PK | |
| user_id | uuid → users | |
| course_id | uuid → courses | |
| provider | enum | `click` \| `payme` |
| amount_tiyin | bigint | |
| status | enum | `pending` \| `paid` \| `failed` \| `refunded` |
| provider_txn_id | text | from callback |
| idempotency_key | text unique | guard double-processing |
| raw_callback | jsonb | audit of provider payload |
| created_at / updated_at | | |

Enrollment is created/activated **only** on a verified `paid` callback. Verify Payme
(JSON-RPC, 5 methods) and Click (Prepare/Complete + MD5 signature) server-side.

---

## Notifications & audit

### notifications
| id | uuid | user_id | channel (`email`\|`sms`\|`telegram`) | type | status (`queued`\|`sent`\|`failed`) | payload jsonb | sent_at |

### audit_log
| id | uuid | actor_user_id | action | entity_type | entity_id | meta jsonb | created_at |
Track admin/teacher actions (role changes, refunds, publishes, cert revokes).

---

## Later-feature tables (stub when those phases start — schema-compatible)

- **discussion_posts** (course/lesson scoped, `is_anonymous` bool — B20/B19/B22)
- **course_reviews** (rating 1–5 + text, B21)
- **live_sessions** (schedule + external join URL, B23)
- **referrals** (code, inviter, invitee, reward, B26)
- **gamification:** `points_ledger`, `badges`, `user_badges`, `streaks` (B25/B10)
- **subscriptions / plans** (only if pricing TBD resolves to subscription)
