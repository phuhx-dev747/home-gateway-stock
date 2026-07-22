package telemetry

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
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

// prevCPU stores the last CPU times per PID for delta calculation.
var (
	prevCPU   = make(map[int32]*cpu.TimesStat)
	prevCPUMu sync.Mutex
)

// Collect gathers CPU, RAM, and temp (light — no process scan).
func Collect() (models.TelemetryData, error) {
	cpuPct, err := getCPUPercent()
	if err != nil {
		return models.TelemetryData{}, fmt.Errorf("cpu: %v", err)
	}

	vm, err := mem.VirtualMemory()
	if err != nil {
		return models.TelemetryData{}, fmt.Errorf("mem: %v", err)
	}

	tempVal := readCPUTemp()

	return models.TelemetryData{
		CPU:       cpuPct,
		Mem:       vm.UsedPercent,
		Temp:      tempVal,
		MemUsed:   vm.Used / (1024 * 1024),
		MemTotal:  vm.Total / (1024 * 1024),
		Timestamp: time.Now().UnixMilli(),
	}, nil
}

// getCPUPercent returns overall CPU% using a non-blocking interval approach.
var (
	cpuPrevTotal float64
	cpuPrevIdle  float64
	cpuPrevSet   bool
)

func getCPUPercent() (float64, error) {
	times, err := cpu.Times(false)
	if err != nil || len(times) == 0 {
		return 0, err
	}
	var totalNow, idleNow float64
	for _, t := range times {
		totalNow += t.Total()
		idleNow += t.Idle
	}

	if cpuPrevSet {
		deltaTotal := totalNow - cpuPrevTotal
		deltaIdle := idleNow - cpuPrevIdle
		if deltaTotal == 0 {
			return 0, nil
		}
		pct := (1.0 - deltaIdle/deltaTotal) * 100.0
		if math.IsNaN(pct) || math.IsInf(pct, 0) || pct < 0 {
			pct = 0
		}
		return pct, nil
	}
	cpuPrevTotal = totalNow
	cpuPrevIdle = idleNow
	cpuPrevSet = true
	return 0, nil
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

// scanProcesses gathers top-N by RAM and by CPU. CPU% is computed via
// delta from the previous scan so the first call always returns 0 — callers
// should cache results and reuse them across collections.
func scanProcesses(limit int) (byRAM, byCPU []models.Process) {
	procs, err := process.Processes()
	if err != nil {
		return
	}

	var all []procInfo
	for _, p := range procs {
		memPct, e1 := p.MemoryPercent()
		name, e3 := p.Name()
		if e1 != nil || e3 != nil {
			continue
		}
		mi, _ := p.MemoryInfo()
		var ramMb float32
		if mi != nil {
			ramMb = float32(mi.RSS) / (1024 * 1024)
		}

		cpuPct := 0.0
		times, err := p.Times()
		if err == nil && times != nil {
			totalNow := times.Total()
			prevCPUMu.Lock()
			if prev := prevCPU[p.Pid]; prev != nil {
				dt := totalNow - prev.Total()
				di := times.Idle - prev.Idle
				if dt > 0 {
					cpuPct = (1.0 - di/dt) * 100.0
					if math.IsNaN(cpuPct) || cpuPct < 0 {
						cpuPct = 0
					}
				}
			}
			prevCPU[p.Pid] = times
			prevCPUMu.Unlock()
		}

		all = append(all, procInfo{pid: p.Pid, name: name, mem: memPct, cpu: cpuPct, ramMb: ramMb})
	}

	sort.Slice(all, func(i, j int) bool { return all[i].mem > all[j].mem })
	byRAM = topN(all, limit)

	sort.Slice(all, func(i, j int) bool { return all[i].cpu > all[j].cpu })
	byCPU = topN(all, limit)
	return
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
// CPU/RAM/temp are collected every 2s; process list every 5s; DB cleanup every 5min.
func CollectAndBroadcast() {
	tick := time.NewTicker(2 * time.Second)
	procTick := time.NewTicker(5 * time.Second)
	dbCleanupTick := time.NewTicker(5 * time.Minute)
	defer tick.Stop()
	defer procTick.Stop()
	defer dbCleanupTick.Stop()

	// Initial process scan
	byRAM, byCPU := scanProcesses(10)

	for {
		select {
		case <-tick.C:
			data, err := Collect()
			if err != nil {
				log.Printf("telemetry error: %v", err)
				continue
			}

			LatestMu.Lock()
			Latest.CPU = data.CPU
			Latest.Mem = data.Mem
			Latest.Temp = data.Temp
			Latest.MemUsed = data.MemUsed
			Latest.MemTotal = data.MemTotal
			Latest.Timestamp = data.Timestamp
			Latest.TopProcesses = byRAM
			Latest.TopCPUProcesses = byCPU
			LatestMu.Unlock()

			db.InsertTelemetry(data)
			broadcastTelemetry(Latest)

		case <-procTick.C:
			byRAM, byCPU = scanProcesses(10)
			LatestMu.Lock()
			Latest.TopProcesses = byRAM
			Latest.TopCPUProcesses = byCPU
			LatestMu.Unlock()
			broadcastTelemetry(Latest)

		case <-dbCleanupTick.C:
			db.CleanupOld()
		}
	}
}

// broadcastTelemetry sends telemetry data to all connected WebSocket clients.
func broadcastTelemetry(data models.TelemetryData) {
	b, err := json.Marshal(map[string]interface{}{"type": "realtime", "data": data})
	if err != nil {
		return
	}
	ClientsMu.Lock()
	defer ClientsMu.Unlock()
	var closed []*websocket.Conn
	for conn := range Clients {
		if err := conn.WriteMessage(websocket.TextMessage, b); err != nil {
			conn.Close()
			closed = append(closed, conn)
		}
	}
	for _, conn := range closed {
		delete(Clients, conn)
	}
}
