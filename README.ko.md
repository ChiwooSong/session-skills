# session-skills

Claude Code(그리고 Codex)에 세션 간 기억을 주는 스킬 두 개입니다.

- **`/handoff`** — 대화를 끝내기 전에 실행합니다. 무엇을 왜 결정했는지, 무엇을 시도했다 버렸는지,
  다음에 할 단 하나의 행동을 최신순 가중치로 압축한 인수인계 노트를 씁니다.
- **`/restartproj`** — 다시 돌아왔을 때 실행합니다. git 이력, 커밋되지 않은 변경, 원격 상태,
  인수인계 노트를 읽어 현황을 브리핑하고 재개 지점을 제안합니다.

git 은 *무엇을* 커밋했는지 압니다. 노트는 대화만 알던 *왜* 와 *다음에 뭘* 을 보존합니다.

[![npm](https://img.shields.io/npm/v/@woody_s/session-skills)](https://www.npmjs.com/package/@woody_s/session-skills)
[![Verify](https://github.com/ChiwooSong/session-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/ChiwooSong/session-skills/actions/workflows/ci.yml)

English: [README.md](README.md)

## 설치

하나의 채널만 고르면 됩니다. 어느 채널이든 같은 `SKILL.md` 두 개를 놓을 뿐, 다른 것은 설치하거나
바꾸지 않습니다.

### npm (권장)

```sh
npx --yes @woody_s/session-skills@latest install
```

Claude Code 용으로 `~/.claude/skills/` 에 설치되어 모든 프로젝트에서 쓸 수 있습니다. Node.js 22
이상이 필요합니다.

| 옵션 | 효과 |
|---|---|
| `--agent claude\|codex\|all` | 설치 대상 호스트(기본 `claude`). Codex 는 `~/.agents/skills/` 를 씁니다. |
| `--scope project` 또는 `--project <dir>` | 홈 디렉터리 대신 `<dir>/.claude/skills/`(및 `.agents/skills/`)에 설치합니다. |
| `--force` | 내용이 다른 기존 설치를 교체합니다. 기존 파일은 먼저 `<agent root>/skills-backups/session-skills/<timestamp>/` 로 옮깁니다. |

`status` 는 설치 위치와 이 버전과의 일치 여부를 보여 줍니다. `uninstall` 은 정확히 일치하는 설치만
지우고, 수정된 설치는 `--force` 가 없으면 남겨 둡니다. 업데이트는 `status` 를 확인한 뒤
`install --force` 입니다.

### Claude Code 플러그인

```sh
claude plugin marketplace add ChiwooSong/session-skills
claude plugin install session-skills@session-skills
```

세션 안에서는 `/plugin marketplace add ChiwooSong/session-skills` 뒤에
`/plugin install session-skills@session-skills` 입니다. 플러그인 스킬은 네임스페이스가 붙어
`/session-skills:handoff`, `/session-skills:restartproj` 로 호출합니다. 새 버전은
`claude plugin update session-skills` 로 받습니다.

### skills CLI

```sh
npx skills add ChiwooSong/session-skills
```

현재 프로젝트에 설치합니다. 전역 설치는 `-g` 를 붙입니다.

### 수동

`skills/handoff` 와 `skills/restartproj` 를 `~/.claude/skills/`(Claude Code) 또는
`~/.agents/skills/`(Codex)에 복사하고 새 세션을 시작합니다.

## 사용

**세션 끝** — `/handoff`. 강조할 내용을 인자로 줄 수 있습니다.

```
/handoff API 명세서는 아직 안 왔음. 올 때까지 main.py 건드리지 말 것
```

Claude 가 `handoff.md` 를 쓰거나 갱신하고 "Resume here" 한 줄과 경로만 답합니다.

**세션 시작** — `/restartproj`. 최근 커밋 15개, 워킹 트리, 원격, 노트를 읽고 다섯 항목으로
브리핑합니다: 지난 작업, 워킹 트리, 원격, 노트 이후, 재개 지점. 플래그: `--no-pull`(pull 금지),
`--no-fetch`(네트워크 금지), 또는 다른 저장소 경로. "이어서 하자", "어디까지 했지" 같은 말에도
트리거됩니다.

### 노트가 저장되는 곳

1. Claude Code 가 세션에 알려 주는 프로젝트 메모리 디렉터리(`MEMORY.md` 가 있는 곳)의
   `handoff.md`. 머신마다 다르고 git 루트 기준이므로, 한 워크스페이스의 하위 프로젝트들은 노트
   하나를 공유합니다. 각 항목에 프로젝트 태그가 붙습니다.
2. 없으면 `<repo>/.claude/handoff.md`. 머신·팀원 간에 노트를 옮기려면 커밋하고, 아니면
   `.gitignore` 에 넣으세요.

프로젝트 `CLAUDE.md` 에 경로가 명시돼 있으면 그 경로가 우선합니다.

### 노트의 모양

```markdown
---
name: handoff
description: Session handoff notes for this project. Read first when resuming earlier work.
metadata:
  type: project
  updated: 2026-10-31
  project: mosigi
  branch: main
  head: 3f2a9c1
  dirty: clean
---

## Latest session (2026-10-31 · mosigi · main@3f2a9c1)

**Resume here:** `npm run test:emu` 실행(217 통과 기대) 후 executeAccountDeletion 커밋.
...

## Recent sessions

- (2026-10-20 · mosigi) ...        (최대 4개)

## Earlier history

한 단락. "Recent sessions" 에서 밀려날 때마다 다시 압축합니다.
```

최신일수록 비중이 큽니다. 실행할 때마다 직전 "Latest session" 은 2–3문장 bullet 로 강등되고,
가장 오래된 bullet 은 단락에 합쳐지며, 파일 전체는 약 900 단어 아래로 유지됩니다. 기록된 `head`
덕분에 `/restartproj` 는 노트 이후의 커밋을 나열하고 노트가 낡았는지 말해 줍니다. 섹션 제목은 두
스킬 사이의 계약이라 영어로 고정되고, 본문은 대화 언어를 따릅니다. 예전 한국어 제목 노트도 읽고
새 형식으로 다시 씁니다.

## 하지 않는 일

- `/restartproj` 는 commit, push, rebase, merge, stash, reset, 변경 폐기를 하지 않습니다. 유일한
  쓰기는 `git pull --ff-only` 이며, 트리가 깨끗하고, 브랜치가 뒤처져만 있고, 플래그나 프로젝트 규칙이
  막지 않고, 호스트 권한 프롬프트가 허용할 때만 실행합니다. 읽기 전용 git 명령은 `allowed-tools` 로
  사전 승인되지만 pull 은 아닙니다.
- `/handoff` 는 diff, 파일 내용, 커밋으로 이미 확정된 사실, 비밀 정보를 쓰지 않습니다. 파일 하나와,
  메모리 인덱스가 있을 때 `MEMORY.md` 의 포인터 한 줄만 씁니다.
- 설치기는 네트워크 요청과 스크립트 실행을 하지 않고, 수정된 설치를 지우지 않습니다.

## 개발

```sh
npm test               # 설치기·스킬 계약 테스트
npm run test:package   # tarball 생성 → 오프라인 설치 → CLI 실행
npm run validate:plugin
claude plugin eval . --allow-tools Read,Glob,Grep,Bash,Write,Edit --scaffold   # 실제 모델 실행, 과금됨
```

`evals/` 의 케이스는 셸 샌드박스 백엔드가 있는 플랫폼(Linux·macOS, Windows 에서는 실행기가 Bash
허용을 거부함)과 LLM 판정용 API 키가 필요합니다. 그것이 없으면 각 케이스의 `scaffold.sh` 로 만든
저장소에 같은 프롬프트를 직접 실행해 확인할 수 있습니다.

릴리스: `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` 의 버전을
올리고 `CHANGELOG.md` 항목을 추가한 뒤 `vX.Y.Z` 태그를 푸시합니다. 릴리스 워크플로가 trusted
publishing(provenance 포함)으로 npm 에 게시하고, 레지스트리 tarball 과 `SHA256SUMS` 로 GitHub
릴리스를 만듭니다.

보안: [SECURITY.md](SECURITY.md). 라이선스: MIT.
