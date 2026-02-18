// Full audiobook creation pipeline
// Story → Storyboard → Narration → Score → Assembly → Output
// Uses Firebase/Gemini API (NOT Vertex AI)
// All assets save locally — you keep them when trial ends
package audiobook

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

// Pipeline orchestrates the full audiobook creation flow.
type Pipeline struct {
	Config    PipelineConfig
	Story     *StoryBuilder
	Board     *Storyboard
	Narrator  *Narrator
	Scorer    *Scorer
	Assembler *Assembler
	Assets    *AssetManager
}

// PipelineConfig holds all settings for a pipeline run.
type PipelineConfig struct {
	// Story
	Prompt     string
	Title      string
	Chapters   int
	Genre      string

	// Voice
	NarratorVoice string
	Language      string

	// Music
	MusicStyle   string
	MusicTempo   string

	// Images
	ArtStyle      string
	PanelCount    int

	// Video (Veo 3.1)
	GenerateVideo bool
	VideoDuration string

	// Firebase / Gemini (NOT Vertex)
	GeminiAPIKey string
	GeminiModel  string
	ImagenModel  string
	ChirpModel   string
	LyriaModel   string
	VeoModel     string

	// Output
	OutputDir string
}

// DefaultConfig returns sensible defaults for a pipeline run.
func DefaultConfig() PipelineConfig {
	return PipelineConfig{
		Chapters:      5,
		Genre:         "fiction",
		NarratorVoice: "en-US-Neural2-D",
		Language:      "en",
		MusicStyle:    "ambient orchestral",
		MusicTempo:    "moderate",
		ArtStyle:      "cinematic illustration",
		PanelCount:    8,
		GenerateVideo: false,
		VideoDuration: "10s",
		GeminiModel:   envOr("GEMINI_MODEL", "gemini-2.5-flash"),
		ImagenModel:   envOr("IMAGEN_MODEL", "imagen-3.0-generate-001"),
		ChirpModel:    envOr("CHIRP_MODEL", "chirp-3-hd"),
		LyriaModel:    envOr("LYRIA_MODEL", "lyria-2"),
		VeoModel:      envOr("VEO_MODEL", "veo-3.1"),
		GeminiAPIKey:  os.Getenv("GEMINI_API_KEY"),
		OutputDir:     envOr("LOCAL_ASSET_DIR", "./generated"),
	}
}

// NewPipeline creates a fully wired audiobook pipeline.
func NewPipeline(cfg PipelineConfig) *Pipeline {
	return &Pipeline{
		Config:    cfg,
		Story:     NewStoryBuilder(cfg),
		Board:     NewStoryboard(cfg),
		Narrator:  NewNarrator(cfg),
		Scorer:    NewScorer(cfg),
		Assembler: NewAssembler(cfg),
		Assets:    NewAssetManager(cfg.OutputDir),
	}
}

// Run executes the full pipeline: story → storyboard → narration → score → assembly.
func (p *Pipeline) Run(ctx context.Context) (*AudiobookResult, error) {
	start := time.Now()
	projectDir := p.Assets.CreateProject(p.Config.Title)

	log.Printf("[pipeline] Starting audiobook: %s (%d chapters)", p.Config.Title, p.Config.Chapters)

	// ── Step 1: Generate story ──────────────────────────────
	log.Println("[pipeline] Step 1/5: Generating story...")
	story, err := p.Story.Generate(ctx, p.Config.Prompt)
	if err != nil {
		return nil, fmt.Errorf("story generation failed: %w", err)
	}
	p.Assets.SaveText(projectDir, "story.md", story.FullText)
	p.Assets.SaveJSON(projectDir, "story_meta.json", story)
	log.Printf("[pipeline] Story: %d chapters, %d words", len(story.Chapters), story.WordCount)

	// ── Step 2: Generate storyboard imagery ─────────────────
	log.Println("[pipeline] Step 2/5: Generating storyboard...")
	boards, err := p.Board.Generate(ctx, story)
	if err != nil {
		log.Printf("[pipeline] Storyboard generation failed (continuing): %v", err)
		boards = &StoryboardResult{Panels: nil}
	}
	for i, panel := range boards.Panels {
		if panel.ImagePath != "" {
			p.Assets.CopyFile(panel.ImagePath, filepath.Join(projectDir, "panels", fmt.Sprintf("panel_%02d.png", i+1)))
		}
	}
	log.Printf("[pipeline] Storyboard: %d panels", len(boards.Panels))

	// ── Step 3: Generate narration (TTS) ────────────────────
	log.Println("[pipeline] Step 3/5: Generating narration...")
	narration, err := p.Narrator.Narrate(ctx, story)
	if err != nil {
		return nil, fmt.Errorf("narration failed: %w", err)
	}
	for i, ch := range narration.ChapterAudio {
		p.Assets.CopyFile(ch.AudioPath, filepath.Join(projectDir, "narration", fmt.Sprintf("chapter_%02d.mp3", i+1)))
	}
	log.Printf("[pipeline] Narration: %d chapters, total %s", len(narration.ChapterAudio), narration.TotalDuration)

	// ── Step 4: Generate background score ───────────────────
	log.Println("[pipeline] Step 4/5: Generating score...")
	score, err := p.Scorer.Generate(ctx, story)
	if err != nil {
		log.Printf("[pipeline] Score generation failed (continuing): %v", err)
		score = &ScoreResult{}
	}
	if score.AudioPath != "" {
		p.Assets.CopyFile(score.AudioPath, filepath.Join(projectDir, "score", "background.mp3"))
	}
	log.Printf("[pipeline] Score: %s", score.Duration)

	// ── Step 5: Assemble final audiobook ────────────────────
	log.Println("[pipeline] Step 5/5: Assembling audiobook...")
	result, err := p.Assembler.Assemble(ctx, AssemblyInput{
		Story:     story,
		Narration: narration,
		Score:     score,
		Boards:    boards,
		OutputDir: projectDir,
	})
	if err != nil {
		return nil, fmt.Errorf("assembly failed: %w", err)
	}

	result.Duration = time.Since(start)
	log.Printf("[pipeline] Audiobook complete: %s (took %s)", result.OutputPath, result.Duration)

	return result, nil
}

// AudiobookResult is the final output of the pipeline.
type AudiobookResult struct {
	Title      string        `json:"title"`
	OutputPath string        `json:"output_path"`
	Chapters   int           `json:"chapters"`
	Duration   time.Duration `json:"duration"`
	Assets     []string      `json:"assets"`
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
