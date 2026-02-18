// Veo 3.1 video generation pipeline
// Uses Firebase AI Logic (generativelanguage.googleapis.com) — NOT Vertex AI
// Videos save locally so you keep them when trial ends
package veo

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

const geminiBaseURL = "https://generativelanguage.googleapis.com/v1beta"

// VeoPipeline handles video generation via Veo 3.1 on Firebase/Gemini API.
type VeoPipeline struct {
	APIKey    string
	Model     string
	OutputDir string
}

// NewVeoPipeline creates a Veo pipeline from env vars.
func NewVeoPipeline() *VeoPipeline {
	return &VeoPipeline{
		APIKey:    os.Getenv("GEMINI_API_KEY"),
		Model:     envOr("VEO_MODEL", "veo-3.1"),
		OutputDir: envOr("OUTPUT_DIR_VIDEO", "./generated/video"),
	}
}

// GenerateRequest holds parameters for a single video generation.
type GenerateRequest struct {
	Prompt      string `json:"prompt"`
	Duration    string `json:"duration"`     // "5s", "10s", "15s"
	AspectRatio string `json:"aspect_ratio"` // "16:9", "9:16", "1:1"
	Title       string `json:"title"`
}

// GenerateResult holds the output of a video generation.
type GenerateResult struct {
	VideoPath string        `json:"video_path"`
	Duration  time.Duration `json:"duration"`
	Prompt    string        `json:"prompt"`
}

// Generate creates a single video from a prompt.
func (vp *VeoPipeline) Generate(ctx context.Context, req GenerateRequest) (*GenerateResult, error) {
	if vp.APIKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not set — see firebase.env.example")
	}

	if req.Duration == "" {
		req.Duration = "10s"
	}
	if req.AspectRatio == "" {
		req.AspectRatio = "16:9"
	}

	url := fmt.Sprintf("%s/models/%s:predict?key=%s", geminiBaseURL, vp.Model, vp.APIKey)

	body := map[string]interface{}{
		"instances": []map[string]interface{}{
			{"prompt": req.Prompt},
		},
		"parameters": map[string]interface{}{
			"videoDuration":     req.Duration,
			"aspectRatio":       req.AspectRatio,
			"sampleCount":      1,
			"safetyFilterLevel": "block_few",
		},
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	log.Printf("[veo] Generating video: %s (%s)", req.Title, req.Duration)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("API call: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("Veo API error %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var result struct {
		Predictions []struct {
			BytesBase64Encoded string `json:"bytesBase64Encoded"`
		} `json:"predictions"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	if len(result.Predictions) == 0 {
		return nil, fmt.Errorf("no video generated")
	}

	// Decode and save locally (you keep this file)
	videoData, err := base64.StdEncoding.DecodeString(result.Predictions[0].BytesBase64Encoded)
	if err != nil {
		return nil, fmt.Errorf("decode video: %w", err)
	}

	os.MkdirAll(vp.OutputDir, 0755)
	title := req.Title
	if title == "" {
		title = fmt.Sprintf("veo_%d", time.Now().Unix())
	}
	outputPath := filepath.Join(vp.OutputDir, sanitize(title)+".mp4")

	if err := os.WriteFile(outputPath, videoData, 0644); err != nil {
		return nil, fmt.Errorf("write video: %w", err)
	}

	log.Printf("[veo] Video saved: %s", outputPath)

	return &GenerateResult{
		VideoPath: outputPath,
		Prompt:    req.Prompt,
	}, nil
}

// GenerateStoryboardSequence creates videos for each storyboard panel.
func (vp *VeoPipeline) GenerateStoryboardSequence(ctx context.Context, panels []PanelInput) ([]*GenerateResult, error) {
	var results []*GenerateResult

	for i, panel := range panels {
		req := GenerateRequest{
			Prompt:   panel.Prompt,
			Duration: panel.Duration,
			Title:    fmt.Sprintf("panel_%03d", i+1),
		}

		result, err := vp.Generate(ctx, req)
		if err != nil {
			log.Printf("[veo] Panel %d failed: %v", i+1, err)
			continue
		}
		results = append(results, result)
	}

	return results, nil
}

// GenerateTrailer creates a book trailer from a synopsis.
func (vp *VeoPipeline) GenerateTrailer(ctx context.Context, synopsis, title string) (*GenerateResult, error) {
	prompt := fmt.Sprintf(
		"Cinematic book trailer. %s. Dramatic lighting, sweeping camera moves, title card: '%s'. Epic orchestral mood.",
		synopsis, title)

	return vp.Generate(ctx, GenerateRequest{
		Prompt:   prompt,
		Duration: "15s",
		Title:    sanitize(title) + "_trailer",
	})
}

// PanelInput is a storyboard panel for video generation.
type PanelInput struct {
	Prompt   string `json:"prompt"`
	Duration string `json:"duration"`
}

func sanitize(s string) string {
	safe := make([]byte, 0, len(s))
	for _, b := range []byte(s) {
		if (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') || b == '-' || b == '_' {
			safe = append(safe, b)
		} else if b == ' ' {
			safe = append(safe, '_')
		}
	}
	if len(safe) == 0 {
		return "untitled"
	}
	return string(safe)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
