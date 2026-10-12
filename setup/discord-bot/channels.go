package main

import (
	"fmt"
	"log"

	"github.com/bwmarrin/discordgo"
)

// Channel setup — creates the required channels if they don't exist.
// Whisper channel gets its own category for voice + text.

// EnsureChannels creates all required channels in the guild.
func EnsureChannels(s *discordgo.Session, guildID string) error {
	channels, err := s.GuildChannels(guildID)
	if err != nil {
		return fmt.Errorf("get guild channels: %w", err)
	}

	existing := make(map[string]bool)
	for _, ch := range channels {
		existing[ch.Name] = true
	}

	required := []struct {
		Name     string
		Type     discordgo.ChannelType
		Topic    string
		Category string
	}{
		// Main text channels
		{Name: "ai-agents", Type: discordgo.ChannelTypeGuildText,
			Topic: "8 AI slots + 1 human — route commands here"},
		{Name: "audiobook-output", Type: discordgo.ChannelTypeGuildText,
			Topic: "Generated audiobooks land here"},
		{Name: "storyboard-gallery", Type: discordgo.ChannelTypeGuildText,
			Topic: "Storyboard panels and imagery"},
		{Name: "veo-renders", Type: discordgo.ChannelTypeGuildText,
			Topic: "Veo 3.1 video renders"},

		// Whisper category
		{Name: "whisper-text", Type: discordgo.ChannelTypeGuildText,
			Topic: "Whisper transcriptions appear here", Category: "whisper"},
		{Name: "whisper-voice", Type: discordgo.ChannelTypeGuildVoice,
			Topic: "Join to auto-record for transcription", Category: "whisper"},
	}

	// Create whisper category first
	var whisperCatID string
	if !existing["whisper"] {
		cat, err := s.GuildChannelCreateComplex(guildID, discordgo.GuildChannelCreateData{
			Name: "whisper",
			Type: discordgo.ChannelTypeGuildCategory,
		})
		if err != nil {
			log.Printf("Failed to create whisper category: %v", err)
		} else {
			whisperCatID = cat.ID
			log.Printf("Created category: whisper (%s)", cat.ID)
		}
	} else {
		// Find existing category ID
		for _, ch := range channels {
			if ch.Name == "whisper" && ch.Type == discordgo.ChannelTypeGuildCategory {
				whisperCatID = ch.ID
				break
			}
		}
	}

	// Create channels
	for _, req := range required {
		if existing[req.Name] {
			log.Printf("Channel already exists: %s", req.Name)
			continue
		}

		data := discordgo.GuildChannelCreateData{
			Name:  req.Name,
			Type:  req.Type,
			Topic: req.Topic,
		}

		if req.Category == "whisper" && whisperCatID != "" {
			data.ParentID = whisperCatID
		}

		ch, err := s.GuildChannelCreateComplex(guildID, data)
		if err != nil {
			log.Printf("Failed to create channel %s: %v", req.Name, err)
			continue
		}
		log.Printf("Created channel: %s (%s)", ch.Name, ch.ID)
	}

	return nil
}
