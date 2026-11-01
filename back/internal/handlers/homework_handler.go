package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"

	"medrese-back/internal/middleware"
	"medrese-back/internal/models"
	"medrese-back/internal/services"
)

type HomeworkHandler struct {
	db       *sqlx.DB
	access   *services.AccessService
	logger   *logrus.Logger
	audioDir string
	aiURL    string
	client   *http.Client
}

type homeworkAssignment struct {
	ID        string     `db:"id" json:"id"`
	SchoolID  string     `db:"school_id" json:"-"`
	GroupID   string     `db:"group_id" json:"groupId"`
	GroupName string     `db:"group_name" json:"groupName"`
	Kind      string     `db:"kind" json:"kind"`
	Title     string     `db:"title" json:"title"`
	Surah     int        `db:"surah" json:"surah"`
	AyahFrom  int        `db:"ayah_from" json:"ayahFrom"`
	AyahTo    int        `db:"ayah_to" json:"ayahTo"`
	DueAt     *time.Time `db:"due_at" json:"dueAt"`
	CreatedAt time.Time  `db:"created_at" json:"createdAt"`
	MyStatus  *string    `db:"my_status" json:"myStatus,omitempty"`
}

type homeworkSubmission struct {
	StudentID      string          `db:"student_id" json:"studentId"`
	StudentName    string          `db:"student_name" json:"studentName"`
	Status         string          `db:"status" json:"status"`
	AudioPath      *string         `db:"audio_path" json:"-"`
	HasAudio       bool            `json:"hasAudio"`
	AnalysisText   string          `db:"analysis_text" json:"-"`
	Analysis       json.RawMessage `db:"-" json:"analysis,omitempty"`
	AnalysisStatus string          `db:"analysis_status" json:"analysisStatus"`
	Grade          *int            `db:"grade" json:"grade"`
	TeacherComment string          `db:"teacher_comment" json:"teacherComment"`
	SubmittedAt    time.Time       `db:"submitted_at" json:"submittedAt"`
	ReviewedAt     *time.Time      `db:"reviewed_at" json:"reviewedAt"`
}

type createHomeworkRequest struct {
	GroupID  string `json:"groupId"`
	Kind     string `json:"kind"`
	Title    string `json:"title"`
	Surah    int    `json:"surah"`
	AyahFrom int    `json:"ayahFrom"`
	AyahTo   int    `json:"ayahTo"`
	DueAt    string `json:"dueAt"`
}

func NewHomeworkHandler(db *sqlx.DB, access *services.AccessService, logger *logrus.Logger, audioDir, aiURL string) *HomeworkHandler {
	return &HomeworkHandler{db: db, access: access, logger: logger, audioDir: audioDir, aiURL: strings.TrimRight(aiURL, "/"), client: &http.Client{Timeout: 65 * time.Second}}
}

func (h *HomeworkHandler) claims(c *gin.Context) (*models.AppError, string, string, string) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		return models.UnauthorizedError("Требуется авторизация"), "", "", ""
	}
	return nil, claims.SchoolID, claims.UserID, claims.StudentID
}

func (h *HomeworkHandler) assignment(ctx context.Context, id, schoolID string) (*homeworkAssignment, error) {
	if _, err := uuid.Parse(id); err != nil {
		return nil, models.NotFoundError("Задание не найдено")
	}
	var a homeworkAssignment
	err := h.db.GetContext(ctx, &a, `SELECT a.id,a.school_id,a.group_id,g.name AS group_name,a.kind,a.title,a.surah,a.ayah_from,a.ayah_to,a.due_at,a.created_at FROM homework_assignments a JOIN groups g ON g.id=a.group_id AND g.school_id=a.school_id WHERE a.id=$1 AND a.school_id=$2`, id, schoolID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, models.NotFoundError("Задание не найдено")
	}
	if err != nil {
		return nil, models.InternalError("Не удалось открыть задание", err)
	}
	return &a, nil
}

