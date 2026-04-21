FROM maven:3.9.9-eclipse-temurin-21 AS backend-build

RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src

RUN git clone --filter=blob:none --sparse https://github.com/orkanix/plus-smart-home-tech.git . \
  && git sparse-checkout set --no-cone pom.xml 'infra/**' 'telemetry/**' \
  && sed -i '/<module>commerce<\/module>/d' pom.xml \
  && mvn -q -pl infra/discovery-server,infra/config-server,telemetry/collector -am -DskipTests package

FROM eclipse-temurin:21-jre AS discovery-server
WORKDIR /app
COPY --from=backend-build /src/infra/discovery-server/target/*.jar /app/app.jar
EXPOSE 8761
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

FROM eclipse-temurin:21-jre AS config-server
WORKDIR /app
COPY --from=backend-build /src/infra/config-server/target/*.jar /app/app.jar
EXPOSE 8888
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

FROM eclipse-temurin:21-jre AS collector
WORKDIR /app
COPY --from=backend-build /src/telemetry/collector/target/*.jar /app/app.jar
EXPOSE 8081 9090
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
