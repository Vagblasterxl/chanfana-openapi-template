package audiobook

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Assembler combines narration + score + panels into final audiobook output.
// Uses FFmpeg for audio/video assembly.
type Assembler struct {
	config PipelineConfig
}

func NewAssembler(cfg PipelineConfig) *Assembler {
	return &Assembler{config: cfg}
}

// AssemblyInput holds all generated assets for final assembly.
type AssemblyInput struct {
	Story     *StoryResult
	Narration *NarrationResult
	Score     *ScoreResult
	Boards    *StoryboardResult
	OutputDir string
}

// Assemble creates the final audiobook from all pipeline assets.
func (a *Assembler) Assemble(ctx context.Context, input AssemblyInput) (*AudiobookResult, error) {
	outputDir := filepath.Join(input.OutputDir, "final")
	os.MkdirAll(outputDir, 0755)

	result := &AudiobookResult{
		Title:    input.Story.Title,
		Chapters: len(input.Story.Chapters),
		Assets:   []string{},
	}

	// ── Audio: Mix narration + score ────────────────────────
	audioOut := filepath.Join(outputDir, sanitize(input.Story.Title)+"_audiobook.mp3")

	if len(input.Narration.ChapterAudio) > 0 {
		// Concat all chapter narrations
		narrationConcat := filepath.Join(outputDir, "narration_concat.mp3")
		err := concatAudioFiles(input.Narration.ChapterAudio, narrationConcat)
		if err != nil {
			log.Printf("Narration concat failed: %v", err)
		}
		result.Assets = append(result.Assets, narrationConcat)

		// Mix with background score if available
		if input.Score != nil && input.Score.AudioPath != "" {
			err = mixAudioTracks(narrationConcat, input.Score.AudioPath, audioOut)
			if err != nil {
				log.Printf("Audio mix failed, using narration only: %v", err)
				copyFile(narrationConcat, audioOut)
			}
		} else {
			copyFile(narrationConcat, audioOut)
		}
		result.Assets = append(result.Assets, audioOut)
	}

	// ── Video: Slideshow from panels + audio (optional) ─────
	if input.Boards != nil && len(input.Boards.Panels) > 0 {
		videoOut := filepath.Join(outputDir, sanitize(input.Story.Title)+"_storyboard.mp4")
		err := createSlideshow(input.Boards.Panels, audioOut, videoOut)
		if err != nil {
			log.Printf("Slideshow creation failed: %v", err)
		} else {
			result.Assets = append(result.Assets, videoOut)
		}
	}

	// ── Metadata ────────────────────────────────────────────
	result.OutputPath = audioOut

	// Save full story text
	storyPath := filepath.Join(outputDir, "story.md")
	os.WriteFile(storyPath, []byte(input.Story.FullText), 0644)
	result.Assets = append(result.Assets, storyPath)

	return result, nil
}

// concatAudioFiles joins chapter audio files using FFmpeg.
func concatAudioFiles(chapters []ChapterAudio, outputPath string) error {
	// Create FFmpeg concat list
	listPath := outputPath + ".list"
	var lines []string
	for _, ch := range chapters {
		lines = append(lines, fmt.Sprintf("file '%s'", ch.AudioPath))
	}
	os.WriteFile(listPath, []byte(strings.Join(lines, "\n")), 0644)
	defer os.Remove(listPath)

	cmd := exec.Command("ffmpeg", "-y",
		"-f", "concat", "-safe", "0",
		"-i", listPath,
		"-c", "copy",
		outputPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg concat: %w\n%s", err, out)
	}
	return nil
}

// mixAudioTracks mixes narration (foreground) with score (background) using FFmpeg.
func mixAudioTracks(narrationPath, scorePath, outputPath string) error {
	// Score at -18dB under narration
	cmd := exec.Command("ffmpeg", "-y",
		"-i", narrationPath,
		"-i", scorePath,
		"-filter_complex",
		"[1:a]volume=0.15[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=3",
		"-c:a", "libmp3lame", "-q:a", "2",
		outputPath)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg mix: %w\n%s", err, out)
	}
	return nil
}

// createSlideshow makes a video from storyboard panels + audio.
func createSlideshow(panels []Panel, audioPath, outputPath string) error {
	if len(panels) == 0 {
		return fmt.Errorf("no panels to create slideshow")
	}

	// Create input list for FFmpeg
	listPath := outputPath + ".list"
	var lines []string
	for _, p := range panels {
		if p.ImagePath != "" {
			// Show each panel for 15 seconds
			lines = append(lines, fmt.Sprintf("file '%s'\nduration 15", p.ImagePath))
		}
	}
	// Repeat last image (FFmpeg concat demuxer quirk)
	if len(panels) > 0 && panels[len(panels)-1].ImagePath != "" {
		lines = append(lines, fmt.Sprintf("file '%s'", panels[len(panels)-1].ImagePath))
	}
	os.WriteFile(listPath, []byte(strings.Join(lines, "\n")), 0644)
	defer os.Remove(listPath)

	args := []string{"-y",
		"-f", "concat", "-safe", "0", "-i", listPath,
		"-vsync", "vfr", "-pix_fmt", "yuv420p",
	}

	if audioPath != "" {
		args = append(args, "-i", audioPath, "-c:a", "aac", "-shortest")
	}

	args = append(args, "-c:v", "libx264", "-crf", "23", outputPath)

	cmd := exec.Command("ffmpeg", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg slideshow: %w\n%s", err, out)
	}
	return nil
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}
