#!/bin/zsh

set -u

repo_dir="/Users/miles/Desktop/ansa"
lock_dir="/tmp/ansa-auto-commit-push.lock"
log_file="/tmp/ansa-auto-commit-push.log"

if ! mkdir "$lock_dir" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$lock_dir"' EXIT

cd "$repo_dir" || exit 1
branch="$(git symbolic-ref --quiet --short HEAD)" || exit 1
git add --all || exit 1

if git diff --cached --quiet; then
  exit 0
fi

changed_files="$(git diff --cached --name-only | sed 's#^#- #' | head -12)"
file_count="$(git diff --cached --name-only | wc -l | tr -d ' ')"
if [ "$file_count" -gt 12 ]; then
  changed_files="$changed_files
- …and $((file_count - 12)) more file(s)"
fi

message="chore: checkpoint $file_count changed file(s)"
body="Automated 15-minute checkpoint on $branch.

$changed_files"

git commit -m "$message" -m "$body" >>"$log_file" 2>&1 || exit 1
git push origin "$branch" >>"$log_file" 2>&1
