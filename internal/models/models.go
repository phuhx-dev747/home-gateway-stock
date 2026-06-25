package models

type TelemetryData struct {
	CPU             float64   `json:"cpu"`
	Mem             float64   `json:"mem"`
	Temp            float64   `json:"temp"`
	MemUsed         uint64    `json:"memUsed"`
	MemTotal        uint64    `json:"memTotal"`
	Timestamp       int64     `json:"timestamp"`
	TopProcesses    []Process `json:"topProcesses"`
	TopCPUProcesses []Process `json:"topCPUProcesses"`
}

type Process struct {
	PID   int32   `json:"pid"`
	Name  string  `json:"name"`
	Mem   float32 `json:"mem"`
	CPU   float64 `json:"cpu"`
	RamMb float32 `json:"ramMb"`
}

type HistoryItem struct {
	CPU       float64 `json:"cpu"`
	Mem       float64 `json:"mem"`
	Temp      float64 `json:"temp"`
	MemUsed   uint64  `json:"memUsed"`
	MemTotal  uint64  `json:"memTotal"`
	Timestamp int64   `json:"timestamp"`
}

type ClientMessage struct {
	Action string `json:"action"`
	Range  string `json:"range"`
}

type PowerData struct {
	Today        float64 `json:"today"`
	Yesterday    float64 `json:"yesterday"`
	ThisMonth    float64 `json:"thisMonth"`
	LastMonth    float64 `json:"lastMonth"`
	TodayAvg     float64 `json:"todayAvg"`
	YesterdayAvg float64 `json:"yesterdayAvg"`
	Threshold    float64 `json:"threshold"`
	Status       string  `json:"status"`
}