func (h *HomeworkHandler) permitted(ctx context.Context, c *gin.Context, a *homeworkAssignment, manage bool) error {
	claims, _ := middleware.GetClaims(c)
	var allowed bool
	var err error
	if manage {
		allowed, err = h.access.CanManageGroup(ctx, claims, a.GroupID)
	} else {
		allowed, err = h.access.CanViewGroup(ctx, claims, a.GroupID)
	}
	if err != nil {
		return models.InternalError("Не удалось проверить доступ", err)
	}
	if !allowed || claims.Role == "parent" {
		return models.ForbiddenError("Нет доступа к заданию")
	}
	return nil
}

func (h *HomeworkHandler) List(c *gin.Context) {
	claims, _ := middleware.GetClaims(c)
	if claims.Role == "parent" {
		respondError(c, h.logger, models.ForbiddenError("Нет доступа к заданиям"))
		return
	}
	var all []homeworkAssignment
	err := h.db.SelectContext(c.Request.Context(), &all, `SELECT a.id,a.school_id,a.group_id,g.name AS group_name,a.kind,a.title,a.surah,a.ayah_from,a.ayah_to,a.due_at,a.created_at FROM homework_assignments a JOIN groups g ON g.id=a.group_id AND g.school_id=a.school_id WHERE a.school_id=$1 ORDER BY a.created_at DESC LIMIT 200`, claims.SchoolID)
	if err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось загрузить задания", err))
		return
	}
	result := make([]homeworkAssignment, 0, len(all))
	for _, a := range all {
		if err := h.permitted(c.Request.Context(), c, &a, false); err != nil {
			continue
		}
		if claims.Role == "student" {
			var status string
			err := h.db.GetContext(c.Request.Context(), &status, `SELECT status FROM homework_submissions WHERE assignment_id=$1 AND student_id=$2 AND school_id=$3`, a.ID, claims.StudentID, claims.SchoolID)
			if err == nil {
				a.MyStatus = &status
			} else if !errors.Is(err, sql.ErrNoRows) {
				respondError(c, h.logger, models.InternalError("Не удалось загрузить состояние задания", err))
				return
			}
		}
		result = append(result, a)
	}
	c.JSON(http.StatusOK, result)
}

func (h *HomeworkHandler) Create(c *gin.Context) {
	claims, _ := middleware.GetClaims(c)
	var request createHomeworkRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, h.logger, models.ValidationError("Некорректные данные задания"))
		return
	}
	request.Title = strings.TrimSpace(request.Title)
	if _, err := uuid.Parse(request.GroupID); err != nil {
		respondError(c, h.logger, models.ValidationError("Выберите группу"))
		return
	}
	if request.Kind != "read" && request.Kind != "listen" && request.Kind != "recite" {
		respondError(c, h.logger, models.ValidationError("Выберите тип задания"))
		return
	}
	if len(request.Title) == 0 || len([]rune(request.Title)) > 120 {
		respondError(c, h.logger, models.ValidationError("Название должно содержать до 120 символов"))
		return
	}
	if request.Surah < 1 || request.Surah > 114 || request.AyahFrom < 1 || request.AyahTo < request.AyahFrom || request.AyahTo > request.AyahFrom+9 {
		respondError(c, h.logger, models.ValidationError("Укажите корректный диапазон до 10 аятов"))
		return
	}
	if err := h.permitted(c.Request.Context(), c, &homeworkAssignment{GroupID: request.GroupID}, true); err != nil {
		respondError(c, h.logger, err)
		return
	}
	var due *time.Time
	if request.DueAt != "" {
		value, err := time.Parse(time.RFC3339, request.DueAt)
		if err != nil {
			respondError(c, h.logger, models.ValidationError("Некорректный срок"))
			return
		}
		due = &value
	}
	id := uuid.NewString()
	_, err := h.db.ExecContext(c.Request.Context(), `INSERT INTO homework_assignments(id,school_id,group_id,created_by,kind,title,surah,ayah_from,ayah_to,due_at) SELECT $1,$2,g.id,$4,$5,$6,$7,$8,$9,$10 FROM groups g WHERE g.id=$3 AND g.school_id=$2`, id, claims.SchoolID, request.GroupID, claims.UserID, request.Kind, request.Title, request.Surah, request.AyahFrom, request.AyahTo, due)
	if err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось создать задание", err))
		return
	}
	a, err := h.assignment(c.Request.Context(), id, claims.SchoolID)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	c.JSON(http.StatusCreated, a)
}

