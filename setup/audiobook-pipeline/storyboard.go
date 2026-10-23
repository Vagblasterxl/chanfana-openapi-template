package audiobook

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
)

// Storyboard generates visual panels for each story beat using Imagen (Firebase, not Vertex).
type Storyboard struct {
	config PipelineConfig
}

func NewStoryboard(cfg PipelineConfig) *Storyboard {
	return &Storyboard{config: cfg}
}

// StoryboardResult holds all generated panels.
type StoryboardResult struct {
	Panels []Panel `json:"panels"`
}

// Panel is a single storyboard frame.
type Panel struct {
	Number      int    `json:"number"`
	ChapterRef  int    `json:"chapter_ref"`
	Description string `json:"description"`
	Prompt      string `json:"prompt"`
	ImagePath   string `json:"image_path"`
}

// Generate creates storyboard panels from the story using Imagen via Gemini API.
func (sb *Storyboard) Generate(ctx context.Context, story *StoryResult) (*StoryboardResult, error) {
	if sb.config.GeminiAPIKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not set")
	}

	result := &StoryboardResult{}
	panelsPerChapter := sb.config.PanelCount / len(story.Chapters)
	if panelsPerChapter < 1 {
		panelsPerChapter = 1
	}

	panelDir := filepath.Join(sb.config.OutputDir, "storyboards", sanitize(story.Title))
	os.MkdirAll(panelDir, 0755)

	panelNum := 0
	for _, chapter := range story.Chapters {
		// Ask Gemini to extract key visual moments from the chapter
		extractPrompt := fmt.Sprintf(
			`From this chapter, extract exactly %d key visual moments for storyboard illustration.
For each moment, write a detailed image generation prompt in the style: "%s".
Include character descriptions, setting, lighting, mood, and action.

Chapter:
%s

Format as numbered list:
1. [detailed image prompt]
2. [detailed image prompt]`, panelsPerChapter, sb.config.ArtStyle, chapter.Content)

		prompts, err := callGeminiAPI(ctx, sb.config.GeminiAPIKey, sb.config.GeminiModel,
			"You are a visual director creating storyboard prompts for an image generation AI.",
			extractPrompt)
		if err != nil {
			log.Printf("Failed to extract panels for chapter %d: %v", chapter.Number, err)
			continue
		}

		// Parse prompts and generate images
		panelPrompts := parseNumberedList(prompts)
		for _, prompt := range panelPrompts {
			panelNum++
			imgPath := filepath.Join(panelDir, fmt.Sprintf("panel_%03d.png", panelNum))

			// Generate image via Imagen (Firebase/Gemini API)
			err := generateImage(ctx, sb.config.GeminiAPIKey, sb.config.ImagenModel, prompt, imgPath)
			if err != nil {
				log.Printf("Panel %d image gen failed: %v", panelNum, err)
			}

			result.Panels = append(result.Panels, Panel{
				Number:      panelNum,
				ChapterRef:  chapter.Number,
				Description: prompt,
				Prompt:      prompt,
				ImagePath:   imgPath,
			})
		}
	}

	log.Printf("Generated %d storyboard panels", len(result.Panels))
	return result, nil
}
