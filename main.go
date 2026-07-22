package main

import (
	"log"
	"net/http"
	"os"

	"phuhx-dev747/home-gateway-stock/internal/db"
	"phuhx-dev747/home-gateway-stock/internal/handlers"
	"phuhx-dev747/home-gateway-stock/internal/telemetry"
	"phuhx-dev747/home-gateway-stock/internal/ws"
)

func main() {
	if err := db.Init("./gateway_telemetry.db"); err != nil {
		log.Fatalf("db init: %v", err)
	}
	defer db.DB.Close()

	go telemetry.CollectAndBroadcast()

	http.Handle("/", http.FileServer(http.Dir("./public")))
	http.HandleFunc("/ws", ws.Handler)
	http.HandleFunc("/api/run", handlers.RunCommand)
	http.HandleFunc("/api/pm2/list", handlers.PM2List)
	http.HandleFunc("/api/pm2/action", handlers.PM2Action)
	http.HandleFunc("/api/docker/containers", handlers.DockerContainers)
	http.HandleFunc("/api/docker/images", handlers.DockerImages)
	http.HandleFunc("/api/docker/action", handlers.DockerAction)
	http.HandleFunc("/api/power", handlers.PowerConsumption)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	log.Printf("gateway monitor :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("server: %v", err)
	}
}
