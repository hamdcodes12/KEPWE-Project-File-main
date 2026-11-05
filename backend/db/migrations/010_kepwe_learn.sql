CREATE TABLE IF NOT EXISTS learn_courses (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  introduction TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learn_chapters (
  slug TEXT PRIMARY KEY,
  course_slug TEXT NOT NULL REFERENCES learn_courses(slug) ON DELETE CASCADE,
  title TEXT NOT NULL,
  introduction TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE (course_slug, sort_order)
);

CREATE TABLE IF NOT EXISTS learn_lessons (
  slug TEXT PRIMARY KEY,
  course_slug TEXT NOT NULL REFERENCES learn_courses(slug) ON DELETE CASCADE,
  chapter_slug TEXT NOT NULL REFERENCES learn_chapters(slug) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 8 CHECK (duration_minutes > 0),
  lesson_type TEXT NOT NULL DEFAULT 'written' CHECK (lesson_type IN ('written', 'video')),
  video_url TEXT,
  content JSONB NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE (chapter_slug, sort_order)
);

CREATE TABLE IF NOT EXISTS learn_quizzes (
  slug TEXT PRIMARY KEY,
  lesson_slug TEXT NOT NULL UNIQUE REFERENCES learn_lessons(slug) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pass_score INTEGER NOT NULL DEFAULT 50 CHECK (pass_score BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS learn_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_slug TEXT NOT NULL REFERENCES learn_quizzes(slug) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  choices JSONB NOT NULL,
  answer_index INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE (quiz_slug, sort_order),
  CHECK (answer_index >= 0)
);

CREATE TABLE IF NOT EXISTS learn_user_lesson_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_slug TEXT NOT NULL REFERENCES learn_lessons(slug) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  exercise_completed BOOLEAN NOT NULL DEFAULT FALSE,
  best_quiz_score INTEGER CHECK (best_quiz_score BETWEEN 0 AND 100),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lesson_slug)
);

CREATE TABLE IF NOT EXISTS learn_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_slug TEXT NOT NULL REFERENCES learn_quizzes(slug) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  correct_count INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  answers JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learn_milestones (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, slug)
);

CREATE TABLE IF NOT EXISTS learn_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL REFERENCES learn_courses(slug) ON DELETE CASCADE,
  certificate_code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_slug)
);

CREATE INDEX IF NOT EXISTS idx_learn_lessons_course ON learn_lessons(course_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_learn_progress_user_recent ON learn_user_lesson_progress(user_id, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_learn_attempts_user_recent ON learn_quiz_attempts(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_learn_certificates_user ON learn_certificates(user_id, issued_at DESC);
