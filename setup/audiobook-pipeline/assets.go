package audiobook

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// AssetManager handles local file persistence for all generated assets.
// Assets save locally — you keep them when trial ends.
type AssetManager struct {
	BaseDir string
}

func NewAssetManager(baseDir string) *AssetManager {
	return &AssetManager{BaseDir: baseDir}
}

// CreateProject sets up the directory tree for a new audiobook project.
func (am *AssetManager) CreateProject(title string) string {
	name := sanitize(title)
	projectDir := filepath.Join(am.BaseDir, "audiobooks", name)

	dirs := []string{
		projectDir,
		filepath.Join(projectDir, "panels"),
		filepath.Join(projectDir, "narration"),
		filepath.Join(projectDir, "score"),
		filepath.Join(projectDir, "final"),
	}
	for _, d := range dirs {
		os.MkdirAll(d, 0755)
	}

	log.Printf("Project dir created: %s", projectDir)
	return projectDir
}

// SaveText writes text to a file in the project directory.
func (am *AssetManager) SaveText(projectDir, filename, content string) {
	path := filepath.Join(projectDir, filename)
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		log.Printf("Failed to save %s: %v", path, err)
	}
}

// SaveJSON writes a JSON file in the project directory.
func (am *AssetManager) SaveJSON(projectDir, filename string, data interface{}) {
	path := filepath.Join(projectDir, filename)
	b, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		log.Printf("Failed to marshal JSON for %s: %v", filename, err)
		return
	}
	if err := os.WriteFile(path, b, 0644); err != nil {
		log.Printf("Failed to save %s: %v", path, err)
	}
}

// CopyFile copies a file to the target path, creating dirs as needed.
func (am *AssetManager) CopyFile(src, dst string) {
	os.MkdirAll(filepath.Dir(dst), 0755)
	if err := copyFile(src, dst); err != nil {
		log.Printf("Failed to copy %s → %s: %v", src, dst, err)
	}
}

// ListAssets returns all files in a project directory.
func (am *AssetManager) ListAssets(projectDir string) []string {
	var assets []string
	filepath.Walk(projectDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		assets = append(assets, path)
		return nil
	})
	return assets
}

// sanitize makes a string safe for use as a directory name.
func sanitize(s string) string {
	s = strings.ToLower(s)
	s = regexp.MustCompile(`[^a-z0-9\-_]+`).ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "untitled"
	}
	return s
}
