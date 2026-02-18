package audiobook

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

// Scorer generates background music/score using Lyria (Firebase, not Vertex).
type Scorer struct {
	config PipelineConfig
}

func NewScorer(cfg PipelineConfig) *Scorer {
	return &Scorer{config: cfg}
}

// ScoreResult holds the generated background score.
type ScoreResult struct {
	AudioPath string        `json:"audio_path"`
	Duration  string        `json:"duration"`
	Style     string        `json:"style"`
	Segments  []ScoreSegment `json:"segments"`
}

// ScoreSegment is a portion of the score matched to a chapter.
type ScoreSegment struct {
	ChapterRef int    `json:"chapter_ref"`
	Mood       string `json:"mood"`
	AudioPath  string `json:"audio_path"`
}

// Generate creates background music matched to story mood via Lyria (Firebase/Gemini API).
func (sc *Scorer) Generate(ctx context.Context, story *StoryResult) (*ScoreResult, error) {
	if sc.config.GeminiAPIKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not set")
	}

	scoreDir := filepath.Join(sc.config.OutputDir, "scores", sanitize(story.Title))
	os.MkdirAll(scoreDir, 0755)

	result := &ScoreResult{
		Style: sc.config.MusicStyle,
	}

	// For each chapter, determine mood and generate a score segment
	for _, chapter := range story.Chapters {
		// Use Gemini to analyze chapter mood
		moodPrompt := fmt.Sprintf(
			`Analyze the mood of this chapter and suggest a music description for background scoring.
Style: %s, Tempo: %s.
Return ONLY a one-line music generation prompt.

Chapter: %s`, sc.config.MusicStyle, sc.config.MusicTempo, chapter.Summary)

		mood, err := callGeminiAPI(ctx, sc.config.GeminiAPIKey, sc.config.GeminiModel,
			"You are a music director.", moodPrompt)
		if err != nil {
			log.Printf("Mood analysis for chapter %d failed: %v", chapter.Number, err)
			mood = fmt.Sprintf("%s, %s", sc.config.MusicStyle, sc.config.MusicTempo)
		}

		segPath := filepath.Join(scoreDir, fmt.Sprintf("score_ch%02d.mp3", chapter.Number))

		// Generate music via Lyria (Firebase/Gemini API)
		err = generateMusic(ctx, sc.config.GeminiAPIKey, sc.config.LyriaModel, mood, segPath)
		if err != nil {
			log.Printf("Score generation for chapter %d failed: %v", chapter.Number, err)
			continue
		}

		result.Segments = append(result.Segments, ScoreSegment{
			ChapterRef: chapter.Number,
			Mood:       mood,
			AudioPath:  segPath,
		})
	}

	// Concat all segments into single score file
	if len(result.Segments) > 0 {
		result.AudioPath = filepath.Join(scoreDir, "full_score.mp3")
		// TODO: use FFmpeg to concat segments
		log.Printf("Score: %d segments generated", len(result.Segments))
	}

	return result, nil
}

// generateMusic calls Lyria via Gemini API (Firebase).
func generateMusic(ctx context.Context, apiKey, model, prompt, outputPath string) error {
	// POST to generativelanguage.googleapis.com/v1beta/models/lyria-2:generateContent
	// with musicGenerationConfig

	// TODO: implement actual Lyria API call
	log.Printf("Music: %s → %s", model, outputPath)

	_ = time.Second // placeholder
	return nil
}
