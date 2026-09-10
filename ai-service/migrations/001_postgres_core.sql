BEGIN;

CREATE TABLE jobs (
    job_id text PRIMARY KEY,
    description text NOT NULL,
    category_hint text,
    language_hint text,
    location_text text,
    latitude double precision,
    longitude double precision,
    start_at timestamptz,
    end_at timestamptz,
    budget_min numeric(12, 2),
    budget_max numeric(12, 2),
    workflow_status text NOT NULL DEFAULT 'DRAFT' CHECK (
        workflow_status IN (
            'DRAFT', 'TRIAGING', 'NEEDS_INFO', 'MANUAL_REVIEW',
            'READY_FOR_ASSIGNMENT', 'CANDIDATES_READY', 'OFFERED',
            'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
        )
    ),
    triage_result jsonb,
    version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE providers (
    provider_id text PRIMARY KEY,
    display_name text NOT NULL,
    verified boolean NOT NULL DEFAULT false,
    available boolean NOT NULL DEFAULT false,
    latitude double precision,
    longitude double precision,
    service_radius_km double precision NOT NULL DEFAULT 0 CHECK (service_radius_km >= 0),
    active_jobs integer NOT NULL DEFAULT 0 CHECK (active_jobs >= 0),
    max_concurrent_jobs integer NOT NULL DEFAULT 1 CHECK (max_concurrent_jobs > 0),
    average_rating double precision NOT NULL DEFAULT 0 CHECK (average_rating BETWEEN 0 AND 5),
    review_count integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    completion_rate double precision NOT NULL DEFAULT 0 CHECK (completion_rate BETWEEN 0 AND 1),
    cancellation_rate double precision NOT NULL DEFAULT 0 CHECK (cancellation_rate BETWEEN 0 AND 1),
    median_response_minutes double precision NOT NULL DEFAULT 0 CHECK (median_response_minutes >= 0),
    version bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_skills (
    provider_id text NOT NULL REFERENCES providers(provider_id) ON DELETE CASCADE,
    skill_id text NOT NULL,
    PRIMARY KEY (provider_id, skill_id)
);

CREATE TABLE provider_languages (
    provider_id text NOT NULL REFERENCES providers(provider_id) ON DELETE CASCADE,
    language_code text NOT NULL,
    PRIMARY KEY (provider_id, language_code)
);

CREATE TABLE assignments (
    assignment_id text PRIMARY KEY,
    job_id text NOT NULL REFERENCES jobs(job_id),
    provider_id text NOT NULL REFERENCES providers(provider_id),
    status text NOT NULL CHECK (
        status IN ('OFFERED', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
    ),
    assigned_by text NOT NULL,
    idempotency_key text NOT NULL UNIQUE,
    ranking_version text,
    selected_rank integer CHECK (selected_rank IS NULL OR selected_rank > 0),
    override_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_active_assignment_per_job
    ON assignments(job_id)
    WHERE status IN ('OFFERED', 'ACCEPTED', 'IN_PROGRESS');

CREATE TABLE assignment_events (
    event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assignment_id text NOT NULL REFERENCES assignments(assignment_id),
    job_id text NOT NULL REFERENCES jobs(job_id),
    actor_id text NOT NULL,
    event_type text NOT NULL,
    event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assignment_events_job_time_idx
    ON assignment_events(job_id, created_at DESC);

CREATE TABLE knowledge_documents (
    document_id text PRIMARY KEY,
    category_id text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    keywords text NOT NULL DEFAULT '',
    language_code text NOT NULL DEFAULT 'und',
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(keywords, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(body, '')), 'B')
    ) STORED,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_documents_search_idx
    ON knowledge_documents USING gin(search_vector);

COMMIT;
