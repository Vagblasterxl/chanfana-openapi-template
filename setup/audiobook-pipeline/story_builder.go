package audiobook

import (
	"context"
	"fmt"
	"strings"
)

// StoryBuilder generates full story text from a prompt using Gemini API.
type StoryBuilder struct {
	config PipelineConfig
}

func NewStoryBuilder(cfg PipelineConfig) *StoryBuilder {
	return &StoryBuilder{config: cfg}
}

// StoryResult holds the generated story.
type StoryResult struct {
	Title     string    `json:"title"`
	Synopsis  string    `json:"synopsis"`
	Chapters  []Chapter `json:"chapters"`
	FullText  string    `json:"full_text"`
	WordCount int       `json:"word_count"`
}

// Chapter is a single chapter of the story.
type Chapter struct {
	Number  int    `json:"number"`
	Title   string `json:"title"`
	Content string `json:"content"`
	Summary string `json:"summary"`
	Words   int    `json:"words"`
}

// Generate creates a full story from a prompt using Gemini API (Firebase, not Vertex).
func (sb *StoryBuilder) Generate(ctx context.Context, prompt string) (*StoryResult, error) {
	if sb.config.GeminiAPIKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not set — see firebase.env.example")
	}

	// Build the story generation prompt
	systemPrompt := fmt.Sprintf(`You are a master storyteller. Write a complete %s story with exactly %d chapters.

Requirements:
- Each chapter should be 800-1200 words
- Include vivid sensory descriptions (for storyboard image generation)
- Include dialogue with clear speaker attribution (for TTS narration)
- Each chapter ends with a hook or transition
- Write in present tense, third person

Format your response as:
# [Story Title]

## Synopsis
[2-3 sentence synopsis]

## Chapter 1: [Chapter Title]
[Chapter content...]

## Chapter 2: [Chapter Title]
[Chapter content...]

(continue for all %d chapters)`, sb.config.Genre, sb.config.Chapters, sb.config.Chapters)

	// Call Gemini API via generativelanguage.googleapis.com
	// Using REST endpoint (Firebase AI Logic, NOT Vertex)
	response, err := callGeminiAPI(ctx, sb.config.GeminiAPIKey, sb.config.GeminiModel, systemPrompt, prompt)
	if err != nil {
		return nil, fmt.Errorf("gemini story generation: %w", err)
	}

	// Parse the response into chapters
	result := parseStory(response)
	if result.Title == "" {
		result.Title = sb.config.Title
	}
	return result, nil
}

// parseStory splits Gemini's markdown output into structured chapters.
func parseStory(text string) *StoryResult {
	result := &StoryResult{FullText: text}

	lines := strings.Split(text, "\n")
	var currentChapter *Chapter
	chapterNum := 0

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Title
		if strings.HasPrefix(trimmed, "# ") && result.Title == "" {
			result.Title = strings.TrimPrefix(trimmed, "# ")
			continue
		}

		// Synopsis
		if trimmed == "## Synopsis" {
			// Next lines until next ## are synopsis
			continue
		}

		// Chapter heading
		if strings.HasPrefix(trimmed, "## Chapter") {
			if currentChapter != nil {
				currentChapter.Words = countWords(currentChapter.Content)
				result.Chapters = append(result.Chapters, *currentChapter)
			}
			chapterNum++
			title := strings.TrimPrefix(trimmed, "## ")
			currentChapter = &Chapter{
				Number: chapterNum,
				Title:  title,
			}
			continue
		}

		// Content
		if currentChapter != nil {
			currentChapter.Content += line + "\n"
		} else if result.Title != "" && trimmed != "" {
			result.Synopsis += trimmed + " "
		}
	}

	// Don't forget last chapter
	if currentChapter != nil {
		currentChapter.Words = countWords(currentChapter.Content)
		result.Chapters = append(result.Chapters, *currentChapter)
	}

	result.WordCount = countWords(text)
	result.Synopsis = strings.TrimSpace(result.Synopsis)
	return result
}

func countWords(s string) int {
	return len(strings.Fields(s))
}