func (h *HomeworkHandler) Get(c *gin.Context) {
	claims, _ := middleware.GetClaims(c)
	a, err := h.assignment(c.Request.Context(), c.Param("id"), claims.SchoolID)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	if err = h.permitted(c.Request.Context(), c, a, false); err != nil {
		respondError(c, h.logger, err)
		return
	}
	submissions := make([]homeworkSubmission, 0)
	if claims.Role == "student" {
		err = h.db.SelectContext(c.Request.Context(), &submissions, `SELECT s.student_id,st.name AS student_name,s.status,s.audio_path,COALESCE(s.analysis::text,'') AS analysis_text,s.analysis_status,s.grade,s.teacher_comment,s.submitted_at,s.reviewed_at FROM homework_submissions s JOIN students st ON st.id=s.student_id WHERE s.assignment_id=$1 AND s.student_id=$2 AND s.school_id=$3`, a.ID, claims.StudentID, claims.SchoolID)
	} else {
		err = h.db.SelectContext(c.Request.Context(), &submissions, `SELECT st.id AS student_id,st.name AS student_name,COALESCE(s.status,'pending') AS status,s.audio_path,COALESCE(s.analysis::text,'') AS analysis_text,COALESCE(s.analysis_status,'none') AS analysis_status,s.grade,COALESCE(s.teacher_comment,'') AS teacher_comment,COALESCE(s.submitted_at,a.created_at) AS submitted_at,s.reviewed_at FROM students st CROSS JOIN homework_assignments a LEFT JOIN homework_submissions s ON s.assignment_id=a.id AND s.student_id=st.id WHERE a.id=$1 AND a.school_id=$2 AND st.group_id=a.group_id AND st.school_id=a.school_id ORDER BY st.name`, a.ID, claims.SchoolID)
	}
	if err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось загрузить ответы", err))
		return
	}
	for i := range submissions {
		submissions[i].HasAudio = submissions[i].AudioPath != nil
		if submissions[i].AnalysisText != "" {
			submissions[i].Analysis = json.RawMessage(submissions[i].AnalysisText)
		}
		if claims.Role == "student" && submissions[i].Status != "reviewed" {
			submissions[i].Analysis = nil
			submissions[i].Grade = nil
			submissions[i].TeacherComment = ""
		}
	}
	c.JSON(http.StatusOK, gin.H{"assignment": a, "submissions": submissions})
}

func (h *HomeworkHandler) Complete(c *gin.Context) {
	claims, _ := middleware.GetClaims(c)
	a, err := h.assignment(c.Request.Context(), c.Param("id"), claims.SchoolID)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	if a.Kind == "recite" {
		respondError(c, h.logger, models.ValidationError("Для этого задания нужна запись"))
		return
	}
	if err = h.permitted(c.Request.Context(), c, a, false); err != nil {
		respondError(c, h.logger, err)
		return
	}
	id := uuid.NewString()
	_, err = h.db.ExecContext(c.Request.Context(), `INSERT INTO homework_submissions(id,assignment_id,school_id,student_id,status) VALUES($1,$2,$3,$4,'completed') ON CONFLICT (assignment_id,student_id) DO NOTHING`, id, a.ID, claims.SchoolID, claims.StudentID)
	if err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось отметить задание", err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "completed"})
}

