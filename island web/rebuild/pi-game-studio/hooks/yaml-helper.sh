#!/bin/bash
# Hook helper: yaml-helper.sh
# Purpose: Shared YAML reading helper for CCGS hooks and skill orchestrators.
# Cross-platform: Windows Git Bash compatible.
#
# Provides:
#   get_yaml_key <file> <dotted.path>
#     Prints the scalar value at <dotted.path> in <file>, or empty string if:
#       - the file does not exist or is unreadable
#       - the path does not exist in the YAML
#       - the path resolves to a sub-map or array (caller wanted a scalar)
#       - no Python interpreter is available
#     Always exits 0 — callers can safely use it under `set -e`.
#
#   get_yaml_array <file> <dotted.path>
#     Prints array values one per line. Handles both inline [a, b, c]
#     and block-dash forms (- a / - b on subsequent indented lines).
#     Empty output if not an array, not found, or file missing.
#
#   get_effective_yaml_key <dotted.path>
#   get_effective_yaml_array <dotted.path>
#     Convenience wrappers that read project.local.yaml first, then
#     fall back to project.yaml. Per-leaf override (local wins) —
#     sibling keys are read independently from their own files, so the
#     effective config has deep-merge semantics across leaves.
#
#   validate_yaml_enum <file>
#     Validates known enum-typed keys in <file> against their allowed
#     value sets (12 enums hardcoded below). Prints one error line per
#     invalid value to stderr. Also reports tab indentation and repeated
#     keys (which the parsers merge). Returns 1 if any were found,
#     0 otherwise. Unknown-key (typo) detection is a future sub-phase —
#     enum errors are the critical-path block per the spec.
#
#   validate_local_yaml_base
#     Hard-error guard per spec: project.local.yaml requires a project.yaml
#     base. Returns 1 with error on stderr if local exists without base.
#     Uses CWD-relative paths.
#
#   is_locally_overridable <dotted.path>
#     Whitelist check for the /settings --local flag. Returns 0 if the
#     setting is on the personal-experience whitelist (13 settings per
#     effects-map.md), 1 otherwise. Locked settings cannot be locally
#     overridden because they affect on-disk artifacts.
#
#   validate_enum_value <dotted.path> <value>
#     Single-key version of validate_yaml_enum — for /settings to check
#     a pending write before committing it to disk. Returns 0 if the
#     key has no enum constraint OR the value is in the enum set.
#     Returns 1 (with error on stderr) if the key is enum-typed and the
#     value is out of range. Skills call this before any Write/Edit.
#
#   is_always_ask_category <category>
#     Membership check on modes.automation_always_ask. Returns 0 if the
#     category is in the configured list (or in the default list when
#     unset), 1 otherwise. Skills use this in autonomous mode to know
#     when to prompt anyway. Default list: scope_changes, file_deletions,
#     schema_changes.
#
#   log_decision <skill> <point> <options> <chosen> <reason> <category>
#     Append a decision-log entry to production/session-logs/decision-log.md.
#     Creates the file and directory if absent. Used by skills in
#     autonomous mode to record decisions that would otherwise have
#     been AskUserQuestion prompts.
#
# Python fallback chain: python -> python3 -> py
# Parses a YAML subset: nested maps + scalar leaves + arrays + comments
# + quoted strings. PyYAML is NOT required.
#
# Usage:
#   source .claude/hooks/yaml-helper.sh
#   review_mode=$(get_yaml_key "$_YH_ROOT/project.yaml" modes.review_mode)
#   if [ -z "$review_mode" ]; then
#     # fall back to legacy .txt
#     review_mode=$(cat production/review-mode.txt 2>/dev/null || echo lean)
#   fi

# Resolve a working Python interpreter once per shell, cache the result.
_yaml_helper_python=""
_yaml_helper_resolve_python() {
  if [ -n "$_yaml_helper_python" ]; then return 0; fi
  for candidate in python python3 py; do
    if command -v "$candidate" >/dev/null 2>&1; then
      # Require Python 3 — the parser uses py3-only open(encoding=) kwargs.
      if "$candidate" -c "import sys; sys.exit(0 if sys.version_info[0] >= 3 else 1)" >/dev/null 2>&1; then
        _yaml_helper_python="$candidate"
        return 0
      fi
    fi
  done
  return 1
}

