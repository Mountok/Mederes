package models

import (
	"bytes"
	"encoding/json"
)

type LoginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token  string     `json:"token"`
	User   UserInfo   `json:"user"`
	School SchoolInfo `json:"school"`
}

type UserInfo struct {
	ID        string  `json:"id"`
	Login     string  `json:"login"`
	Role      string  `json:"role"`
	Label     string  `json:"label"`
	StudentID *string `json:"studentId,omitempty"`
}

type SchoolInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type CreateGroupRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type CreateStudentRequest struct {
	GroupID string `json:"groupId"`
	Name    string `json:"name"`
	Note    string `json:"note"`
}

type StudentAccountCredentials struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

type CreateStudentResponse struct {
	Student Student                   `json:"student"`
	Account StudentAccountCredentials `json:"account"`
}

type StudentAccessResponse struct {
	StudentID string                    `json:"studentId"`
	Account   StudentAccountCredentials `json:"account"`
}

type UpdateStudentRequest struct {
	Name *string `json:"name"`
	Note *string `json:"note"`
}

type DeleteStudentResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type CreateStaffRequest struct {
	FirstName  string   `json:"firstName"`
	LastName   string   `json:"lastName"`
	MiddleName string   `json:"middleName"`
	Phone      string   `json:"phone"`
	Note       string   `json:"note"`
	GroupIDs   []string `json:"groupIds"`
}

type UpdateStaffRequest struct {
	FirstName  string `json:"firstName"`
	LastName   string `json:"lastName"`
	MiddleName string `json:"middleName"`
	Phone      string `json:"phone"`
	Note       string `json:"note"`
}

type UpdateStaffGroupsRequest struct {
	GroupIDs []string `json:"groupIds"`
}

type CreateStaffResponse struct {
	Staff   StaffDetails              `json:"staff"`
	Account StudentAccountCredentials `json:"account"`
}

type ResetStaffAccessResponse struct {
	StaffID string                    `json:"staffId"`
	Account StudentAccountCredentials `json:"account"`
}

type UpdateStaffGroupsResponse struct {
	Success bool `json:"success"`
}

type DeleteStaffResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type CreateLessonRequest struct {
	GroupID  string `json:"groupId"`
	Topic    string `json:"topic"`
	Date     string `json:"date"`
	Homework string `json:"homework"`
}

type UpdateLessonRequest struct {
	Topic    string `json:"topic"`
	Homework string `json:"homework"`
}

type DeleteLessonResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type UpdateAttendanceRequest struct {
	LessonID  string       `json:"lessonId"`
	StudentID string       `json:"studentId"`
	Attended  OptionalBool `json:"attended"`
	Grade     OptionalInt  `json:"grade"`
}

type UpdateAttendanceAllRequest struct {
	Attended bool `json:"attended"`
}

type CreateSchoolWithUsersRequest struct {
	SchoolName string                `json:"schoolName"`
	Teacher    CreateSchoolUserInput `json:"teacher"`
	Parent     CreateSchoolUserInput `json:"parent"`
}

type CreateSchoolUserInput struct {
	Login    string `json:"login"`
	Password string `json:"password"`
	Label    string `json:"label"`
}

type CreateSchoolWithUsersResponse struct {
	School  School   `json:"school"`
	Teacher UserInfo `json:"teacher"`
	Parent  UserInfo `json:"parent"`
}

type CurrentUserResponse struct {
	User   UserInfo   `json:"user"`
	School SchoolInfo `json:"school"`
}

type GroupDetailsResponse struct {
	Group    Group           `json:"group"`
	Students []Student       `json:"students"`
	Lessons  []LessonPreview `json:"lessons"`
}

type GroupJournalResponse struct {
	Group    GroupJournalGroup     `json:"group"`
	Period   GroupJournalPeriod    `json:"period"`
	Students []GroupJournalStudent `json:"students"`
	Lessons  []GroupJournalLesson  `json:"lessons"`
	Entries  []GroupJournalEntry   `json:"entries"`
}

type GroupJournalGroup struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type GroupJournalPeriod struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type GroupJournalStudent struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Note string `json:"note"`
}

type GroupJournalLesson struct {
	ID       string `db:"id" json:"id"`
	Date     string `db:"date" json:"date"`
	Topic    string `db:"topic" json:"topic"`
	Homework string `db:"homework" json:"homework"`
}

type GroupJournalEntry struct {
	StudentID string `db:"student_id" json:"studentId"`
	LessonID  string `db:"lesson_id" json:"lessonId"`
	Attended  *bool  `db:"attended" json:"attended"`
	Grade     *int   `db:"grade" json:"grade"`
}

type LessonDetailsResponse struct {
	Lesson         Lesson          `json:"lesson"`
	Group          Group           `json:"group"`
	AttendanceRows []AttendanceRow `json:"attendanceRows"`
}

type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type OptionalBool struct {
	Set   bool
	Value *bool
}

func (o *OptionalBool) UnmarshalJSON(data []byte) error {
	o.Set = true
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		o.Value = nil
		return nil
	}

	var value bool
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}

	o.Value = &value
	return nil
}

type OptionalInt struct {
	Set   bool
	Value *int
}

func (o *OptionalInt) UnmarshalJSON(data []byte) error {
	o.Set = true
	if bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
		o.Value = nil
		return nil
	}

	var value int
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}

	o.Value = &value
	return nil
}
