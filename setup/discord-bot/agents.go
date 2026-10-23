package main

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/bwmarrin/discordgo"
)

// AgentRole defines what an AI slot specializes in.
type AgentRole string

const (
	RoleNarrator   AgentRole = "narrator"   // TTS narration via Chirp
	RoleArtist     AgentRole = "artist"     // Image gen via Imagen
	RoleComposer   AgentRole = "composer"   // Music gen via Lyria
	RoleEditor     AgentRole = "editor"     // AV assembly via avtool
	RoleResearcher AgentRole = "researcher" // Research via Gemini
	RoleCoder      AgentRole = "coder"      // Code gen via Gemini
	RoleReviewer   AgentRole = "reviewer"   // Review/QA via Gemini
	RoleGeneral    AgentRole = "general"    // General assistant
)

// Agent is a single AI slot in the pool.
type Agent struct {
	Slot   int
	Role   AgentRole
	Busy   bool
	Ctx    context.Context
	Cancel context.CancelFunc
}

// AgentPool manages 8 AI agent slots + 1 human.
type AgentPool struct {
	mu     sync.RWMutex
	agents [8]*Agent
	config Config
}

// NewAgentPool creates a pool with 8 agents in default roles.
func NewAgentPool(cfg Config) *AgentPool {
	pool := &AgentPool{config: cfg}

	// Default role assignments
	defaults := [8]AgentRole{
		RoleNarrator,   // Slot 1 — audiobook narration
		RoleArtist,     // Slot 2 — storyboard imagery
		RoleComposer,   // Slot 3 — background music/score
		RoleEditor,     // Slot 4 — AV assembly
		RoleResearcher, // Slot 5 — story research
		RoleCoder,      // Slot 6 — pipeline automation
		RoleReviewer,   // Slot 7 — quality review
		RoleGeneral,    // Slot 8 — general tasks
	}

	for i := 0; i < 8; i++ {
		ctx, cancel := context.WithCancel(context.Background())
		pool.agents[i] = &Agent{
			Slot:   i + 1,
			Role:   defaults[i],
			Busy:   false,
			Ctx:    ctx,
			Cancel: cancel,
		}
	}
	return pool
}

func (p *AgentPool) Start() {
	log.Println("Agent pool started — 8 AI slots ready")
	for _, a := range p.agents {
		log.Printf("  Slot %d: %s", a.Slot, a.Role)
	}
}

func (p *AgentPool) Stop() {
	for _, a := range p.agents {
		a.Cancel()
	}
	log.Println("Agent pool stopped")
}

// Reassign changes an agent's role at runtime.
func (p *AgentPool) Reassign(slot int, role AgentRole) error {
	if slot < 1 || slot > 8 {
		return fmt.Errorf("slot must be 1-8, got %d", slot)
	}
	p.mu.Lock()
	defer p.mu.Unlock()

	a := p.agents[slot-1]
	if a.Busy {
		return fmt.Errorf("slot %d is busy — wait for current task to finish", slot)
	}
	a.Role = role
	log.Printf("Slot %d reassigned to %s", slot, role)
	return nil
}

// FindAvailable returns the first idle agent with the requested role.
func (p *AgentPool) FindAvailable(role AgentRole) *Agent {
	p.mu.RLock()
	defer p.mu.RUnlock()

	for _, a := range p.agents {
		if a.Role == role && !a.Busy {
			return a
		}
	}
	// Fallback: any idle agent
	for _, a := range p.agents {
		if !a.Busy {
			return a
		}
	}
	return nil
}

// StatusEmbed builds a Discord embed showing all 8 slots.
func (p *AgentPool) StatusEmbed() *discordgo.MessageEmbed {
	p.mu.RLock()
	defer p.mu.RUnlock()

	fields := make([]*discordgo.MessageEmbedField, 9)
	for i, a := range p.agents {
		status := "idle"
		if a.Busy {
			status = "BUSY"
		}
		fields[i] = &discordgo.MessageEmbedField{
			Name:   fmt.Sprintf("Slot %d", a.Slot),
			Value:  fmt.Sprintf("**%s** — %s", a.Role, status),
			Inline: true,
		}
	}
	// Slot 9 = human
	fields[8] = &discordgo.MessageEmbedField{
		Name:   "Human",
		Value:  "**operator** — always active",
		Inline: true,
	}

	return &discordgo.MessageEmbed{
		Title:       "Agent Pool — 8 AI + 1 Human",
		Description: "Firebase/Gemini API backend (no Vertex AI)",
		Color:       0x4285F4,
		Fields:      fields,
	}
}

// routeToAgent dispatches a message to the best available agent.
func routeToAgent(s *discordgo.Session, m *discordgo.MessageCreate) {
	// Simple keyword routing — extend as needed
	content := strings.ToLower(m.Content)

	var targetRole AgentRole
	switch {
	case strings.Contains(content, "narrate") || strings.Contains(content, "read aloud"):
		targetRole = RoleNarrator
	case strings.Contains(content, "draw") || strings.Contains(content, "image") || strings.Contains(content, "illustrate"):
		targetRole = RoleArtist
	case strings.Contains(content, "music") || strings.Contains(content, "score") || strings.Contains(content, "compose"):
		targetRole = RoleComposer
	case strings.Contains(content, "edit") || strings.Contains(content, "assemble") || strings.Contains(content, "render"):
		targetRole = RoleEditor
	case strings.Contains(content, "research") || strings.Contains(content, "find") || strings.Contains(content, "lookup"):
		targetRole = RoleResearcher
	case strings.Contains(content, "code") || strings.Contains(content, "build") || strings.Contains(content, "implement"):
		targetRole = RoleCoder
	case strings.Contains(content, "review") || strings.Contains(content, "check") || strings.Contains(content, "qa"):
		targetRole = RoleReviewer
	default:
		targetRole = RoleGeneral
	}

	// TODO: dispatch to Gemini API with role-specific system prompt
	s.ChannelMessageSend(m.ChannelID, fmt.Sprintf(
		"Routing to **%s** agent... (Gemini API / Firebase)", targetRole))
}

func handleAgentsStatus(s *discordgo.Session, i *discordgo.InteractionCreate) {
	// TODO: wire to global pool instance
	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Content: "Agent pool status — use /agents after pool is wired",
		},
	})
}

func handleAssignAgent(s *discordgo.Session, i *discordgo.InteractionCreate) {
	opts := i.ApplicationCommandData().Options
	slot := int(opts[0].IntValue())
	role := AgentRole(opts[1].StringValue())

	// TODO: wire to global pool instance
	s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Content: fmt.Sprintf("Reassigned slot %d to **%s**", slot, role),
		},
	})
}
