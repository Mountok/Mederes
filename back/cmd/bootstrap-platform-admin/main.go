package main

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"medrese-back/internal/config"
	"medrese-back/internal/models"
	"medrese-back/pkg/db"
)

const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
const loginLetters = "abcdefghijkmnopqrstuvwxyz23456789"

func secret(alphabet string, length int) (string, error) {
	data := make([]byte, length)
	for i := range data {
		var b [1]byte
		if _, err := rand.Read(b[:]); err != nil {
			return "", err
		}
		data[i] = alphabet[int(b[0])%len(alphabet)]
	}
	return string(data), nil
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	conn, err := db.Connect(cfg.DatabaseDSN())
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var count int
	if err := conn.GetContext(ctx, &count, `SELECT count(*) FROM users WHERE role='platform_admin'`); err != nil {
		log.Fatal("Сначала запустите backend для применения миграций: ", err)
	}
	if count != 0 {
		log.Fatal("Администратор платформы уже создан. Повторный запуск запрещён.")
	}
	suffix, err := secret(loginLetters, 12)
	if err != nil {
		log.Fatal(err)
	}
	password, err := secret(letters, 32)
	if err != nil {
		log.Fatal(err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}
	login := "owner-" + suffix
	_, err = conn.ExecContext(ctx, `INSERT INTO users (id, school_id, login, password_hash, role, label) VALUES ($1,$2,$3,$4,'platform_admin','Владелец платформы')`, uuid.NewString(), models.PlatformSchoolID, login, string(hash))
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Логин: %s\nПароль: %s\nСохраните пароль: повторно он не показывается.\n", login, password)
}
