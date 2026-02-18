// Discord bot — 8 AI agent slots + 1 human + Whisper channel
// Uses Firebase/Gemini API (NOT Vertex AI) for all AI ops
// Assets save locally so you keep them when trial ends
package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/bwmarrin/discordgo"
)

func main() {
	token := os.Getenv("DISCORD_BOT_TOKEN")
	if token == "" {
		log.Fatal("DISCORD_BOT_TOKEN not set — see setup/config-templates/discord-bot.env.example")
	}

	dg, err := discordgo.New("Bot " + token)
	if err != nil {
		log.Fatalf("error creating Discord session: %v", err)
	}

	// Register handlers
	dg.AddHandler(onReady)
	dg.AddHandler(onMessageCreate)
	dg.AddHandler(onVoiceStateUpdate)
	dg.AddHandler(onInteractionCreate)

	// Intents: guilds, messages, voice states, message content
	dg.Identify.Intents = discordgo.IntentsGuilds |
		discordgo.IntentsGuildMessages |
		discordgo.IntentsGuildVoiceStates |
		discordgo.IntentsMessageContent

	if err := dg.Open(); err != nil {
		log.Fatalf("error opening connection: %v", err)
	}
	defer dg.Close()

	// Register slash commands
	registerCommands(dg)

	// Init AI agent pool
	pool := NewAgentPool(loadConfig())
	pool.Start()
	defer pool.Stop()

	fmt.Println("Bot running — 8 AI slots + 1 human + Whisper")
	fmt.Println("Press Ctrl+C to exit")

	sc := make(chan os.Signal, 1)
	signal.Notify(sc, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sc
}

func onReady(s *discordgo.Session, r *discordgo.Ready) {
	log.Printf("Logged in as %s#%s", r.User.Username, r.User.Discriminator)
}

func onMessageCreate(s *discordgo.Session, m *discordgo.MessageCreate) {
	if m.Author.ID == s.State.User.ID {
		return
	}

	whisperCh := os.Getenv("DISCORD_WHISPER_CHANNEL_ID")

	// Whisper channel — voice transcription commands
	if m.ChannelID == whisperCh {
		handleWhisperCommand(s, m)
		return
	}

	// Route to AI agent pool
	routeToAgent(s, m)
}

func onVoiceStateUpdate(s *discordgo.Session, v *discordgo.VoiceStateUpdate) {
	// Auto-record when user joins whisper channel voice
	handleVoiceState(s, v)
}

func onInteractionCreate(s *discordgo.Session, i *discordgo.InteractionCreate) {
	handleSlashCommand(s, i)
}

func registerCommands(s *discordgo.Session) {
	guildID := os.Getenv("DISCORD_GUILD_ID")

	commands := []*discordgo.ApplicationCommand{
		{
			Name:        "audiobook",
			Description: "Create a full audiobook from a story prompt",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "prompt",
					Description: "Story premise or full text",
					Required:    true,
				},
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "voice",
					Description: "Narrator voice (default: en-US-Neural2-D)",
					Required:    false,
				},
				{
					Type:        discordgo.ApplicationCommandOptionInteger,
					Name:        "chapters",
					Description: "Number of chapters (default: 5)",
					Required:    false,
				},
			},
		},
		{
			Name:        "storyboard",
			Description: "Generate a visual storyboard from a story outline",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "outline",
					Description: "Story outline or beat sheet",
					Required:    true,
				},
				{
					Type:        discordgo.ApplicationCommandOptionInteger,
					Name:        "panels",
					Description: "Number of panels (default: 8)",
					Required:    false,
				},
			},
		},
		{
			Name:        "veo",
			Description: "Generate video with Veo 3.1 from a prompt",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "prompt",
					Description: "Video generation prompt",
					Required:    true,
				},
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "duration",
					Description: "Duration: 5s, 10s, 15s (default: 10s)",
					Required:    false,
				},
			},
		},
		{
			Name:        "agents",
			Description: "Show status of all 8 AI agent slots",
		},
		{
			Name:        "assign",
			Description: "Assign an AI agent to a specific role",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionInteger,
					Name:        "slot",
					Description: "Agent slot number (1-8)",
					Required:    true,
				},
				{
					Type:        discordgo.ApplicationCommandOptionString,
					Name:        "role",
					Description: "Role: narrator, artist, composer, editor, researcher, coder, reviewer, general",
					Required:    true,
				},
			},
		},
		{
			Name:        "whisper",
			Description: "Transcribe an audio file with Whisper",
			Options: []*discordgo.ApplicationCommandOption{
				{
					Type:        discordgo.ApplicationCommandOptionAttachment,
					Name:        "audio",
					Description: "Audio file to transcribe",
					Required:    true,
				},
			},
		},
	}

	for _, cmd := range commands {
		_, err := s.ApplicationCommandCreate(s.State.User.ID, guildID, cmd)
		if err != nil {
			log.Printf("Cannot create command %s: %v", cmd.Name, err)
		}
	}
}

func handleSlashCommand(s *discordgo.Session, i *discordgo.InteractionCreate) {
	switch i.ApplicationCommandData().Name {
	case "audiobook":
		handleAudiobookCommand(s, i)
	case "storyboard":
		handleStoryboardCommand(s, i)
	case "veo":
		handleVeoCommand(s, i)
	case "agents":
		handleAgentsStatus(s, i)
	case "assign":
		handleAssignAgent(s, i)
	case "whisper":
		handleWhisperSlash(s, i)
	}
}
