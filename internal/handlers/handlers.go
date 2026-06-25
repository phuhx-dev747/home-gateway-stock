package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"phuhx-dev747/home-gateway-stock/internal/models"
	"phuhx-dev747/home-gateway-stock/internal/utils"
)

// Terminal ---------------------------------------------------------------

func RunCommand(w http.ResponseWriter, r *http.Request) {
	if !utils.RequirePost(w, r) {
		return
	}
	var body struct {
		Command string `json:"command"`
	}
	if err := utils.DecodeBody(r, &body); err != nil || body.Command == "" {
		utils.WriteError(w, "invalid request", http.StatusBadRequest)
		return
	}
	out, code, _ := utils.RunCmd("bash", "-c", body.Command)
	utils.WriteJSON(w, map[string]interface{}{"output": string(out), "status": code})
}

// PM2 --------------------------------------------------------------------

func PM2List(w http.ResponseWriter, r *http.Request) {
	out, _, err := utils.RunCmd("pm2", "jlist")
	if err != nil {
		utils.WriteError(w, "failed to get PM2 list", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(out)
}

func PM2Action(w http.ResponseWriter, r *http.Request) {
	if !utils.RequirePost(w, r) {
		return
	}
	var body struct {
		Action string `json:"action"`
		Target string `json:"target"`
	}
	if err := utils.DecodeBody(r, &body); err != nil {
		utils.WriteError(w, "invalid request", http.StatusBadRequest)
		return
	}

	args, ok := pm2Args(body.Action, body.Target)
	if !ok {
		utils.WriteError(w, "unknown action", http.StatusBadRequest)
		return
	}
	out, _, err := utils.RunCmd("pm2", args...)
	if err != nil {
		utils.WriteError(w, string(out), http.StatusInternalServerError)
		return
	}
	utils.WriteJSON(w, map[string]string{"status": "ok"})
}

func pm2Args(action, target string) ([]string, bool) {
	switch action {
	case "stop":
		return []string{"stop", target}, true
	case "restart", "start":
		return []string{action, target}, true
	case "delete":
		return []string{"delete", target}, true
	}
	return nil, false
}

// Docker -----------------------------------------------------------------

func DockerContainers(w http.ResponseWriter, r *http.Request) {
	out, _, err := utils.RunCmd("docker", "ps", "-a", "--format",
		`{"ID":"{{.ID}}","Names":"{{.Names}}","Image":"{{.Image}}","Status":"{{.Status}}","State":"{{.State}}","Ports":"{{.Ports}}"}`)
	if err != nil {
		utils.WriteError(w, "failed to list containers", http.StatusInternalServerError)
		return
	}
	writeJSONLines(w, out)
}

func DockerImages(w http.ResponseWriter, r *http.Request) {
	out, _, err := utils.RunCmd("docker", "images", "--format",
		`{"ID":"{{.ID}}","Repository":"{{.Repository}}","Tag":"{{.Tag}}","CreatedSince":"{{.CreatedSince}}","Size":"{{.Size}}"}`)
	if err != nil {
		utils.WriteError(w, "failed to list images", http.StatusInternalServerError)
		return
	}
	writeJSONLines(w, out)
}

func DockerAction(w http.ResponseWriter, r *http.Request) {
	if !utils.RequirePost(w, r) {
		return
	}
	var body struct {
		Action string `json:"action"`
		Target string `json:"target"`
	}
	if err := utils.DecodeBody(r, &body); err != nil {
		utils.WriteError(w, "invalid request", http.StatusBadRequest)
		return
	}

	args, ok := dockerArgs(body.Action, body.Target)
	if !ok {
		utils.WriteError(w, "unknown action", http.StatusBadRequest)
		return
	}
	out, _, err := utils.RunCmd("docker", args...)
	if err != nil {
		utils.WriteError(w, string(out), http.StatusInternalServerError)
		return
	}
	utils.WriteJSON(w, map[string]string{"status": "ok"})
}

func dockerArgs(action, target string) ([]string, bool) {
	switch action {
	case "start":
		return []string{"start", target}, true
	case "stop":
		return []string{"stop", target}, true
	case "restart":
		return []string{"restart", target}, true
	case "remove_container":
		return []string{"rm", "-f", target}, true
	case "remove_image":
		return []string{"rmi", "-f", target}, true
	case "run_image":
		return []string{"run", "-d", target}, true
	}
	return nil, false
}

// writeJSONLines converts newline-delimited JSON objects to a JSON array.
func writeJSONLines(w http.ResponseWriter, out []byte) {
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var items []json.RawMessage
	for _, l := range lines {
		if l != "" {
			items = append(items, json.RawMessage(l))
		}
	}
	w.Header().Set("Content-Type", "application/json")
	if items == nil {
		w.Write([]byte("[]"))
		return
	}
	json.NewEncoder(w).Encode(items)
}

// Power ------------------------------------------------------------------

const (
	powerAlertsURL   = "https://cskh-api.cpc.vn/api/cskh/power-consumption-alerts/by-customer-code/PC12CC0501048"
	powerBearerToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijc4QTQzNUUxQzNDQzNGMzM2RDg2MkMyN0RBRTA3NjU3IiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3ODIwNjEzODEsImV4cCI6MTgxMzU5NzM4MSwiaXNzIjoiaHR0cHM6Ly9jc2toLWFwaS5jcGMudm4iLCJhdWQiOiJDU0tIIiwiY2xpZW50X2lkIjoiQ1NLSF9BcHAiLCJzdWIiOiIwNzk2NjcwZi01ZjUwLTk2ZjUtNzA2Yy0zYTE2Y2QzMDY5YmUiLCJhdXRoX3RpbWUiOjE3ODIwNjEzODEsImlkcCI6ImxvY2FsIiwicGhvbmVfbnVtYmVyIjoiMDM4NTE0NzgxMSIsInBob25lX251bWJlcl92ZXJpZmllZCI6IlRydWUiLCJlbWFpbCI6IjAzODUxNDc4MTFAY3BjLnZuIiwiZW1haWxfdmVyaWZpZWQiOiJGYWxzZSIsIkN1c3RvbWVyQ29kZXMiOiIiLCJuYW1lIjoiMDM4NTE0NzgxMSIsImlhdCI6MTc4MjA2MTM4MSwic2NvcGUiOlsiQ1NLSCJdLCJhbXIiOlsicHdkIl19.onYLgqTh7JJxS3n6aUWcdksVoe_C0kUkU-kRGcMvE7lV6CWDAwlMFZgioQv7NLZfv_xbAbW-VeyhORmF8OtZ3ECUPXiKlCZiksTBE9MCQja83f1dZX5BrnHO3-5lSmA_OGbtLpfGthMHmvV_HX4bNBAd2wcOIdqTVvGPnD9V3lMYBXz0aPAthUOytsLIqkyYBOETLkZi6ebAmiTdbrQ5pZ89TatzfBpl5yoLofABhHGfW2areuzGpE5juhYYtlk7_XbAYFrBZqB8iacFvN2ZEwJ0qbnhE8rMqa2o0tCQ6j7gvG-jxHuz-HhGLDgvuEC1BJ6agGaDhvTSV04plOe-ag"
)

// Format 1: {"statusCode":200,"data":{"alertThreshold":120,"electricUsedToday":...}}
type cpcWrapped struct {
	StatusCode int    `json:"statusCode"`
	Message    string `json:"message"`
	Data       struct {
		AlertThreshold           float64 `json:"alertThreshold"`
		ElectricUsedToday        float64 `json:"electricUsedToday"`
		ElectricUsedYesterday    float64 `json:"electricUsedYesterday"`
		ElectricUsedCurrentMonth float64 `json:"electricUsedCurrentMonth"`
		ElectricUsedLastMonth    float64 `json:"electricUsedLastMonth"`
	} `json:"data"`
}

// Format 2: {"electricConsumption":{"electricConsumptionToday":...,"electricConsumptionThresholdMonth":...}}
type cpcDirect struct {
	ElectricConsumption struct {
		Today          float64 `json:"electricConsumptionToday"`
		Yesterday      float64 `json:"electricConsumptionYesterday"`
		ThisMonth      float64 `json:"electricConsumptionThisMonth"`
		LastMonth      float64 `json:"electricConsumptionLastMonth"`
		ThresholdMonth float64 `json:"electricConsumptionThresholdMonth"`
		ThresholdDay   float64 `json:"electricConsumptionThresholdDay"`
	} `json:"electricConsumption"`
}

func parsePowerRaw(raw []byte) (today, yesterday, thisMonth, lastMonth, threshold float64, err error) {
	// Try format 1 first (statusCode wrapper)
	var f1 cpcWrapped
	if jsonErr := json.Unmarshal(raw, &f1); jsonErr == nil && f1.StatusCode == 200 {
		d := f1.Data
		return d.ElectricUsedToday, d.ElectricUsedYesterday,
			d.ElectricUsedCurrentMonth, d.ElectricUsedLastMonth,
			d.AlertThreshold, nil
	}

	// Try format 2 (direct electricConsumption)
	var f2 cpcDirect
	if jsonErr := json.Unmarshal(raw, &f2); jsonErr == nil && f2.ElectricConsumption.ThresholdMonth > 0 {
		c := f2.ElectricConsumption
		return c.Today, c.Yesterday, c.ThisMonth, c.LastMonth, c.ThresholdMonth, nil
	}

	err = fmt.Errorf("unrecognized CPC API response")
	return
}

func PowerConsumption(w http.ResponseWriter, r *http.Request) {
	req, err := http.NewRequest("GET", powerAlertsURL, nil)
	if err != nil {
		utils.WriteError(w, "failed to create request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Authorization", "Bearer "+powerBearerToken)
	req.Header.Set("Origin", "https://cskh.cpc.vn")
	req.Header.Set("Referer", "https://cskh.cpc.vn/")
	req.Header.Set("User-Agent", "Mozilla/5.0")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		utils.WriteError(w, "failed to fetch power data", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	today, yesterday, thisMonth, lastMonth, threshold, err := parsePowerRaw(raw)
	if err != nil {
		utils.WriteError(w, "unrecognized power data format", http.StatusBadGateway)
		return
	}

	status := "active"
	if thisMonth == 0 {
		status = "inactive"
	} else if threshold > 0 && thisMonth >= threshold*0.9 {
		status = "warning"
	}

	now := time.Now()
	hoursToday := float64(now.Hour()) + float64(now.Minute())/60.0
	utils.WriteJSON(w, models.PowerData{
		Today:        today,
		Yesterday:    yesterday,
		ThisMonth:    thisMonth,
		LastMonth:    lastMonth,
		TodayAvg:     safeDivide(today, hoursToday),
		YesterdayAvg: safeDivide(yesterday, 24),
		Threshold:    threshold,
		Status:       status,
	})
}

func safeDivide(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}



