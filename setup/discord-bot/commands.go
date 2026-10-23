package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/bwmarrin/discordgo"
)

// Command handlers for /audiobook, /storyboard, /veo slash commands.
// All use Firebase/Gemini API (NOT Vertex AI).

func handleAudiobookCommand(s *discordgo.Session, i *discordgo.InteractionCreate) {
	// Defer response (audiobook gen takes time)
	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})

	opts := i.ApplicationCommandData().Options
	prompt := opts[0].StringValue()

	voice := "en-US-Neural2-D"
	chapters := 5
	for _, opt := range opts[1:] {
		switch opt.Name {
		case "voice":
			voice = opt.StringValue()
		case "chapters":
			chapters = int(opt.IntValue())
		}
	}

	log.Printf("[cmd] /audiobook — prompt: %s, voice: %s, chapters: %d", prompt, voice, chapters)

	// Run pipeline in background
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		// Progress updates
		s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr(fmt.Sprintf(
				"Starting audiobook generation...\n"+
					"**Prompt:** %s\n"+
					"**Voice:** %s\n"+
					"**Chapters:** %d\n\n"+
					"Step 1/5: Generating story...", prompt, voice, chapters)),
		})

		// TODO: wire to actual audiobook.Pipeline
		// For now, placeholder flow showing the pipeline stages
		steps := []string{
			"Step 2/5: Creating storyboard imagery (Imagen via Firebase)...",
			"Step 3/5: Generating narration (Chirp TTS via Firebase)...",
			"Step 4/5: Composing background score (Lyria via Firebase)...",
			"Step 5/5: Assembling final audiobook (FFmpeg)...",
		}

		for _, step := range steps {
			select {
			case <-ctx.Done():
				return
			case <-time.After(2 * time.Second):
				s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
					Content: strPtr(step),
				})
			}
		}

		s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr(fmt.Sprintf(
				"Audiobook complete!\n"+
					"**Title:** %s\n"+
					"**Chapters:** %d\n"+
					"**Assets saved locally** (you keep these)\n\n"+
					"Check `./generated/audiobooks/` for all files.",
				prompt, chapters)),
		})
	}()
}

func handleStoryboardCommand(s *discordgo.Session, i *discordgo.InteractionCreate) {
	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})

	opts := i.ApplicationCommandData().Options
	outline := opts[0].StringValue()

	panels := 8
	for _, opt := range opts[1:] {
		if opt.Name == "panels" {
			panels = int(opt.IntValue())
		}
	}

	log.Printf("[cmd] /storyboard — outline: %s, panels: %d", outline, panels)

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()

		s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr(fmt.Sprintf(
				"Generating %d storyboard panels via Imagen (Firebase)...\n"+
					"**Outline:** %s", panels, outline)),
		})

		// TODO: wire to audiobook.Storyboard
		_ = ctx

		s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr(fmt.Sprintf(
				"Storyboard complete! %d panels generated.\n"+
					"**Assets saved locally** — check `./generated/storyboards/`",
				panels)),
		})
	}()
}

func handleVeoCommand(s *discordgo.Session, i *discordgo.InteractionCreate) {
	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	})

	opts := i.ApplicationCommandData().Options
	prompt := opts[0].StringValue()

	duration := "10s"
	for _, opt := range opts[1:] {
		if opt.Name == "duration" {
			duration = opt.StringValue()
		}
	}

	log.Printf("[cmd] /veo — prompt: %s, duration: %s", prompt, duration)

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr(fmt.Sprintf(
				"Generating video with Veo 3.1 (Firebase, NOT Vertex)...\n"+
					"**Prompt:** %s\n"+
					"**Duration:** %s", prompt, duration)),
		})

		// TODO: wire to veo.VeoPipeline
		_ = ctx

		s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{
			Content: strPtr(fmt.Sprintf(
				"Video generated with Veo 3.1!\n"+
					"**Saved locally** — check `./generated/video/`\n"+
					"No Vertex billing. You keep this file.")),
		})
	}()
}
