CREATE TABLE homework_assignments (
    id UUID PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('read', 'listen', 'recite')),
    title TEXT NOT NULL,
    surah INTEGER NOT NULL CHECK (surah BETWEEN 1 AND 114),
    ayah_from INTEGER NOT NULL CHECK (ayah_from > 0),
    ayah_to INTEGER NOT NULL CHECK (ayah_to >= ayah_from AND ayah_to <= ayah_from + 9),
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_homework_assignments_group ON homework_assignments (school_id, group_id, created_at DESC);

CREATE TABLE homework_submissions (
    id UUID PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('submitted', 'reviewed', 'completed')),
    audio_path TEXT,
    analysis JSONB,
    analysis_status TEXT NOT NULL DEFAULT 'none' CHECK (analysis_status IN ('none', 'ready', 'unavailable')),
    grade INTEGER CHECK (grade BETWEEN 1 AND 5),
    teacher_comment TEXT NOT NULL DEFAULT '',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_homework_submissions_student ON homework_submissions (school_id, student_id);
