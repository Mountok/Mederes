CREATE TABLE IF NOT EXISTS live_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    group_id UUID NULL REFERENCES groups(id) ON DELETE SET NULL,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    livekit_room_name TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    join_code VARCHAR(10) NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS live_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    left_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS live_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
    participant_id UUID NULL REFERENCES live_participants(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'live_rooms_status_check'
    ) THEN
        ALTER TABLE live_rooms
        ADD CONSTRAINT live_rooms_status_check
        CHECK (status IN ('active', 'ended'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'live_participants_role_check'
    ) THEN
        ALTER TABLE live_participants
        ADD CONSTRAINT live_participants_role_check
        CHECK (role IN ('teacher', 'student', 'parent'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'live_chat_messages_role_check'
    ) THEN
        ALTER TABLE live_chat_messages
        ADD CONSTRAINT live_chat_messages_role_check
        CHECK (role IN ('teacher', 'student', 'parent'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_live_rooms_school_id ON live_rooms(school_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_group_id ON live_rooms(group_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_join_code ON live_rooms(join_code);
CREATE INDEX IF NOT EXISTS idx_live_participants_room_id ON live_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_messages_room_id_created_at ON live_chat_messages(room_id, created_at);
