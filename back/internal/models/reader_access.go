package models

import "time"

const ReaderTrialLimit = 3

type ReaderAccess struct {
	TrialLimit        int        `json:"trialLimit"`
	Used              int        `db:"trial_used" json:"used"`
	Remaining         int        `json:"remaining"`
	SubscriptionUntil *time.Time `db:"subscription_until" json:"subscriptionUntil"`
	Subscribed        bool       `db:"subscribed" json:"subscribed"`
}
