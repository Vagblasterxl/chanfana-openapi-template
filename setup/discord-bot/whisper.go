package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/bwmarrin/discordgo"
)

// Whisper integration — local speech-to-text via whisper.cpp or openai-whisper
// Runs on CPU or CUDA (GTX 1080+). No cloud API calls.

// handleWhisperCommand processes messages in the whisper channel.
func handleWhisperCommand(s *discordgo.Session, m *discordgo.MessageCreate) {
	// Check for audio attachments
	if len(m.Attachments) == 0 {
		s.ChannelMessageSend(m.ChannelID,
			"Drop an audio file here and I'll transcribe it with Whisper (local, no cloud).")
		return
	}

	for _, att := range m.Attachments {
		if !isAudioFile(att.Filename) {
			continue
		}

		s.ChannelMessageSend(m.ChannelID,
			fmt.Sprintf("Transcribing **%s** with Whisper (%s model)...",
				att.Filename, envOr("WHISPER_MODEL_SIZE", "base")))

		text, err := transcribeAudio(att.URL, att.Filename)
		if err != nil {
			s.ChannelMessageSend(m.ChannelID,
				fmt.Sprintf("Transcription failed: %v", err))
			continue
		}

		// Split long transcriptions into 2000-char chunks (Discord limit)
		chunks := splitMessage(text, 1900)
		for i, chunk := range chunks {
			header := ""
			if len(chunks) > 1 {
				header = fmt.Sprintf("**[%d/%d]** ", i+1, len(chunks))
			}
			s.ChannelMessageSend(m.ChannelID, header+chunk)
		}
	}
}

// handleWhisperSlash handles the /whisper slash command.
func handleWhisperSlash(s *discordgo.Session, i *discordgo.InteractionCreate) {
	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})

	opts := i.ApplicationCommandData().Options
	attachmentID := opts[0].Value.(string)
	att := i.ApplicationCommandData().Resolved.Attachments[attachmentID]

	text, err := transcribeAudio(att.URL, att.Filename)
	if err != nil {
		s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr(fmt.Sprintf("Transcription failed: %v", err)),
		})
		return
	}

	// Truncate for interaction response
	if len(text) > 1900 {
		text = text[:1900] + "\n...(truncated)"
	}

	s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
		Content: &text,
	})
}

// transcribeAudio downloads audio from URL and runs Whisper locally.
func transcribeAudio(url, filename string) (string, error) {
	// Download to temp file
	tmpDir := os.TempDir()
	tmpFile := filepath.Join(tmpDir, "whisper_"+filename)

	resp, err := http.Get(url)
	if err != nil {
		return "", fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	out, err := os.Create(tmpFile)
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}

	if _, err := io.Copy(out, resp.Body); err != nil {
		out.Close()
		return "", fmt.Errorf("write temp file: %w", err)
	}
	out.Close()
	defer os.Remove(tmpFile)

	// Try whisper.cpp first, fall back to openai-whisper Python
	text, err := runWhisperCpp(tmpFile)
	if err != nil {
		log.Printf("whisper.cpp failed, trying Python whisper: %v", err)
		text, err = runWhisperPython(tmpFile)
		if err != nil {
			return "", err
		}
	}

	// Save transcript locally (you keep these)
	saveTranscript(filename, text)

	return text, nil
}

func runWhisperCpp(audioPath string) (string, error) {
	model := envOr("WHISPER_MODEL_SIZE", "base")
	modelPath := fmt.Sprintf("models/ggml-%s.bin", model)

	cmd := exec.Command("whisper-cpp",
		"--model", modelPath,
		"--language", envOr("WHISPER_LANGUAGE", "en"),
		"--output-txt",
		audioPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("whisper.cpp: %w\n%s", err, out)
	}

	// Read the .txt output
	txtPath := audioPath + ".txt"
	data, err := os.ReadFile(txtPath)
	if err != nil {
		return string(out), nil // fall back to stdout
	}
	os.Remove(txtPath)
	return string(data), nil
}

func runWhisperPython(audioPath string) (string, error) {
	model := envOr("WHISPER_MODEL_SIZE", "base")
	device := envOr("WHISPER_DEVICE", "cpu")

	cmd := exec.Command("whisper",
		audioPath,
		"--model", model,
		"--device", device,
		"--language", envOr("WHISPER_LANGUAGE", "en"),
		"--output_format", "txt",
		"--output_dir", os.TempDir(),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("whisper python: %w\n%s", err, out)
	}

	// Read output txt
	base := strings.TrimSuffix(filepath.Base(audioPath), filepath.Ext(audioPath))
	txtPath := filepath.Join(os.TempDir(), base+".txt")
	data, err := os.ReadFile(txtPath)
	if err != nil {
		return string(out), nil
	}
	os.Remove(txtPath)
	return string(data), nil
}

func saveTranscript(originalName, text string) {
	dir := envOr("LOCAL_ASSET_DIR", "./generated")
	transcriptDir := filepath.Join(dir, "transcripts")
	os.MkdirAll(transcriptDir, 0755)

	base := strings.TrimSuffix(originalName, filepath.Ext(originalName))
	path := filepath.Join(transcriptDir, base+".txt")
	os.WriteFile(path, []byte(text), 0644)
	log.Printf("Transcript saved: %s", path)
}

func handleVoiceState(s *discordgo.Session, v *discordgo.VoiceStateUpdate) {
	// Auto-record when user joins whisper voice channel
	// TODO: implement voice recording with discordgo voice
	whisperCh := os.Getenv("DISCORD_WHISPER_CHANNEL_ID")
	if v.ChannelID == whisperCh && v.UserID != s.State.User.ID {
		log.Printf("User %s joined whisper voice channel", v.UserID)
	}
}

func isAudioFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".mp3", ".wav", ".ogg", ".flac", ".m4a", ".webm", ".opus", ".aac":
		return true
	}
	return false
}

func splitMessage(text string, maxLen int) []string {
	if len(text) <= maxLen {
		return []string{text}
	}
	var chunks []string
	for len(text) > 0 {
		end := maxLen
		if end > len(text) {
			end = len(text)
		}
		chunks = append(chunks, text[:end])
		text = text[end:]
	}
	return chunks
}

func strPtr(s string) *string { return &s }
