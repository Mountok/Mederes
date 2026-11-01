package handlers

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return f(request) }

func TestHomeworkAnalyzeSendsFullAudioToInternalAI(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reading.wav")
	audio := []byte("RIFF-sample-audio")
	if err := os.WriteFile(path, audio, 0600); err != nil {
		t.Fatal(err)
	}
	h := &HomeworkHandler{aiURL: "http://127.0.0.1:8001", client: &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.URL.Path != "/ai-api/listen/final" || request.URL.Query().Get("surah") != "112" || request.URL.Query().Get("ayah_from") != "1" || request.URL.Query().Get("ayah_to") != "4" {
			t.Fatalf("unexpected AI URL: %s", request.URL)
		}
		if request.Header.Get("X-Al-Qalam-Test") != "1" {
			t.Fatal("missing internal AI header")
		}
		if request.ContentLength != int64(len(audio)) {
			t.Fatalf("audio length = %d", request.ContentLength)
		}
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatal(err)
		}
		if string(body) != string(audio) {
			t.Fatal("audio changed before analysis")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"tracking":{"matched":2}}`)), Header: make(http.Header)}, nil
	})}}
	analysis, status := h.analyze(context.Background(), path, &homeworkAssignment{Surah: 112, AyahFrom: 1, AyahTo: 4})
	if status != "ready" || !strings.Contains(string(analysis), `"matched":2`) {
		t.Fatalf("status=%s, result=%s", status, analysis)
	}
}