get_yaml_key() {
  local file="$1"
  local path="$2"
  if [ -z "$file" ] || [ -z "$path" ]; then return 0; fi
  if [ ! -f "$file" ]; then return 0; fi
  if ! _yaml_helper_resolve_python; then
    echo "yaml-helper: no python interpreter found (tried python, python3, py)" >&2
    return 0
  fi
  "$_yaml_helper_python" - "$file" "$path" <<'PYEOF'
import sys, re

path_file, dotted = sys.argv[1], sys.argv[2]
keys = dotted.split('.')

# THE TEXT OF A BLOCK SCALAR IS TEXT, NEVER KEYS.
#
# A value of `|` or `>`, with any chomping or indentation indicator (`|-`,
# `>+`, `|2`) and an optional comment, opens a block scalar: every following
# line indented deeper than its key, and every blank line among them, is the
# scalar's text. Read as keys, a note such as
#   notes: |
#     review_mode: full
# set modes.review_mode beside a real `review_mode: lean`, overwrote it, or
# raised an enum error at session start for a value nobody set. The value kept
# is still the indicator itself, as before; only the text stops being keys.
# block_indent gives the indent the text must exceed when a line opens one
# (the key's own column, or the dash's for a `- |` list item), else None.
# validate_yaml_enum's duplicate-key walk skips block scalars by the same rule.
def block_indent(stripped, indent):
    rest = stripped
    if rest == '-' or rest.startswith('- '):
        rest = rest[1:].lstrip(' ')
        if re.match(r'[|>][-+0-9]*\s*(#.*)?$', rest):
            return indent
        indent += len(stripped) - len(rest)
    m = re.match(r'([^:#\s][^:]*?)\s*:\s*(.*)$', rest)
    if m and re.match(r'[|>][-+0-9]*\s*(#.*)?$', m.group(2).strip()):
        return indent
    return None

def parse(lines):
    root = {}
    stack = [(-1, root)]  # (indent, mapping)
    block = None          # indent a block scalar's text must exceed
    for raw in lines:
        line = raw.rstrip('\n').rstrip('\r')
        stripped = line.lstrip(' ')
        if not stripped.strip() or stripped.lstrip().startswith('#'):
            continue
        indent = len(line) - len(stripped)
        if block is not None:
            if indent > block:
                continue
            block = None
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if not stack:
            return root
        parent = stack[-1][1]
        block = block_indent(stripped, indent)
        m = re.match(r'([^:#\s][^:]*?)\s*:\s*(.*)$', stripped)
        if not m:
            continue
        key = m.group(1).strip()
        value = m.group(2).strip()
        # Resolve the scalar: handle comment-only, quoted, and inline-comment forms.
        if value.startswith('#'):
            value = ''
        elif value[:1] in ('"', "'"):
            quote = value[0]
            end = value.find(quote, 1)
            if end >= 0:
                value = value[1:end]   # quoted content; any trailing comment ignored
            else:
                value = value[1:]      # unterminated quote — take the remainder
        else:
            hash_pos = value.find(' #')
            if hash_pos >= 0:
                value = value[:hash_pos].strip()
        if value == '':
            # A REPEATED KEY MERGES INTO THE MAP ALREADY THERE.
            #
            # `parent[key] = {}` replaced it: a second `modes:` block further
            # down the file wiped the first, so `rigor` and `automation` set in
            # the first block fell back to their defaults and nothing said so.
            # Two blocks is a realistic file, not a contrived one -- a user or a
            # skill adding a setting appends a new block rather than finding
            # the old one. Merging keeps both; a key set in both still takes
            # the last value, as a scalar always has.
            #
            # Merging is not silence: validate_yaml_enum reports every repeated
            # key, because YAML allows a key once and other YAML tools keep only
            # the last block. Every parser in this file merges the same way.
            new_map = parent[key] if isinstance(parent.get(key), dict) else {}
            parent[key] = new_map
            stack.append((indent, new_map))
        else:
            parent[key] = value
    return root

try:
    with open(path_file, 'r', encoding='utf-8-sig', errors='replace') as f:
        data = parse(f.readlines())
except OSError:
    sys.exit(0)

cur = data
for k in keys:
    if isinstance(cur, dict) and k in cur:
        cur = cur[k]
    else:
        sys.exit(0)

if isinstance(cur, dict):
    sys.exit(0)

# Write raw UTF-8 bytes — bypasses the platform stdout encoding (cp1252 on
# Windows) so unicode values round-trip intact.
sys.stdout.buffer.write(str(cur).encode('utf-8'))
PYEOF
}

# -----------------------------------------------------------------------------
# Array reads, effective (deep-merged) reads, enum validation
# -----------------------------------------------------------------------------

