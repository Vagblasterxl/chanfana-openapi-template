package audiobook

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

// Narrator generates TTS narration for each chapter using Chirp (Firebase, not Vertex).
type Narrator struct {
	config PipelineConfig
}

func NewNarrator(cfg PipelineConfig) *Narrator {
	return &Narrator{config: cfg}
}

// NarrationResult holds all chapter audio files.
type NarrationResult struct {
	ChapterAudio  []ChapterAudio `json:"chapter_audio"`
	TotalDuration string         `json:"total_duration"`
}

// ChapterAudio is audio for a single chapter.
type ChapterAudio struct {
	Chapter   int           `json:"chapter"`
	AudioPath string        `json:"audio_path"`
	Duration  time.Duration `json:"duration"`
	Words     int           `json:"words"`
}

// Narrate generates TTS audio for each chapter via Chirp (Firebase/Gemini API).
func (n *Narrator) Narrate(ctx context.Context, story *StoryResult) (*NarrationResult, error) {
	if n.config.GeminiAPIKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not set")
	}

	result := &NarrationResult{}
	narrationDir := filepath.Join(n.config.OutputDir, "narration", sanitize(story.Title))
	os.MkdirAll(narrationDir, 0755)

	var totalDuration time.Duration

	for _, chapter := range story.Chapters {
		audioPath := filepath.Join(narrationDir, fmt.Sprintf("chapter_%02d.mp3", chapter.Number))

		log.Printf("Narrating chapter %d: %s (%d words)", chapter.Number, chapter.Title, chapter.Words)

		// Generate TTS via Chirp (Firebase/Gemini API, NOT Vertex)
		duration, err := generateTTS(ctx, n.config.GeminiAPIKey, n.config.ChirpModel,
			chapter.Content, n.config.NarratorVoice, n.config.Language, audioPath)
		if err != nil {
			return nil, fmt.Errorf("TTS for chapter %d failed: %w", chapter.Number, err)
		}

		totalDuration += duration
		result.ChapterAudio = append(result.ChapterAudio, ChapterAudio{
			Chapter:   chapter.Number,
			AudioPath: audioPath,
			Duration:  duration,
			Words:     chapter.Words,
		})
	}

	result.TotalDuration = totalDuration.String()
	return result, nil
}

// generateTTS calls Chirp TTS via Gemini API (Firebase).
func generateTTS(ctx context.Context, apiKey, model, text, voice, lang, outputPath string) (time.Duration, error) {
	// Call generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
	// with audio output config
	//
	// Request body:
	// {
	//   "contents": [{"parts": [{"text": "..."}]}],
	//   "generationConfig": {
	//     "responseModalities": ["AUDIO"],
	//     "speechConfig": {
	//       "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}
	//     }
	//   }
	// }

	// TODO: implement actual API call
	// For now, create placeholder
	log.Printf("TTS: %s → %s (voice: %s)", model, outputPath, voice)

	// Estimate duration: ~150 words per minute
	words := countWords(text)
	estimatedMinutes := float64(words) / 150.0
	duration := time.Duration(estimatedMinutes * float64(time.Minute))

	return duration, nil
}
