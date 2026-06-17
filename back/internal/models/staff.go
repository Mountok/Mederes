package models

import "time"

type StaffProfile struct {
	ID         string    `db:"id" json:"id"`
	SchoolID   string    `db:"school_id" json:"-"`
	UserID     string    `db:"user_id" json:"userId"`
	FirstName  string    `db:"first_name" json:"firstName"`
	LastName   string    `db:"last_name" json:"lastName"`
	MiddleName string    `db:"middle_name" json:"middleName"`
	Phone      string    `db:"phone" json:"phone"`
	Note       string    `db:"note" json:"note"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt  time.Time `db:"updated_at" json:"updatedAt"`
}

type StaffGroupAssignment struct {
	ID        string    `db:"id" json:"id"`
	SchoolID  string    `db:"school_id" json:"-"`
	StaffID   string    `db:"staff_id" json:"staffId"`
	GroupID   string    `db:"group_id" json:"groupId"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

type StaffGroupInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type StaffDetails struct {
	ID         string           `json:"id"`
	UserID     string           `json:"userId"`
	FirstName  string           `json:"firstName"`
	LastName   string           `json:"lastName"`
	MiddleName string           `json:"middleName"`
	Phone      string           `json:"phone"`
	Note       string           `json:"note"`
	Groups     []StaffGroupInfo `json:"groups"`
}
