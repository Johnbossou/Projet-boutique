import { defineRailway, github, mysql, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const MySQL = mysql("MySQL", { region: "ams" });
  MySQL.deploy = { startCommand: "docker-entrypoint.sh mysqld --innodb-use-native-aio=0 --disable-log-bin --performance_schema=0 --innodb-buffer-pool-size=1G" };
  MySQL.networking = { privateNetworkEndpoint: "mysql" };
  const mysqlVolume = volume("mysql-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "ams", sizeMB: 500 });
  const sgciBackend = service("sgci-backend", {
    source: github("Johnbossou/Projet-boutique", { rootDirectory: "sgci-backend" }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    replicas: { "ams": 1 },
    env: { APP_KEY: preserve(), APP_URL: preserve(), DB_CONNECTION: preserve(), DB_DATABASE: preserve(), DB_HOST: preserve(), DB_PASSWORD: preserve(), DB_PORT: preserve(), DB_USERNAME: preserve(), FRONTEND_URL: preserve(), MYSQL_URL: preserve(), SANCTUM_STATEFUL_DOMAINS: preserve() },
  });

  return project("miraculous-charisma", {
    resources: [sgciBackend, MySQL, mysqlVolume],
  });
});