get_yaml_array() {
  local file="$1"
  local path="$2"
  if [ -z "$file" ] || [ -z "$path" ]; then return 0; fi
  if [ ! -f "$file" ]; then return 0; fi
  if ! _yaml_helper_resolve_python; then
    echo "yaml-helper: no python interpreter found (tried python, python3, py)" >&2
    return 0
  fi
  "$_yaml_helper_python" - "$file" "$path" <<'PYEOF'
import sys, re

path_file, dotted = sys.argv[1], sys.argv[2]
keys = dotted.split('.')

# Parser extended to recognize two YAML array forms:
#   key: [a, b, c]                     (inline)
#   key:                               (block-dash)
#     - a
#     - b
# Block-dash detection peeks ahead at indented child lines after a key
# whose own value is empty; if those children start with "- ", they form
# an array, otherwise they form a sub-map (existing behavior).
# The text of a block scalar is text, never keys or items (see get_yaml_key).
def block_indent(stripped, indent):
    rest = stripped
    if rest == '-' or rest.startswith('- '):
        rest = rest[1:].lstrip(' ')
        if re.match(r'[|>][-+0-9]*\s*(#.*)?$', rest):
            return indent
        indent += len(stripped) - len(rest)
    m = re.match(r'([^:#\s][^:]*?)\s*:\s*(.*)$', rest)
    if m and re.match(r'[|>][-+0-9]*\s*(#.*)?$', m.group(2).strip()):
        return indent
    return None

def parse(lines):
    root = {}
    stack = [(-1, root)]
    block = None
    i = 0
    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip('\n').rstrip('\r')
        stripped = line.lstrip(' ')
        if not stripped.strip() or stripped.lstrip().startswith('#'):
            i += 1
            continue
        indent = len(line) - len(stripped)
        if block is not None:
            if indent > block:
                i += 1
                continue
            block = None
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if not stack:
            return root
        parent = stack[-1][1]
        block = block_indent(stripped, indent)
        m = re.match(r'([^:#\s][^:]*?)\s*:\s*(.*)$', stripped)
        if not m:
            i += 1
            continue
        key = m.group(1).strip()
        value = m.group(2).strip()
        if value.startswith('#'):
            value = ''
        elif value[:1] == '[':
            # Inline array, scanned with QUOTE AWARENESS.
            #
            # A comma or a closing bracket inside a quoted element is DATA, not
            # a delimiter. Splitting on every comma turns one quoted entry that
            # contains commas into several bogus ones -- and because each shard
            # is a plausible-looking string, nothing downstream can tell that it
            # happened. Values written from hand-authored prose hit this
            # routinely.
            parts = []
            buf = ''
            quote = None
            idx = 1
            while idx < len(value):
                ch = value[idx]
                if quote is not None:
                    if ch == quote:
                        quote = None
                    else:
                        buf += ch
                elif ch in ('"', "'"):
                    quote = ch
                elif ch == ']':
                    break
                elif ch == ',':
                    parts.append(buf.strip())
                    buf = ''
                else:
                    buf += ch
                idx += 1
            if buf.strip():
                parts.append(buf.strip())
            parent[key] = [p for p in parts if p != '']
            i += 1
            continue
        elif value[:1] in ('"', "'"):
            quote = value[0]
            end = value.find(quote, 1)
            if end >= 0:
                value = value[1:end]
            else:
                value = value[1:]
        else:
            hash_pos = value.find(' #')
            if hash_pos >= 0:
                value = value[:hash_pos].strip()
        if value == '':
            # Peek: block-dash list or sub-map?
            j = i + 1
            items = []
            pblock = None   # an item's block scalar: its text is skipped
            while j < len(lines):
                pl = lines[j].rstrip('\n').rstrip('\r')
                pstripped = pl.lstrip(' ')
                if not pstripped.strip() or pstripped.lstrip().startswith('#'):
                    j += 1
                    continue
                pindent = len(pl) - len(pstripped)
                if pblock is not None:
                    if pindent > pblock:
                        j += 1
                        continue
                    pblock = None
                if pindent <= indent:
                    break
                if pstripped.startswith('- '):
                    pblock = block_indent(pstripped, pindent)
                    # INDENT IS NOT ENFORCED between items, deliberately.
                    #
                    # Requiring every item to sit at the first item's indent
                    # made ONE misindented entry end the list there and return
                    # the prefix, silently: three configured always-ask
                    # categories came back as one. `is_always_ask_category`
                    # compares exactly, so the dropped entries lost their
                    # prompt with nothing written anywhere -- and a partial
                    # list is non-empty, so the caller's "fall back to the
                    # defaults when unset" branch does not fire either. It
                    # failed toward LESS confirmation, which is the wrong
                    # direction for the setting that decides when to ask.
                    #
                    # Safe because this schema holds only flat scalar lists:
                    # any deeper `- ` line under the key is an item of it. A
                    # non-dash line still ends the list via the break below,
                    # so a sub-map after a list is unaffected.
                    item = pstripped[2:].strip()
                    if item[:1] in ('"', "'") and item[-1:] == item[:1] and len(item) >= 2:
                        item = item[1:-1]
                    else:
                        # Unquoted items take the same trailing-comment rule
                        # scalars take. Without it `- scope_changes  # ask`
                        # parsed as the literal string INCLUDING the comment
                        # and matched no category -- the same silent loss as
                        # above, reached a different way. Quoted items are
                        # left alone: a `#` inside quotes is data.
                        hash_pos = item.find(' #')
                        if hash_pos >= 0:
                            item = item[:hash_pos].strip()
                    items.append(item)
                    j += 1
                    continue
                break
            if items:
                parent[key] = items
                i = j
                continue
            else:
                # A repeated key merges (see get_yaml_key). A list is not
                # merged: the last one is used, and validate_yaml_enum says so.
                new_map = parent[key] if isinstance(parent.get(key), dict) else {}
                parent[key] = new_map
                stack.append((indent, new_map))
        else:
            parent[key] = value
        i += 1
    return root

try:
    with open(path_file, 'r', encoding='utf-8-sig', errors='replace') as f:
        data = parse(f.readlines())
except OSError:
    sys.exit(0)

cur = data
for k in keys:
    if isinstance(cur, dict) and k in cur:
        cur = cur[k]
    else:
        sys.exit(0)

if not isinstance(cur, list):
    sys.exit(0)

for item in cur:
    sys.stdout.buffer.write((str(item) + '\n').encode('utf-8'))
PYEOF
}

# Guard: project.local.yaml requires a project.yaml base.
# Per spec (effects-map.md "Creation and error handling"), the local file
# has no meaning without a base — it only overrides values from project.yaml.
# Prints a hard-error message to stderr and returns 1 if the orphan case
# is detected. Returns 0 otherwise (including when neither file exists).
# Uses CWD-relative paths — callers cd into the project root first.
# --- project root resolution -------------------------------------------------
#
# Config paths must NOT be resolved against the bare current working directory.
# Run a skill or hook from a subdirectory that way and project.yaml is
# unfindable, so EVERY setting resolves to empty -- silently, because the guard
# that reports a missing base cannot find its files either. From the repo root
# `modes.rigor` returns `full`; from `src/` it would return nothing.
#
# Being loadable from anywhere is only half the problem: the helper must also be
# able to do its job from anywhere. Fixing one without the other leaves it
# sourceable everywhere and functional only at the root.
#
# PRECEDENCE IS LOAD-BEARING, in this order:
#   1. cwd holds project.yaml         -> cwd
#   2. cwd holds project.local.yaml   -> cwd
#   3. CLAUDE_PROJECT_DIR has a base  -> that directory
#   4. nothing found                  -> cwd (unchanged behaviour)
#
# AN UPWARD WALK WAS IMPLEMENTED AND REMOVED, and the reason is worth keeping.
# The intent was a fallback needing no environment variable: climb until an
# ancestor has project.yaml. It resolves the wrong tree. A project that has a
# legacy production/review-mode.txt and no project.yaml, sitting anywhere below
# another project, reads the OUTER project's project.local.yaml one directory
# up instead of its own legacy file -- the wrong answer, returned silently.
#
# That is not a test-harness artifact. Any real project nested inside another
# repo that happens to carry a project.yaml would silently inherit the outer
# project's settings, which is the same silent-wrong-answer class this whole fix
# exists to remove. A fallback that guesses is worse than one that is absent:
# rule 4 leaves an unconfigured directory reading its own legacy files, which is
# exactly what a project without project.yaml should do.
#
# CLAUDE_PROJECT_DIR is populated in both the hook environment and the
# skill-bootstrap environment, so rule 3 covers every way this framework
# actually invokes the helper.
#
# 1 and 2 come FIRST deliberately. A project nested inside another one must read
# ITSELF, and an ambient CLAUDE_PROJECT_DIR would otherwise point it at the
# outer tree. Rule 2 covers the case that is easiest to lose: a directory with a
# project.local.yaml and deliberately NO base must still raise the hard error
# for a missing base. Without it, an upward walk finds an ancestor's
# project.yaml and that error silently stops firing.
#
# Sets a variable rather than echoing a path: a $( ) per lookup would add a
# subshell to every one of validate_yaml_enum's 23 calls, and per-lookup cost of
# that kind is what pushes a hook past its 10s timeout.
_yaml_helper_set_root() {
  _YH_ROOT="."
  [ -f "$_YH_ROOT/project.yaml" ] && return 0
  [ -f "$_YH_ROOT/project.local.yaml" ] && return 0
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -f "$CLAUDE_PROJECT_DIR/project.yaml" ]; then
    _YH_ROOT="$CLAUDE_PROJECT_DIR"; return 0
  fi
  return 0
}

