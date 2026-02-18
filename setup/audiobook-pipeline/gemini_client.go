package audiobook

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// Gemini API client — uses Firebase AI Logic (generativelanguage.googleapis.com)
// NOT Vertex AI (aiplatform.googleapis.com)
// All calls use GEMINI_API_KEY, no PROJECT_ID needed.

const geminiBaseURL = "https://generativelanguage.googleapis.com/v1beta"

// callGeminiAPI sends a text generation request to Gemini via Firebase.
func callGeminiAPI(ctx context.Context, apiKey, model, systemPrompt, userPrompt string) (string, error) {
	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", geminiBaseURL, model, apiKey)

	body := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{"text": userPrompt},
				},
			},
		},
		"systemInstruction": map[string]interface{}{
			"parts": []map[string]interface{}{
				{"text": systemPrompt},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":     0.8,
			"topP":            0.95,
			"maxOutputTokens": 8192,
		},
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("API call: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}

	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini")
	}

	return result.Candidates[0].Content.Parts[0].Text, nil
}

// generateImage calls Imagen via Gemini API (Firebase, NOT Vertex).
func generateImage(ctx context.Context, apiKey, model, prompt, outputPath string) error {
	url := fmt.Sprintf("%s/models/%s:predict?key=%s", geminiBaseURL, model, apiKey)

	body := map[string]interface{}{
		"instances": []map[string]interface{}{
			{"prompt": prompt},
		},
		"parameters": map[string]interface{}{
			"sampleCount":  1,
			"aspectRatio":  "16:9",
			"safetyFilterLevel": "block_few",
		},
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("API call: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != 200 {
		return fmt.Errorf("Imagen API error %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse response — Imagen returns base64-encoded image
	var result struct {
		Predictions []struct {
			BytesBase64Encoded string `json:"bytesBase64Encoded"`
		} `json:"predictions"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return fmt.Errorf("parse response: %w", err)
	}

	if len(result.Predictions) == 0 {
		return fmt.Errorf("no image generated")
	}

	// Decode and save locally (you keep this file)
	imgData, err := base64.StdEncoding.DecodeString(result.Predictions[0].BytesBase64Encoded)
	if err != nil {
		return fmt.Errorf("decode image: %w", err)
	}

	os.MkdirAll(filepath.Dir(outputPath), 0755)
	return os.WriteFile(outputPath, imgData, 0644)
}

// parseNumberedList extracts items from a "1. ...\n2. ..." formatted list.
func parseNumberedList(text string) []string {
	var items []string
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if len(line) > 3 && line[0] >= '1' && line[0] <= '9' && line[1] == '.' {
			items = append(items, strings.TrimSpace(line[2:]))
		}
	}
	return items
}

// filepath is imported via the os/path/filepath path above
// but we need an explicit reference for the compiler
func init() {
	_ = filepath.Join
}
