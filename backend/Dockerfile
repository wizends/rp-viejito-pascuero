# Backend en Go: binario estático (sin cgo) sobre una imagen mínima.
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/buzon ./cmd/buzon \
 && mkdir -p /out/data

# distroless/static: sin shell, con certificados raíz (para la IA de visión) y usuario sin privilegios
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/buzon /app/buzon
COPY --from=build --chown=nonroot:nonroot /out/data /app/data
ENV DATA_DIR=/app/data PORT=8000
EXPOSE 8000
VOLUME ["/app/data"]
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD ["/app/buzon", "-healthcheck"]
ENTRYPOINT ["/app/buzon"]
