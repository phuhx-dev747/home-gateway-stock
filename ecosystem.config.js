module.exports = {
  apps: [
    {
      name: "gateway-monitor",
      script: "./gateway-monitor",
      cwd: "/home/miner/projects/home-gateway-stock",
      env: {
        PORT: "3001",
      },
    },
  ],
};