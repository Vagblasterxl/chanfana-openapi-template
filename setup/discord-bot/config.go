package main

import "os"

// Config holds all bot configuration — loaded from env vars.
// Uses Firebase/Gemini API keys, NOT Vertex AI PROJECT_ID.
type Config struct {
	// Discord
	BotToken       string
	GuildID        string
	WhisperChannel string
	MainChannel    string
	AudiobookCh    string
	StoryboardCh   string

	// Firebase / Gemini (NOT Vertex)
	GeminiAPIKey     string
	GeminiModel      string
	ImagenModel      string
	VeoModel         string
	ChirpModel       string
	LyriaModel       string
	FirebaseBucket   string
	FirebaseProject  string

	// Whisper
	WhisperModelSize string
	WhisperLanguage  string
	WhisperDevice    string

	// Local asset persistence
	LocalAssetDir string
}

func loadConfig() Config {
	return Config{
		// Discord
		BotToken:       envOr("DISCORD_BOT_TOKEN", ""),
		GuildID:        envOr("DISCORD_GUILD_ID", ""),
		WhisperChannel: envOr("DISCORD_WHISPER_CHANNEL_ID", ""),
		MainChannel:    envOr("DISCORD_MAIN_CHANNEL_ID", ""),
		AudiobookCh:    envOr("DISCORD_AUDIOBOOK_CHANNEL_ID", ""),
		StoryboardCh:   envOr("DISCORD_STORYBOARD_CHANNEL_ID", ""),

		// Firebase / Gemini — NOT Vertex AI
		GeminiAPIKey:    envOr("GEMINI_API_KEY", ""),
		GeminiModel:     envOr("GEMINI_MODEL", "gemini-2.5-flash"),
		ImagenModel:     envOr("IMAGEN_MODEL", "imagen-3.0-generate-001"),
		VeoModel:        envOr("VEO_MODEL", "veo-3.1"),
		ChirpModel:      envOr("CHIRP_MODEL", "chirp-3-hd"),
		LyriaModel:      envOr("LYRIA_MODEL", "lyria-2"),
		FirebaseBucket:  envOr("FIREBASE_STORAGE_BUCKET", ""),
		FirebaseProject: envOr("FIREBASE_PROJECT_ID", ""),

		// Whisper
		WhisperModelSize: envOr("WHISPER_MODEL_SIZE", "base"),
		WhisperLanguage:  envOr("WHISPER_LANGUAGE", "en"),
		WhisperDevice:    envOr("WHISPER_DEVICE", "cpu"),

		// Local persistence
		LocalAssetDir: envOr("LOCAL_ASSET_DIR", "./generated"),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