func (h *HomeworkHandler) Submit(c *gin.Context) {
	claims, _ := middleware.GetClaims(c)
	a, err := h.assignment(c.Request.Context(), c.Param("id"), claims.SchoolID)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	if a.Kind != "recite" {
		respondError(c, h.logger, models.ValidationError("Запись не требуется"))
		return
	}
	if err = h.permitted(c.Request.Context(), c, a, false); err != nil {
		respondError(c, h.logger, err)
		return
	}
	var exists bool
	if err = h.db.GetContext(c.Request.Context(), &exists, `SELECT EXISTS(SELECT 1 FROM homework_submissions WHERE assignment_id=$1 AND student_id=$2)`, a.ID, claims.StudentID); err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось проверить ответ", err))
		return
	}
	if exists {
		respondError(c, h.logger, models.ConflictError("Запись уже отправлена"))
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 22<<20)
	file, err := c.FormFile("audio")
	if err != nil || file.Size < 1000 || file.Size > 20<<20 {
		respondError(c, h.logger, models.ValidationError("Нужна запись до 20 МБ"))
		return
	}
	src, err := file.Open()
	if err != nil {
		respondError(c, h.logger, models.ValidationError("Не удалось открыть запись"))
		return
	}
	defer src.Close()
	header := make([]byte, 512)
	n, _ := io.ReadFull(src, header)
	mime := http.DetectContentType(header[:n])
	if !strings.HasPrefix(mime, "audio/") && mime != "application/octet-stream" && mime != "video/webm" && mime != "video/mp4" {
		respondError(c, h.logger, models.ValidationError("Нужен аудиофайл"))
		return
	}
	if _, err = src.Seek(0, io.SeekStart); err != nil {
		respondError(c, h.logger, models.ValidationError("Не удалось прочитать запись"))
		return
	}
	dir := filepath.Join(h.audioDir, claims.SchoolID)
	if err = os.MkdirAll(dir, 0700); err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось сохранить запись", err))
		return
	}
	id := uuid.NewString()
	path := filepath.Join(dir, id+".audio")
	dst, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось сохранить запись", err))
		return
	}
	_, copyErr := io.Copy(dst, io.LimitReader(src, (20<<20)+1))
	closeErr := dst.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(path)
		respondError(c, h.logger, models.InternalError("Не удалось сохранить запись", errors.Join(copyErr, closeErr)))
		return
	}
	analysis, analysisStatus := h.analyze(c.Request.Context(), path, a)
	var analysisValue any
	if len(analysis) > 0 {
		analysisValue = string(analysis)
	}
	_, err = h.db.ExecContext(c.Request.Context(), `INSERT INTO homework_submissions(id,assignment_id,school_id,student_id,status,audio_path,analysis,analysis_status) VALUES($1,$2,$3,$4,'submitted',$5,$6::jsonb,$7)`, id, a.ID, claims.SchoolID, claims.StudentID, path, analysisValue, analysisStatus)
	if err != nil {
		_ = os.Remove(path)
		respondError(c, h.logger, models.InternalError("Не удалось отправить запись", err))
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "submitted", "analysisStatus": analysisStatus, "analysis": analysis})
}

