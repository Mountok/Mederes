package models

import "time"

const PlatformSchoolID = "00000000-0000-0000-0000-000000000001"

type PlatformSchool struct {
	ID           string    `db:"id" json:"id"`
	Name         string    `db:"name" json:"name"`
	CreatedAt    time.Time `db:"created_at" json:"createdAt"`
	GroupCount   int       `db:"group_count" json:"groupCount"`
	StudentCount int       `db:"student_count" json:"studentCount"`
	StaffCount   int       `db:"staff_count" json:"staffCount"`
	AdminCount   int       `db:"admin_count" json:"adminCount"`
}

type PlatformUser struct {
	ID    string `db:"id" json:"id"`
	Login string `db:"login" json:"login"`
	Role  string `db:"role" json:"role"`
	Label string `db:"label" json:"label"`
}

type CreatePlatformSchoolRequest struct {
	Name       string `json:"name"`
	AdminLogin string `json:"adminLogin"`
	AdminLabel string `json:"adminLabel"`
}

type RenamePlatformSchoolRequest struct {
	Name string `json:"name"`
}

type PlatformAccountResponse struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}