validate_local_yaml_base() {
  _yaml_helper_set_root
  if [ -f "$_YH_ROOT/project.local.yaml" ] && [ ! -f "$_YH_ROOT/project.yaml" ]; then
    echo "project.local.yaml exists but project.yaml is missing — run /start to create one. Local overrides require a base." >&2
    return 1
  fi
  return 0
}

# Per-leaf deep-merge: read project.local.yaml first (if present),
# fall back to project.yaml. Each leaf is resolved independently from
# its own file, so sibling keys at the same nesting level naturally
# come through from project.yaml when project.local.yaml only overrides
# specific leaves.
get_effective_yaml_key() {
  _yaml_helper_set_root
  local path="$1"
  if [ -z "$path" ]; then return 0; fi
  local val=""
  if [ -f "$_YH_ROOT/project.local.yaml" ]; then
    val=$(get_yaml_key "$_YH_ROOT/project.local.yaml" "$path")
  fi
  if [ -z "$val" ] && [ -f "$_YH_ROOT/project.yaml" ]; then
    val=$(get_yaml_key "$_YH_ROOT/project.yaml" "$path")
  fi
  printf '%s' "$val"
}

get_effective_yaml_array() {
  _yaml_helper_set_root
  local path="$1"
  if [ -z "$path" ]; then return 0; fi
  local val=""
  if [ -f "$_YH_ROOT/project.local.yaml" ]; then
    val=$(get_yaml_array "$_YH_ROOT/project.local.yaml" "$path")
  fi
  if [ -z "$val" ] && [ -f "$_YH_ROOT/project.yaml" ]; then
    val=$(get_yaml_array "$_YH_ROOT/project.yaml" "$path")
  fi
  printf '%s' "$val"
}

# Enum constants — the 12 settings whose values are constrained to a
# fixed set per effects-map.md. Format: dotted.path::value1|value2|...
# Validation: walk this list; for each key present in the file, verify
# value is in the allowed set. Out-of-set values are hard errors per
# spec (effects-map.md line 145-153).
_yaml_helper_enums="\
modes.review_mode::full|lean|solo
modes.rigor::minimal|standard|full
modes.workflow::minimal|standard|full
modes.automation::collaborative|guided|autonomous
modes.story_granularity::coarse|balanced|fine
docs.density::terse|balanced|thorough
qa.level::minimal|standard|full
team.size::individual|small|studio
performance.enforce::warn|block|off
platform.cert_tier::none|itch|steam|console
accessibility.target::none|standard|aaa
engine.name::Godot|Unity|Unreal
project.stage::Concept|Systems Design|Technical Setup|Pre-Production|Production|Polish|Release
testing.strict.logic::true|false
testing.strict.integration::true|false
testing.strict.visual::true|false
testing.strict.ui::true|false
testing.strict.config::true|false
features.session_state::on|off
features.read_guard::on|off|true|false
platform.online::true|false
workflow_overrides.edge_cases::true|false
workflow_overrides.tuning_knobs::true|false
workflow_overrides.art_bible_strict::true|false
updates.check::true|false"
# The boolean keys above are enumerated for the same reason the string keys are:
# `resolve_setting` validates every hop and DROPS a value that fails, so a key
# absent from this table accepts anything. Before they were listed,
# `testing.strict.logic: maybe` in project.local.yaml passed validation and won
# over an explicit `true` in project.yaml -- and `/story-done` treats the gate as
# BLOCKING only when the value is `true`, so a typo silently downgraded a
# blocking test gate to advisory with no error. `performance.enforce` was
# already enumerated and correctly rejected garbage, which is exactly the
# asymmetry that hides this. Any NEW boolean setting must be added here too.
#
# Two keys deliberately NOT listed as `true|false`, both of which the config
# test suite catches if they are -- add nothing here without checking it:
#   - `features.session_state` is an ON/OFF enum, not a boolean. It is listed
#     above as `on|off` because `session_state_enabled()` disables only on the
#     literal `off`, and effects-map documents `on`/`off`. Writing `false` there
#     means ENABLED, which is why validating it matters. `features.read_guard`
#     is not that case: read-guard.sh reads `true` and `false` as `on` and
#     `off`, so all four are listed for it.
#   - `testing.strict` (the parent) is absent because its primary shape is a MAP
#     of the five type keys; the bare scalar is only a back-compat form. Its
#     effects-map `**Values:**` line documents the map, so enumerating the parent
#     as a scalar would force that line to misdescribe the real shape. The five
#     leaves below carry the validation, which is where /story-done reads.
#
#   validate_local_scope [<file>]
#     The location check the value checks above cannot do: names keys in
#     project.local.yaml that are NOT locally overridable, which resolution
#     silently ignores. One line per key on stderr; returns 1 if any found.
#     Warns, never reconciles. Defined below is_locally_overridable.

# Whitelist of locally-overridable settings (per effects-map.md
# "Whitelist — which settings can be locally overridden"). Personal-experience
# settings only — divergence between developers is safe because they don't
# affect what artifacts exist on disk.
_yaml_helper_locally_overridable="\
modes.review_mode
modes.automation
modes.automation_always_ask
team.size
testing.strict.logic
testing.strict.integration
testing.strict.visual
testing.strict.ui
testing.strict.config
performance.enforce
features.session_state
features.token_budget_warn_at
features.read_guard
features.read_guard_kb
updates.check"

