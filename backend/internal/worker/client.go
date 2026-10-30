package worker

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Client handles communication with the meeting-worker microservice
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new meeting-worker HTTP client
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = "http://localhost:5001"
	}
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// CheckHealth verifies that the meeting-worker service is reachable
func (c *Client) CheckHealth(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("meeting-worker health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("meeting-worker health check returned status %d", resp.StatusCode)
	}

	return nil
}

// StartSession requests meeting-worker to launch a browser and join the meeting
func (c *Client) StartSession(ctx context.Context, reqPayload StartRequest) error {
	body, err := json.Marshal(reqPayload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/sessions/start", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call meeting-worker start: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("meeting-worker start returned status %d", resp.StatusCode)
	}

	return nil
}

// StopSession requests meeting-worker to leave and close the meeting
func (c *Client) StopSession(ctx context.Context, reqPayload StopRequest) error {
	body, err := json.Marshal(reqPayload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/sessions/stop", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call meeting-worker stop: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("meeting-worker stop returned status %d", resp.StatusCode)
	}

	return nil
}

// StreamEvents connects to the SSE event stream of meeting-worker for a given meeting
func (c *Client) StreamEvents(ctx context.Context, meetingID string, handler func(Event)) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/sessions/%s/events", c.baseURL, meetingID), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")

	// Use an un-timeouted client for streaming SSE
	streamClient := &http.Client{}
	resp, err := streamClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to open SSE stream: %w", err)
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			var event Event
			if err := json.Unmarshal([]byte(data), &event); err == nil && event.State != "" {
				handler(event)
			}
		}
	}

	return scanner.Err()
}