func (h *HomeworkHandler) analyze(ctx context.Context, path string, a *homeworkAssignment) (json.RawMessage, string) {
	file, err := os.Open(path)
	if err != nil {
		return nil, "unavailable"
	}
	defer file.Close()
	q := url.Values{"surah": {fmt.Sprint(a.Surah)}, "ayah_from": {fmt.Sprint(a.AyahFrom)}, "ayah_to": {fmt.Sprint(a.AyahTo)}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.aiURL+"/ai-api/listen/final?"+q.Encode(), file)
	if err != nil {
		return nil, "unavailable"
	}
	info, err := file.Stat()
	if err != nil {
		return nil, "unavailable"
	}
	req.ContentLength = info.Size()
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("X-Al-Qalam-Test", "1")
	res, err := h.client.Do(req)
	if err != nil {
		h.logger.WithError(err).Warn("homework AI unavailable")
		return nil, "unavailable"
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, "unavailable"
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil || !json.Valid(body) || !bytes.Contains(body, []byte(`"tracking"`)) {
		return nil, "unavailable"
	}
	return json.RawMessage(body), "ready"
}

func (h *HomeworkHandler) Audio(c *gin.Context) {
	claims, _ := middleware.GetClaims(c)
	a, err := h.assignment(c.Request.Context(), c.Param("id"), claims.SchoolID)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	if err = h.permitted(c.Request.Context(), c, a, false); err != nil {
		respondError(c, h.logger, err)
		return
	}
	studentID := c.Param("studentId")
	if claims.Role == "student" && studentID != claims.StudentID {
		respondError(c, h.logger, models.ForbiddenError("Нет доступа к записи"))
		return
	}
	if _, err = uuid.Parse(studentID); err != nil {
		respondError(c, h.logger, models.NotFoundError("Запись не найдена"))
		return
	}
	var path string
	err = h.db.GetContext(c.Request.Context(), &path, `SELECT audio_path FROM homework_submissions WHERE assignment_id=$1 AND student_id=$2 AND school_id=$3 AND audio_path IS NOT NULL`, a.ID, studentID, claims.SchoolID)
	if errors.Is(err, sql.ErrNoRows) {
		respondError(c, h.logger, models.NotFoundError("Запись не найдена"))
		return
	}
	if err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось открыть запись", err))
		return
	}
	file, err := os.Open(path)
	if err != nil {
		respondError(c, h.logger, models.NotFoundError("Запись не найдена"))
		return
	}
	defer file.Close()
	header := make([]byte, 512)
	n, _ := file.Read(header)
	mime := http.DetectContentType(header[:n])
	if mime == "video/mp4" {
		mime = "audio/mp4"
	}
	if mime == "video/webm" {
		mime = "audio/webm"
	}
	c.Header("Content-Type", mime)
	c.Header("Cache-Control", "private, no-store")
	c.File(path)
}

func (h *HomeworkHandler) Review(c *gin.Context) {
	claims, _ := middleware.GetClaims(c)
	a, err := h.assignment(c.Request.Context(), c.Param("id"), claims.SchoolID)
	if err != nil {
		respondError(c, h.logger, err)
		return
	}
	if err = h.permitted(c.Request.Context(), c, a, true); err != nil {
		respondError(c, h.logger, err)
		return
	}
	studentID := c.Param("studentId")
	if _, err = uuid.Parse(studentID); err != nil {
		respondError(c, h.logger, models.NotFoundError("Ответ не найден"))
		return
	}
	var req struct {
		Grade   *int   `json:"grade"`
		Comment string `json:"comment"`
	}
	if err = c.ShouldBindJSON(&req); err != nil || len([]rune(req.Comment)) > 2000 || (req.Grade != nil && (*req.Grade < 1 || *req.Grade > 5)) {
		respondError(c, h.logger, models.ValidationError("Проверьте оценку и комментарий"))
		return
	}
	result, err := h.db.ExecContext(c.Request.Context(), `UPDATE homework_submissions SET status='reviewed',grade=$1,teacher_comment=$2,reviewed_by=$3,reviewed_at=NOW() WHERE assignment_id=$4 AND student_id=$5 AND school_id=$6 AND status IN ('submitted','reviewed')`, req.Grade, strings.TrimSpace(req.Comment), claims.UserID, a.ID, studentID, claims.SchoolID)
	if err != nil {
		respondError(c, h.logger, models.InternalError("Не удалось сохранить проверку", err))
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		respondError(c, h.logger, models.NotFoundError("Отправленная запись не найдена"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "reviewed"})
}
