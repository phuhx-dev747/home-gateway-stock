package ws

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"

	"phuhx-dev747/home-gateway-stock/internal/db"
	"phuhx-dev747/home-gateway-stock/internal/models"
	"phuhx-dev747/home-gateway-stock/internal/telemetry"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func Handler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}

	telemetry.ClientsMu.Lock()
	telemetry.Clients[conn] = true
	telemetry.ClientsMu.Unlock()

	defer func() {
		telemetry.ClientsMu.Lock()
		delete(telemetry.Clients, conn)
		telemetry.ClientsMu.Unlock()
		conn.Close()
	}()

	sendHistory(conn, "1h")

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var msg models.ClientMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}
		if msg.Action == "get_history" {
			sendHistory(conn, msg.Range)
		}
	}
}

func sendHistory(conn *websocket.Conn, rangeStr string) {
	items, err := db.QueryHistory(rangeStr)
	if err != nil {
		log.Printf("ws history query error: %v", err)
		return
	}
	b, _ := json.Marshal(map[string]interface{}{"type": "history", "data": items})
	conn.WriteMessage(websocket.TextMessage, b)
}
