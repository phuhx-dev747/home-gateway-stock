package telemetry

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/process"

	"phuhx-dev747/home-gateway-stock/internal/db"
	"phuhx-dev747/home-gateway-stock/internal/models"
)

var (
	Latest   models.TelemetryData
	LatestMu sync.RWMutex

	Clients   = make(map[*websocket.Conn]bool)
	ClientsMu sync.Mutex
)

// Collect gathers CPU, RAM, temp and top processes.
func Collect() (models.TelemetryData, error) {
	cpuPcts, err := cpu.Percent(500*time.Millisecond, false)
	if err != nil || len(cpuPcts) == 0 {
		return models.TelemetryData{}, fmt.Errorf("cpu: %v", err)
	}

	vm, err := mem.VirtualMemory()
	if err != nil {
		return models.TelemetryData{}, fmt.Errorf("mem: %v", err)
	}

	tempVal := readCPUTemp()
	topRAM, topCPU := topProcesses(10)

	return models.TelemetryData{
		CPU:             cpuPcts[0],
		Mem:             vm.UsedPercent,
		Temp:            tempVal,
		MemUsed:         vm.Used / (1024 * 1024),
		MemTotal:        vm.Total / (1024 * 1024),
		Timestamp:       time.Now().UnixMilli(),
		TopProcesses:    topRAM,
		TopCPUProcesses: topCPU,
	}, nil
}

func readCPUTemp() float64 {
	temps, err := host.SensorsTemperatures()
	if err != nil {
		return 0
	}
	var best float64
	for _, t := range temps {
		key := strings.ToLower(t.SensorKey)
		if strings.Contains(key, "cpu") || strings.Contains(key, "core") || strings.Contains(key, "package") {
			if t.Temperature > best {
				best = t.Temperature
			}
		}
	}
	if best == 0 && len(temps) > 0 {
		best = temps[0].Temperature
	}
	return best
}

type procInfo struct {
	pid   int32
	name  string
	mem   float32
	cpu   float64
	ramMb float32
}

func topProcesses(limit int) (byRAM, byCPU []models.Process) {
	procs, err := process.Processes()
	if err != nil {
		return
	}

	var all []procInfo
	for _, p := range procs {
		memPct, e1 := p.MemoryPercent()
		cpuPct, e2 := p.CPUPercent()
		name, e3 := p.Name()
		if e1 != nil || e2 != nil || e3 != nil {
			continue
		}
		mi, _ := p.MemoryInfo()
		var ramMb float32
		if mi != nil {
			ramMb = float32(mi.RSS) / (1024 * 1024)
		}
		all = append(all, procInfo{pid: p.Pid, name: name, mem: memPct, cpu: cpuPct, ramMb: ramMb})
	}

	byRAM = topN(sortBy(all, func(a, b procInfo) bool { return a.mem > b.mem }), limit)
	byCPU = topN(sortBy(all, func(a, b procInfo) bool { return a.cpu > b.cpu }), limit)
	return
}

func sortBy(s []procInfo, less func(a, b procInfo) bool) []procInfo {
	cp := append([]procInfo(nil), s...)
	for i := 0; i < len(cp)-1; i++ {
		for j := i + 1; j < len(cp); j++ {
			if less(cp[j], cp[i]) {
				cp[i], cp[j] = cp[j], cp[i]
			}
		}
	}
	return cp
}

func topN(s []procInfo, n int) []models.Process {
	if len(s) < n {
		n = len(s)
	}
	out := make([]models.Process, n)
	for i := 0; i < n; i++ {
		out[i] = models.Process{PID: s[i].pid, Name: s[i].name, Mem: s[i].mem, CPU: s[i].cpu, RamMb: s[i].ramMb}
	}
	return out
}

// CollectAndBroadcast loops forever collecting telemetry and broadcasting to WS clients.
func CollectAndBroadcast() {
	for {
		data, err := Collect()
		if err != nil {
			log.Printf("telemetry error: %v", err)
			time.Sleep(10 * time.Second)
			continue
		}

		LatestMu.Lock()
		Latest = data
		LatestMu.Unlock()

		db.InsertTelemetry(data)
		BroadcastJSON(map[string]interface{}{"type": "realtime", "data": data})
		time.Sleep(1 * time.Second)
	}
}

// BroadcastJSON sends a JSON message to all connected WebSocket clients.
func BroadcastJSON(v interface{}) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	ClientsMu.Lock()
	defer ClientsMu.Unlock()
	for conn := range Clients {
		if err := conn.WriteMessage(websocket.TextMessage, b); err != nil {
			conn.Close()
			delete(Clients, conn)
		}
	}
}
