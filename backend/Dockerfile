FROM golang:alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download || true

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/api ./cmd/api

FROM alpine:3.19 AS runner
WORKDIR /app
COPY --from=builder /app/api /app/api
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080
CMD ["/app/api"]
