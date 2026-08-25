export default {
  "$schema": "https://railway.com/railway.schema.json",
  services: {
    "sgci-backend": {
      source: {
        rootDirectory: "sgci-backend",
      },
      deploy: {
        startCommand: "/usr/local/bin/start.sh",
      },
    },
  },
};
