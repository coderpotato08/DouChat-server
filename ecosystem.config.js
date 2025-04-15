module.exports = {
  apps: [
    {
      name: "chat-room-server",
      script: "./dist/index.js",
      instances: 1, // 集群模式（按 CPU 核心数启动）
      autorestart: true, // 崩溃自动重启
      watch: false, // 禁用文件监听（生产环境建议关闭）
      max_memory_restart: "1G", // 内存超限自动重启
      env: {
        NODE_ENV: "production", // 通用环境变量
      },
      env_development: {
        // 开发环境专用变量（通过 --env 指定）
        NODE_ENV: "development",
        DEBUG: "app:*",
      },
    },
  ],
};
