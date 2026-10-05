#!/bin/sh
# The project's versions live in version/versions.json: "app" (the whole project) and one per
# deployable component. Semver MAJOR.MINOR.PATCH, optionally -test.N for test builds. Every bump of
# a component bumps "app" the same way. See CLAUDE.md's "Versions" section.
#
#   scripts/version.sh                                  show every version
#   scripts/version.sh <component> major|minor|patch    release bump (resets what's to its right)
#   scripts/version.sh <component> major|minor|patch --test
#                                                       next test build of that bump: 1.2.0 → minor
#                                                       --test → 1.3.0-test.1, again → 1.3.0-test.2
#   scripts/version.sh <component> release             1.3.0-test.5 → 1.3.0
#
# Never touches git: after committing, tag the commit yourself (the script prints the command).
set -eu

FILE="$(dirname "$0")/../version/versions.json"
COMPONENTS=$(sed -n 's/^ *"\([a-z-]*\)": *"[^"]*",\{0,1\}$/\1/p' "$FILE" | grep -v '^app$')

get() { sed -n "s/^ *\"$1\": *\"\([^\"]*\)\".*/\1/p" "$FILE"; }
set_version() { sed -i.bak "s/^\( *\"$1\": *\"\)[^\"]*\"/\1$2\"/" "$FILE" && rm -f "$FILE.bak"; }
die() { echo "$*" >&2; exit 1; }

# bump <version> <level> <test: 0|1> → new version
bump() {
  core=${1%%-*}; pre=""; [ "$core" != "$1" ] && pre=${1#*-}
  major=${core%%.*}; rest=${core#*.}; minor=${rest%%.*}; patch=${rest#*.}
  case "$2" in
    release)
      [ -n "$pre" ] || die "$1 isn't a test build — nothing to release"
      echo "$core"; return ;;
    major) target="$((major + 1)).0.0" ;;
    minor) target="$major.$((minor + 1)).0" ;;
    patch) target="$major.$minor.$((patch + 1))" ;;
    *) die "level must be major, minor, patch or release" ;;
  esac
  # Already a test build of a version: the next bump of the same level continues from it.
  if [ -n "$pre" ]; then
    case "$2" in
      major) [ "$minor.$patch" = "0.0" ] && target=$core ;;
      minor) [ "$patch" = "0" ] && target=$core ;;
      patch) target=$core ;;
    esac
  fi
  if [ "$3" = 1 ]; then
    n=1
    [ "$target" = "$core" ] && [ -n "$pre" ] && n=$((${pre#test.} + 1))
    target="$target-test.$n"
    [ "$n" -le 98 ] || die "more than 98 test builds of $target"
  fi
  t=${target%%-*}; tminor=${t#*.}; tminor=${tminor%%.*}; tpatch=${t##*.}
  [ "$tminor" -le 99 ] && [ "$tpatch" -le 99 ] || die "minor and patch must stay ≤ 99 (Android versionCode)"
  echo "$target"
}

if [ $# -eq 0 ]; then
  cat "$FILE"; exit 0
fi

component=$1; level=${2:-}; test=0
[ "${3:-}" = "--test" ] && test=1
echo "$COMPONENTS" | grep -qx "$component" || die "unknown component '$component' — one of: $(echo $COMPONENTS)"
[ -n "$level" ] || die "usage: scripts/version.sh <component> major|minor|patch [--test] | release"

old=$(get "$component"); new=$(bump "$old" "$level" "$test")
old_app=$(get app); new_app=$(bump "$old_app" "$level" "$test")
set_version "$component" "$new"
set_version app "$new_app"
echo "$component: $old → $new"
echo "app:       $old_app → $new_app"
echo "After committing: git tag v$new_app"