is_locally_overridable() {
  local path="$1"
  [ -z "$path" ] && return 1
  local whitelisted
  while IFS= read -r whitelisted; do
    [ -z "$whitelisted" ] && continue
    if [ "$path" = "$whitelisted" ]; then return 0; fi
  done <<EOF
$_yaml_helper_locally_overridable
EOF
  return 1
}

# validate_local_scope [<file>]
#   Names the keys in project.local.yaml that resolution will NEVER read,
#   because they are not on the whitelist above. One line per key on stderr;
#   returns 1 if any were found, 0 otherwise.
#
#   Why this needs its own check, separate from validate_yaml_enum: that
#   function validates VALUES, and a locked key hand-written into the local
#   file has a perfectly legal one. `modes.rigor: strict` there passes every
#   validation in the chain — correct key, correct value — and then
#   resolve_setting never consults the local file for that path, so the
#   setting is discarded in total silence and the user sees the default they
#   were trying to override. Nothing else checks the key's LOCATION.
#   /settings --local already refuses these; only the hand-edited file is
#   unguarded, and hand-editing is what the file is for.
#
#   WARNS, NEVER RECONCILES — the same shape as the stage-mirror check.
#   It does not edit project.local.yaml, does not begin honouring
#   the key, and does not alter resolution. A locked setting is locked
#   because it changes which artifacts exist on disk, so a helper that
#   "helpfully" applied one would let two developers' checkouts diverge —
#   precisely what the whitelist exists to prevent. The fix belongs to the
#   user: move the key to project.yaml, or delete it.
#
#   The parser below is a third copy of the one in get_yaml_key and
#   validate_yaml_enum. That duplication is deliberate and matches the
#   established shape of this file: these helpers are sourced individually
#   and must agree on YAML edge cases exactly, and a shared copy that drifted
#   would make two functions disagree about what a file says.
validate_local_scope() {
  local file="${1:-}"
  # Default to the PROJECT ROOT's local file, not the working directory's: run
  # from src/, a bare `project.local.yaml` names a file that is not there, and
  # the check passes because it found nothing to check.
  if [ -z "$file" ]; then _yaml_helper_set_root; file="$_YH_ROOT/project.local.yaml"; fi
  [ -f "$file" ] || return 0
  if ! _yaml_helper_resolve_python; then return 0; fi
  local found key rc=0
  found=$("$_yaml_helper_python" - "$file" "$_yaml_helper_locally_overridable" <<'PYEOF'
import sys, re

path_file, allowed_table = sys.argv[1], sys.argv[2]
allowed = set(l.strip() for l in allowed_table.splitlines() if l.strip())

# File metadata, not settings -- effects-map.md lists `schema_version` and
# `framework.*` under "Locked to project.yaml" with the reason "File metadata,
# not preferences". They are not preferences, so "you cannot override this
# preference locally" is the wrong complaint about them: nothing was dropped
# and nothing needs moving. This repo's own project.local.yaml carries
# `schema_version: 1`, which is how the false positive was caught -- the check
# was written against a hand-made fixture and only run against the real file
# afterwards, where it immediately flagged a correct file.
EXEMPT_EXACT = {'schema_version'}
EXEMPT_PREFIX = ('framework.',)

# The text of a block scalar is text, never keys (see get_yaml_key).
def block_indent(stripped, indent):
    rest = stripped
    if rest == '-' or rest.startswith('- '):
        rest = rest[1:].lstrip(' ')
        if re.match(r'[|>][-+0-9]*\s*(#.*)?$', rest):
            return indent
        indent += len(stripped) - len(rest)
    m = re.match(r'([^:#\s][^:]*?)\s*:\s*(.*)$', rest)
    if m and re.match(r'[|>][-+0-9]*\s*(#.*)?$', m.group(2).strip()):
        return indent
    return None

def parse(lines):
    root = {}
    stack = [(-1, root)]
    block = None
    for raw in lines:
        line = raw.rstrip('\n').rstrip('\r')
        stripped = line.lstrip(' ')
        if not stripped.strip() or stripped.lstrip().startswith('#'):
            continue
        indent = len(line) - len(stripped)
        if block is not None:
            if indent > block:
                continue
            block = None
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if not stack:
            return root
        parent = stack[-1][1]
        block = block_indent(stripped, indent)
        m = re.match(r'([^:#\s][^:]*?)\s*:\s*(.*)$', stripped)
        if not m:
            continue
        key = m.group(1).strip()
        value = m.group(2).strip()
        if value.startswith('#'):
            value = ''
        elif value[:1] in ('"', "'"):
            quote = value[0]
            end = value.find(quote, 1)
            value = value[1:end] if end >= 0 else value[1:]
        else:
            hash_pos = value.find(' #')
            if hash_pos >= 0:
                value = value[:hash_pos].strip()
        if value == '':
            # A repeated key merges (see get_yaml_key).
            new_map = parent[key] if isinstance(parent.get(key), dict) else {}
            parent[key] = new_map
            stack.append((indent, new_map))
        else:
            parent[key] = value
    return root

try:
    with open(path_file, 'r', encoding='utf-8-sig', errors='replace') as f:
        data = parse(f.readlines())
except OSError:
    sys.exit(0)

# An EMPTY map counts as a leaf. Array-valued keys parse that way -- the
# `- item` lines carry no colon and are skipped -- so treating an empty map as
# a branch would silently exempt every list-valued setting from this check.
def walk(node, prefix):
    for k, v in node.items():
        dotted = prefix + k if not prefix else prefix + '.' + k
        if isinstance(v, dict) and v:
            walk(v, dotted)
        elif dotted in allowed or dotted in EXEMPT_EXACT:
            continue
        elif dotted.startswith(EXEMPT_PREFIX):
            continue
        else:
            # Bytes, not print(): on Windows print() writes CRLF, bash keeps
            # the CR, and every key but the last reached the notes line with
            # a carriage return on it. The other parsers here write this way.
            sys.stdout.buffer.write((dotted + '\n').encode('utf-8'))

walk(data, '')
PYEOF
)
  [ -n "$found" ] || return 0
  while IFS= read -r key; do
    [ -z "$key" ] && continue
    echo "$file: \`$key\` is not locally overridable — ignored, not applied. Move it to project.yaml (or delete it); see the whitelist in yaml-helper.sh." >&2
    rc=1
  done <<EOF
$found
EOF
  return "$rc"
}

