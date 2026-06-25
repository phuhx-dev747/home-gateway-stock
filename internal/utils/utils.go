package utils

import (
	"encoding/json"
	"net/http"
	"os/exec"
)

// WriteJSON writes v as JSON with Content-Type header.
func WriteJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// WriteError writes a JSON error response.
func WriteError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// DecodeBody decodes a JSON POST body into v.
func DecodeBody(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// RequirePost returns false and writes 405 if not POST.
func RequirePost(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return false
	}
	return true
}

// RunCmd runs a command and returns combined output + exit code.
func RunCmd(name string, args ...string) ([]byte, int, error) {
	cmd := exec.Command(name, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return out, exitErr.ExitCode(), err
		}
		return out, 1, err
	}
	return out, 0, nil
}

// ParseRangeToSec converts a range string (e.g. "1h") to seconds.
func ParseRangeToSec(r string) int64 {
	switch r {
	case "15m":
		return 15 * 60
	case "30m":
		return 30 * 60
	case "1h":
		return 60 * 60
	case "4h":
		return 4 * 60 * 60
	case "24h":
		return 24 * 60 * 60
	default:
		return 60 * 60
	}
}
