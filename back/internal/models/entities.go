package models

import "time"

type School struct {
	ID        string    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	CreatedAt time.Time `db:"created_at" json:"-"`
	UpdatedAt time.Time `db:"updated_at" json:"-"`
}

type User struct {
	ID           string    `db:"id" json:"id"`
	SchoolID     string    `db:"school_id" json:"-"`
	SchoolName   string    `db:"school_name" json:"-"`
	StudentID    *string   `db:"student_id" json:"-"`
	Login        string    `db:"login" json:"login"`
	PasswordHash string    `db:"password_hash" json:"-"`
	Role         string    `db:"role" json:"role"`
	Label        string    `db:"label" json:"label"`
	CreatedAt    time.Time `db:"created_at" json:"-"`
	UpdatedAt    time.Time `db:"updated_at" json:"-"`
}

type Group struct {
	ID          string    `db:"id" json:"id"`
	SchoolID    string    `db:"school_id" json:"-"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	CreatedAt   time.Time `db:"created_at" json:"-"`
	UpdatedAt   time.Time `db:"updated_at" json:"-"`
}

type Student struct {
	ID        string    `db:"id" json:"id"`
	SchoolID  string    `db:"school_id" json:"-"`
	GroupID   string    `db:"group_id" json:"groupId"`
	Name      string    `db:"name" json:"name"`
	Note      string    `db:"note" json:"note"`
	CreatedAt time.Time `db:"created_at" json:"-"`
	UpdatedAt time.Time `db:"updated_at" json:"-"`
}

type Lesson struct {
	ID        string    `db:"id" json:"id"`
	SchoolID  string    `db:"school_id" json:"-"`
	GroupID   string    `db:"group_id" json:"groupId"`
	Topic     string    `db:"topic" json:"topic"`
	Date      string    `db:"date" json:"date"`
	Homework  string    `db:"homework" json:"homework"`
	CreatedAt time.Time `db:"created_at" json:"-"`
	UpdatedAt time.Time `db:"updated_at" json:"-"`
}

type Attendance struct {
	ID        string    `db:"id" json:"id"`
	SchoolID  string    `db:"school_id" json:"-"`
	LessonID  string    `db:"lesson_id" json:"lessonId"`
	StudentID string    `db:"student_id" json:"studentId"`
	Attended  *bool     `db:"attended" json:"attended"`
	Grade     *int      `db:"grade" json:"grade"`
	CreatedAt time.Time `db:"created_at" json:"-"`
	UpdatedAt time.Time `db:"updated_at" json:"-"`
}

type GroupListItem struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Description      string  `json:"description"`
	StudentCount     int     `json:"studentCount"`
	LessonCount      int     `json:"lessonCount"`
	LatestLessonDate *string `json:"latestLessonDate"`
}

type LessonPreview struct {
	ID           string `db:"id" json:"id"`
	GroupID      string `db:"group_id" json:"groupId"`
	Date         string `db:"date" json:"date"`
	Topic        string `db:"topic" json:"topic"`
	Homework     string `db:"homework" json:"homework"`
	PresentCount int    `db:"present_count" json:"presentCount"`
}

type AttendanceRow struct {
	StudentID   string `db:"student_id" json:"studentId"`
	StudentName string `db:"student_name" json:"studentName"`
	Note        string `db:"note" json:"note"`
	Attended    *bool  `db:"attended" json:"attended"`
	Grade       *int   `db:"grade" json:"grade"`
}