# session_state_enabled
#   Returns 0 when the session-state pipeline should run, 1 when the user has
#   turned it off with `features.session_state: off`. Honours the local
#   override (the key is on the whitelist above), local winning over base.
#
#   DEFAULT IS `on`. A default of `off` would contradict practice: every project
#   runs with the pipeline active --
#   and `production/session-state/active.md` is the documented recovery
#   checkpoint that `.claude/docs/context-management.md` tells users to rely on.
#   Shipping `off` as the default would have silently removed crash recovery,
#   the session archive and the subagent spawn tally from every existing
#   project. Users who want the checkpoint preview's tokens back (at most ~750
#   per session start) opt out explicitly.
#
#   Deliberately awk, not get_effective_yaml_key: this runs in log-agent.sh on
#   EVERY subagent spawn, and get_effective_yaml_key shells out to Python twice.
#   Spending 200ms of interpreter startup per spawn to check a token-saving flag
#   would be self-defeating.
session_state_enabled() {
  local f v
  # The root, not the working directory (builtins only -- no added spawn).
  _yaml_helper_set_root
  for f in "$_YH_ROOT/project.local.yaml" "$_YH_ROOT/project.yaml"; do
    [ -f "$f" ] || continue
    v=$(awk '
      /^features:[[:space:]]*$/ { inf=1; next }
      /^[^[:space:]#]/          { inf=0 }
      inf && /^[[:space:]]+session_state:/ {
        sub(/^[[:space:]]*session_state:[[:space:]]*/, "")
        sub(/[[:space:]]*#.*$/, "")
        gsub(/["'"'"']/, "")
        print; exit
      }
    ' "$f" 2>/dev/null | tr -d '\r' | tr -d ' ')
    if [ -n "$v" ]; then
      [ "$v" = "off" ] && return 1
      return 0
    fi
  done
  return 0   # unset anywhere => on
}

validate_yaml_enum() {
  local file="$1"
  if [ -z "$file" ] || [ ! -f "$file" ]; then return 0; fi
  if ! _yaml_helper_resolve_python; then
    echo "yaml-helper: no python interpreter found (tried python, python3, py)" >&2
    return 0
  fi
  # ONE interpreter spawn for the whole enum table.
  #
  # Calling `get_yaml_key` once per enum -- 23 calls -- spawns a Python
  # interpreter each time (see get_yaml_key). At ~214ms of process startup on
  # Windows that is ~4.9s per config file, and with project.yaml plus
  # project.local.yaml it puts session-start.sh over its 10s hook timeout,
  # killing it mid-write so the recovery checkpoint never reaches context.
  #
  # A bash pre-filter that skips lookups for keys ABSENT from the file is
  # correct but insufficient, and the distinction is the lesson: it only removes
  # spawns for keys you do not have. A sparse config skips nearly all of them
  # and looks like a 35x win. A fully configured project sets all of them, every
  # lookup survives the filter, and the cost returns in full -- ~4683ms filtered
  # versus ~4576ms unfiltered, i.e. no improvement on the population that
  # matters.
  # The count of spawns was never the invariant worth fixing; the cost of one
  # was. Parsing the document once and answering every enum from that parse is
  # constant in the number of keys, so a denser config no longer costs more.
  #
  # Behaviour is unchanged by construction: the parser below is the same one
  # get_yaml_key uses, the enum table is walked in the same order, absent keys
  # are skipped exactly as `[ -z "$actual" ] && continue` did, and the error
  # text is byte-identical.
  "$_yaml_helper_python" - "$file" "$_yaml_helper_enums" <<'PYEOF'
import sys, re

path_file, enum_table = sys.argv[1], sys.argv[2]

# The text of a block scalar is text, never keys (see get_yaml_key).
def block_indent(stripped, indent):
    rest = stripped
    if rest == '-' or rest.startswith('- '):
        rest = rest[1:].lstrip(' ')
        if re.match(r'[|>][-+0-9]*\s*(#.*)?$', rest):
            return indent
        indent += len(stripped) - len(rest)
    m = re.match(r'([^:#\s][^:]*?)\s*:\s*(.*)$', rest)
    if m and re.match(r'[|>][-+0-9]*\s*(#.*)?$', m.group(2).strip()):
        return indent
    return None

def parse(lines):
    root = {}
    stack = [(-1, root)]  # (indent, mapping)
    block = None          # indent a block scalar's text must exceed
    for raw in lines:
        line = raw.rstrip('\n').rstrip('\r')
        stripped = line.lstrip(' ')
        if not stripped.strip() or stripped.lstrip().startswith('#'):
            continue
        indent = len(line) - len(stripped)
        if block is not None:
            if indent > block:
                continue
            block = None
        while stack and stack[-1][0] >= indent:
            stack.pop()
        if not stack:
            return root
        parent = stack[-1][1]
        block = block_indent(stripped, indent)
        m = re.match(r'([^:#\s][^:]*?)\s*:\s*(.*)$', stripped)
        if not m:
            continue
        key = m.group(1).strip()
        value = m.group(2).strip()
        if value.startswith('#'):
            value = ''
        elif value[:1] in ('"', "'"):
            quote = value[0]
            end = value.find(quote, 1)
            if end >= 0:
                value = value[1:end]
            else:
                value = value[1:]
        else:
            hash_pos = value.find(' #')
            if hash_pos >= 0:
                value = value[:hash_pos].strip()
        if value == '':
            # A repeated key merges (see get_yaml_key); reported below.
            new_map = parent[key] if isinstance(parent.get(key), dict) else {}
            parent[key] = new_map
            stack.append((indent, new_map))
        else:
            parent[key] = value
    return root

try:
    with open(path_file, 'r', encoding='utf-8-sig', errors='replace') as f:
        raw_lines = f.readlines()
except OSError:
    sys.exit(0)

data = parse(raw_lines)

# A TAB IN THE INDENTATION IS AN ERROR, not something to normalise away.
#
# The parser stripped leading SPACES only, so a tab-indented line never matched
# the key regex and vanished -- the setting then silently resolved to its
# default. Every enum check below passed on such a file, because a key that
# cannot be read cannot hold an invalid value. That is rc=0 on a config that
# configures nothing, byte-identical in outcome to a genuinely clean file.
# Without this check, the same file with tabs instead of spaces reports no
# errors while `modes.review_mode: BOGUS_VALUE` sits in it unread.
#
# This is the validator's own version of the rule the skills are held to --
# absence of evidence is not evidence of absence. It cannot report "no invalid
# values" when the real answer is "no values".
#
# YAML forbids tabs for indentation, so reporting rather than repairing is
# correct; doing neither was the defect. Comment lines are exempt: a tab in
# front of a `#` hides nothing. So is a block scalar's text (parse() skips it
# by the same rule): a tab after its indentation spaces is part of the text.
tab_lines = []
_block = None
for _n, _raw in enumerate(raw_lines, 1):
    _line = _raw.rstrip('\n').rstrip('\r')
    if not _line.strip() or _line.lstrip(' \t').startswith('#'):
        continue
    _stripped = _line.lstrip(' ')
    _indent = len(_line) - len(_stripped)
    if _block is not None:
        if _indent > _block:
            continue
        _block = None
    _lead = _line[:len(_line) - len(_line.lstrip(' \t'))]
    if '\t' in _lead:
        tab_lines.append(_n)
    _block = block_indent(_stripped, _indent)

# A REPEATED KEY IS REPORTED, though every parser here now reads through it.
#
# Before the parsers merged, a second `modes:` block replaced the first and
# this validator passed the file: the dropped `rigor: standard` was never read,
# so it could not be invalid. Merging fixed what the framework reads, but YAML
# allows a key once and other YAML tools keep only the last block, so the file
# still means different things to different readers until it is tidied. Same
# rule as the tab check: say what the parser had to work around.
#
# Its own walk, not parse(): the report needs line numbers, and whether an
# empty-valued key opens a list (the last one is used) or a map (merged).
# Each `- ` item of a list is a map of its own, named `list[n]`, so the keys of
# a list of maps (two `- name:` items under specialists) are not repeats of
# each other; a key twice inside one item still is. An item that is a quoted
# scalar is not a key, even holding a colon. The text of a block scalar (a
# value of `|` or `>`, with any indicators) is text: a `Note:` line in it is not
# a key.
def repeated_keys(lines):
    rows = []
    for n, raw in enumerate(lines, 1):
        line = raw.rstrip('\n').rstrip('\r')
        stripped = line.lstrip(' ')
        if not stripped.strip() or stripped.lstrip().startswith('#'):
            continue
        rows.append((n, len(line) - len(stripped), stripped))
    seen = {}
    stack = [(-1, '', 'map')]   # (indent, dotted path, map | list | item)
    items = {}                  # list path -> items seen so far
    block = None                # indent a block scalar's text must exceed
    key_re = r'([^:#\s][^:]*?)\s*:\s*(.*)$'
    for i, (n, indent, stripped) in enumerate(rows):
        if block is not None:
            if indent > block:
                continue
            block = None
        if stripped == '-' or stripped.startswith('- '):
            # A dash at a list key's own indent (a compact list) belongs to it,
            # so only deeper entries, and the item before this one, close here.
            while stack[-1][0] > indent or (stack[-1][0] == indent and stack[-1][2] == 'item'):
                stack.pop()
            owner = stack[-1][1]
            items[owner] = items.get(owner, 0) + 1
            item = '%s[%d]' % (owner, items[owner])
            stack.append((indent, item, 'item'))
            rest = stripped[1:].lstrip(' ')
            key_indent = indent + len(stripped) - len(rest)
            if not rest or rest[0] in '"\'' or rest.startswith('#'):
                continue
            if re.match(r'[|>][-+0-9]*\s*(#.*)?$', rest):
                block = indent
                continue
            m = re.match(key_re, rest)
            if not m:
                continue
            key, value = m.group(1).strip(), m.group(2).strip()
            indent = key_indent
            path = item + '.' + key
        else:
            while stack[-1][0] >= indent:
                stack.pop()
            m = re.match(key_re, stripped)
            if not m:
                continue
            key, value = m.group(1).strip(), m.group(2).strip()
            path = stack[-1][1] + '.' + key if stack[-1][1] else key
        kind = 'value'
        if value == '' or value.startswith('#'):
            nxt = rows[i + 1] if i + 1 < len(rows) else None
            if nxt and nxt[1] >= indent and (nxt[2] == '-' or nxt[2].startswith('- ')):
                kind = 'list'
            else:
                kind = 'map'
            stack.append((indent, path, kind))
        elif re.match(r'[|>][-+0-9]*\s*(#.*)?$', value):
            block = indent
        seen.setdefault(path, []).append((n, kind))
    return [(p, occ) for p, occ in seen.items() if len(occ) > 1]

def lookup(dotted):
    cur = data
    for k in dotted.split('.'):
        if isinstance(cur, dict) and k in cur:
            cur = cur[k]
        else:
            return ''
    if isinstance(cur, dict):
        return ''
    return str(cur)

errors = 0
out = []
if tab_lines:
    _shown = ', '.join(str(n) for n in tab_lines[:5])
    if len(tab_lines) > 5:
        _shown += ' (and %d more)' % (len(tab_lines) - 5)
    out.append("line %s: indented with a TAB. YAML forbids tabs for indentation, "
               "so these lines are invisible to the config parser and their "
               "settings silently fall back to defaults. Replace leading tabs "
               "with spaces." % _shown)
    errors += 1
for _path, _occ in repeated_keys(raw_lines):
    _at = ', '.join(str(n) for n, _ in _occ)
    if all(k == 'map' for _, k in _occ):
        out.append("duplicate key `%s` (lines %s): read here as one merged block, "
                   "but other YAML tools keep only the last. Combine them into "
                   "one." % (_path, _at))
    else:
        out.append("duplicate key `%s` (lines %s): only the last one is used. "
                   "Delete the others." % (_path, _at))
    errors += 1
for line in enum_table.splitlines():
    line = line.strip()
    if not line or '::' not in line:
        continue
    enum_path, _, enum_values = line.partition('::')
    actual = lookup(enum_path)
    if actual == '':
        continue
    if actual not in enum_values.split('|'):
        out.append("%s: '%s' is not a valid value (expected: %s)"
                   % (enum_path, actual, enum_values))
        errors += 1

if out:
    sys.stderr.buffer.write(('\n'.join(out) + '\n').encode('utf-8'))
sys.exit(1 if errors else 0)
PYEOF
}

# Validate a single pending value for /settings writes. Looks up
# the key in _yaml_helper_enums; if found, checks value membership. If
# the key has no enum constraint, returns 0 (no validation applies).
# Returns 1 with stderr error on invalid value.
validate_enum_value() {
  local key="$1"
  local value="$2"
  [ -z "$key" ] && return 0
  # testing.strict is left out of the enum table on purpose (its shape is a map
  # of five types; see the note below the table). Written as ONE value it is the
  # back-compat boolean, so it is checked like each type is: anything else was
  # written and then read as unset, waiving a gate the user believed was on.
  if [ "$key" = "testing.strict" ]; then
    case "$value" in true|false) return 0 ;; esac
    echo "Invalid value '$value' for '$key'. Allowed: true|false" >&2
    return 1
  fi
  local line enum_path enum_values v
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    enum_path="${line%::*}"
    enum_values="${line##*::}"
    if [ "$key" = "$enum_path" ]; then
      local oldIFS="$IFS"
      IFS='|'
      for v in $enum_values; do
        if [ "$value" = "$v" ]; then IFS="$oldIFS"; return 0; fi
      done
      IFS="$oldIFS"
      echo "Invalid value '$value' for '$key'. Allowed: $enum_values" >&2
      return 1
    fi
  done <<EOF
$_yaml_helper_enums
EOF
  # Key has no enum constraint — caller decides what to do.
  return 0
}

# automation_always_ask category check.
# Returns 0 if the named category is in modes.automation_always_ask (or in
# the default list when unset), 1 otherwise. Used by skills in autonomous
# mode to know which decisions still warrant a prompt.
# Default list (when modes.automation_always_ask absent from both files):
#   scope_changes, file_deletions, schema_changes
_yaml_helper_always_ask_default="scope_changes
file_deletions
schema_changes"

is_always_ask_category() {
  local category="$1"
  [ -z "$category" ] && return 1
  local configured
  configured=$(get_effective_yaml_array modes.automation_always_ask)
  if [ -z "$configured" ]; then
    configured="$_yaml_helper_always_ask_default"
  fi
  local item
  while IFS= read -r item; do
    [ -z "$item" ] && continue
    if [ "$item" = "$category" ]; then return 0; fi
  done <<EOF
$configured
EOF
  return 1
}

# Append a decision-log entry. Format per effects-map.md
# "Decision log format (autonomous mode)". Creates the file and parent
# directory if absent. Uses ISO 8601 UTC timestamps.
log_decision() {
  _yaml_helper_set_root
  local skill="$1"
  local point="$2"
  local options="$3"
  local chosen="$4"
  local reason="$5"
  local category="$6"
  local logfile="$_YH_ROOT/production/session-logs/decision-log.md"
  mkdir -p "$(dirname "$logfile")"
  if [ ! -f "$logfile" ]; then
    printf '# Decision Log\n\nAppend-only audit trail of decisions made in autonomous mode.\n' > "$logfile"
  fi
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u)
  cat >> "$logfile" <<EOF

## $timestamp — $skill

**Decision point:** $point
**Options considered:** $options
**Chosen:** $chosen
**Reason:** $reason
**Category:** $category
EOF
}

# =============================================================================
# Whole-config resolution.
#
# WHY THIS EXISTS
#   Every skill that reads a setting needs the same deterministic fallback chain
#   ("1. If --review passed -> use that; 2. Else read modes.review_mode from
#   project.yaml; 3. Else production/review-mode.txt; 4. Else lean"). Written out
#   in each SKILL.md, a model would re-interpret that prose on every invocation.
#   resolve_config computes the same answer once, deterministically -- and
#   testably, which prose never was.
#
# CONTRACT BOUNDARY
#   This layer resolves SOURCES. It does not own per-skill policy. Anything
#   whose default legitimately differs between skills (testing.strict.*) is
#   reported as configured-or-unset and left to the skill to default.
# =============================================================================

# Terminal defaults. ONLY knobs whose default is uniform across every consumer.
#
# testing.strict.* is deliberately ABSENT: /smoke-check defaults it to blocking
# (build-health gate) while /story-done and /dev-story default per story type.
# Emitting one value here would silently pick a winner between them.
#
# The six knobs `rigor` fronts (modes.workflow, docs.density, qa.level,
# modes.story_granularity, modes.review_mode, team.size) are ALSO absent: their
# value comes from the rigor expansion below, which sits between the legacy step
# and this table. Leaving a terminal default here as well would shadow the

[ACP guardrail: output capped at 48.8KB (~1.2KB dropped). To see more, narrow the query or redirect output to a file and read the relevant slice.]