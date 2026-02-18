#!/usr/bin/env bash
# Rebuild symlink indexes from .meta.yml sidecars
# Usage: ./rebuild-indexes.sh [media_root]

set -euo pipefail

MEDIA_ROOT="${1:-$(dirname "$(dirname "$(realpath "$0")")")/../media}"
INDEX_DIR="$MEDIA_ROOT/_index"

echo "Rebuilding indexes from: $MEDIA_ROOT"

# Clean existing indexes
rm -rf "$INDEX_DIR/by_status" "$INDEX_DIR/by_type" "$INDEX_DIR/by_tag"
mkdir -p "$INDEX_DIR/by_status"/{draft,review,approved,published,archived}
mkdir -p "$INDEX_DIR/by_type"/{video,image,music,speech,composition}
mkdir -p "$INDEX_DIR/by_tag"

# Find all .meta.yml files
find "$MEDIA_ROOT" -name "*.meta.yml" -not -path "*/_index/*" -not -path "*/.meta/*" | while read -r meta_file; do
    dir=$(dirname "$meta_file")
    # Asset filename is meta filename minus .meta.yml
    asset_file="${meta_file%.meta.yml}"
    asset_basename=$(basename "$asset_file")

    if [ ! -f "$asset_file" ]; then
        echo "  SKIP: $asset_basename (asset file missing)"
        continue
    fi

    # Extract fields from YAML (simple grep, no yq dependency)
    asset_id=$(grep -m1 '^\s*id:' "$meta_file" | sed 's/.*id:\s*"\?\([^"]*\)"\?/\1/' | tr -d ' ')
    status=$(grep -m1 '^\s*status:' "$meta_file" | sed 's/.*status:\s*"\?\([^"]*\)"\?/\1/' | tr -d ' ')
    asset_type=$(grep -m1 '^\s*type:' "$meta_file" | sed 's/.*type:\s*"\?\([^"]*\)"\?/\1/' | tr -d ' ')

    link_name="${asset_id:-$asset_basename}"

    # Symlink by status
    if [ -n "$status" ] && [ -d "$INDEX_DIR/by_status/$status" ]; then
        ln -sf "$asset_file" "$INDEX_DIR/by_status/$status/$link_name"
        echo "  STATUS: $link_name -> $status"
    fi

    # Symlink by type
    if [ -n "$asset_type" ] && [ -d "$INDEX_DIR/by_type/$asset_type" ]; then
        ln -sf "$asset_file" "$INDEX_DIR/by_type/$asset_type/$link_name"
        echo "  TYPE: $link_name -> $asset_type"
    fi

    # Symlink by tags
    tags_line=$(grep -A1 '^tags:' "$meta_file" | tail -1 || true)
    if [ -n "$tags_line" ]; then
        echo "$tags_line" | tr -d '[]"' | tr ',' '\n' | tr -d ' ' | while read -r tag; do
            if [ -n "$tag" ] && [ "$tag" != "-" ]; then
                tag_clean=$(echo "$tag" | tr -d '"' | sed 's/^- //')
                mkdir -p "$INDEX_DIR/by_tag/$tag_clean"
                ln -sf "$asset_file" "$INDEX_DIR/by_tag/$tag_clean/$link_name"
                echo "  TAG: $link_name -> $tag_clean"
            fi
        done
    fi
done

echo "Index rebuild complete."
