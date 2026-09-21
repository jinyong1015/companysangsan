# Hyundaecorp 생산현황 분석 (Production Analytics)

성형작업일보를 기준으로 **생산량 · 불량수량 · 가동률 · UPH · MTTR · 참고 MTBF**를  
공장 · 제품유형 · 설비 · 품번 · 작업자 · 금형 단위로 분석하는 웹 서비스입니다.

| 항목 | 내용 |
|---|---|
| 기준 문서 | `prd.md` V1.5, `화면설계서.md` V1.5 |
| 브랜딩 | Hyundai / Hyundaecorp |
| 기준 타임존 | `Asia/Seoul` |
| 현재 상태 | **프론트엔드 UI + Mock/업로드 데이터 + 관리자 세션 API 프로토타입** |

---

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열어주세요.  
(개발 서버는 직접 실행하지 마시고, 위 명령으로 로컬에서 실행해 주세요.)

### 환경 변수 (`.env.local`)

| 변수 | 설명 |
|---|---|
| `ADMIN_PASSWORD_HASH` | 권장. `scrypt:…` 해시 (`npm run admin:hash`) |
| `ADMIN_PASSWORD` | 로컬 개발용 평문. 해시가 없을 때만 사용 |
| `ADMIN_SESSION_SECRET` | 세션 쿠키 HMAC 서명 비밀키 (배포 시 긴 임의 문자열) |

### 관리자 모드 · 설정

1. 우측 상단 **설정** → `화면 모드` / `관리자 모드` 탭
2. 관리자 비밀번호는 서버에서만 검증 (프런트 번들에 평문 없음)
3. 화면 모드 기본값: **라이트** (`localStorage` `production-analytics-color-theme`)
   - 다크: 깊은 검정 배경(`#08090c`) · 활성 칩 soft fill · 히트맵 갈·앰버 스케일
   - 설정 다크 옵션 문구: “깊은 검정 배경과 밝은 글자”
4. 관리자 세션: HttpOnly 쿠키 `pa_admin_session` · 유휴 30분 · 절대 8시간 · 탭 종료 시 삭제
5. 해시 생성:

```bash
npm run admin:hash -- "새비밀번호"
```

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run admin:hash` | 관리자 비밀번호 scrypt 해시 출력 |

---

## 서비스 목표 (PRD 요약)

1. 생산량 · 불량수량 · UPH를 동일한 정제 기준으로 제공
2. 작업시간 · 비가동시간으로 유효 가동시간 · 설비 가동률 제공
3. `설비이상` 이력으로 고장 건수 · MTTR · 참고 MTBF 제공
4. GROMMET / SEAL을 동일 화면 구조에서 분리 · 비교
5. 대시보드 → 가동률/비가동 → 품번·설비 상세 → 원본 DATA까지 추적
6. 목록 ↔ 상세 이동 시 조회기간(또는 조회월) · 필터 · 검색 · 정렬 · 페이지 유지
7. 오류 행을 정상 데이터와 분리하고 제외 사유를 확인
8. 일반 사용자는 조회 전용, **관리자 모드**에서만 생산 DATA 수정

### 분석 제외 규칙 (핵심)

아래 행은 생산량 · 불량수량을 포함한 **모든 분석에서 제외**됩니다.

- `작업시간 = 0`
- `실적수량 = 0`
- `비가동시간 > 작업시간`
- `작업시간 - 비가동시간 <= 0`
- 필수값 누락, 잘못된 자료형, 지원하지 않는 제품유형, 중복 등

---

## 기술 스택

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS 4**
- **Recharts** (차트)
- **lucide-react** (아이콘)
- **date-fns** (기간 계산)
- **xlsx** (업로드 파싱 · 샘플/화면 Excel 생성)
- 상태: React Context + `sessionStorage` / `localStorage` / IndexedDB
- 관리자: Next.js Route Handlers + HttpOnly 세션 쿠키 + 로컬 감사 로그(`data/admin-change-log.json`)

기본 데이터는 `src/data/mock.ts` 시드(가데이터)입니다. 엑셀 업로드 시 IndexedDB에 저장되어 새로고침 후에도 유지됩니다.

---

## 화면 · 라우트

주 메뉴 순서와 더보기 구성은 `화면설계서.md` V1.5 / `prd.md` V1.5와 동일합니다.

| 화면 ID | 메뉴 | 라우트 | 구현 |
|---|---|---|---|
| DASH-01 | 대시보드 | `/` | ✅ |
| PROD-01 | 생산 분석 | `/production` | ✅ |
| UTIL-01 | 가동률 분석 | `/utilization` | ✅ |
| DOWN-01 | 비가동 분석 | `/downtime` | ✅ |
| DOWN-02 | 비가동 이벤트 상세 | `/downtime/:eventId` | ✅ |
| PART-01 / PART-02 | 품번 분석 · 상세 | `/parts`, `/parts/:partId` | ✅ |
| EQ-01 / EQ-02 | 설비 분석 · 상세 | `/equipment`, `/equipment/:equipmentId` | ✅ |
| OP-01 / OP-02 | 작업자 분석 · 상세 | `/operators`, `/operators/:operatorId` | ✅ |
| MOLD-01 / MOLD-02 | 금형 분석 · 상세 (**더보기**) | `/molds`, `/molds/:moldId` | ✅ |
| DATA-01 | 생산 DATA (**더보기**) | `/production-data` | ✅ (수정은 관리자만) |
| ERR-01 | 오류 DATA (**더보기**) | `/data-errors` | ✅ |
| UP-01 | 데이터 업로드 | `/manage` | ⚠️ 클라이언트 데모 |
| UP-02 | 업로드 검증 결과 | `/manage/:batchId/result` | ⚠️ 클라이언트 데모 |

> `/compare`(스마트 비교)는 **제거**됨. KPI의 이전 기간 대비만 유지.

### 전역 필터 표시

| 경로 | 공장·제품유형 | 조회기간 |
|---|---|---|
| `/manage*` , `/downtime/:eventId` | 숨김 | 숨김 |
| `/utilization`, `/downtime` | 표시 | **숨김** (화면 내 조회월). 조회월은 전역 기간을 덮어쓰지 않음 |
| 그 외 | 표시 | 표시 |

가동률·비가동에서 설비·품번·생산 DATA로 이동할 때는 URL `startDate`/`endDate`로 기간을 전달하며, 전역 필터는 유지됩니다.

---

## 메뉴별 기능 요약

| 메뉴 | 할 수 있는 일 |
|---|---|
| 대시보드 | KPI 3종 · 종합 가동률 게이지 · 생산 추이(생산량·품목 종류·평균 SHOT·**비가동시간**) · SHOT TOP/WORST · 비가동 히트맵 · 비가동 TOP 품번 |
| 생산 분석 | SHOT TOP/WORST · 제품별 생산 종합 실적(검색·정렬·컬럼·전체화면·Excel) · 품번 상세 |
| 가동률 분석 | 조회월·설비유형 · 게이지/카드 · **평일·주말** 목표 편집 · 날짜×설비 히트맵 · 셀→설비/원본 DATA(기간 쿼리) |
| 비가동 분석 | 사유 상세 · 선택형 히트맵 · TOP 품번(순위/막대, 기간 쿼리) · 기간별·설비 신뢰성 · 이벤트 상세 |
| 품번 / 설비 / 작업자 | TOP·목록·상세 · 상호 링크 (`WorkPartSelect`에 제품유형 표시) |
| 금형 | 목록·상세(설비 사용 실적) |
| 생산 DATA | 원본 조회 · **관리자만** 행 수정·변경 이력 · URL `equipment`/`startDate`/`endDate` 지원 |
| 오류 DATA | 제외 행 · 오류코드 필터 · 원본 패널 |
| 데이터 업로드 | MES 성형작업일보 공지 · 엑셀 업로드·검증·반영 · 샘플 다운로드 · 시드 복원 |
| 설정 | 화면 모드(라이트/다크) · 관리자 로그인/로그아웃 |

---

## 구현 현황

범례: ✅ 구현됨 · ⚠️ 부분/데모 · ❌ 미구현 · 🚫 V1 비범위(의도적 미노출)

### 1. 구현됨 ✅

#### 레이아웃 · UX
- Hyundaecorp 브랜딩 sticky 헤더
- 반응형 pill 내비게이션 + `더보기` (작업자 우선 유지, 설비·품번·비가동 우선 이동)
- 우측 **설정** (화면 모드 · 관리자 모드). 헤더 직접 테마 토글은 설정으로 통합
- 라이트 / 다크 테마 (`production-analytics-color-theme`, 기본 라이트, ~200ms 전환)
  - 다크 팔레트: bg `#08090c` · card `#14161c` · elevated `#1b1e27` · accent `#8bb4ff`
  - 활성 내비·필터·페이지·설정 탭·primary: soft accent fill (밝은 solid 채우기 지양)
  - 비가동 히트맵 다크: 어두운 갈·앰버 스케일. 상세 링크 색은 유지
  - 조회조건·필터 카드·제품유형 탭·입력·Recharts 다크 보정
- 카드형 공장 · 제품유형 · 기간 필터 + DemoDataBanner(가데이터 시)
- 상세 조회조건 / QueryFilterShell(조회월)
- `PageHeader`, KPI 카드, Toast, EmptyState, BackBanner, `WorkPartSelect`

#### 분석 화면
- 대시보드 KPI 3종 + overall 게이지 + 추이(+비가동시간 탭) + TOP&WORST + 비가동 히트맵/TOP 품번
- 생산 분석 (TOP&WORST, 종합 실적 표)
- 가동률 분석 (게이지·카드·목표·히트맵)
- 비가동 분석 (사유 상세, 선택 히트맵, TOP 품번, 기간별·신뢰성, 이벤트)
- 설비 · 품번 · 작업자 · 금형 목록/상세
- 생산 DATA(관리자 행 수정·변경 이력) · 오류 DATA

#### 관리자 모드
- 설정 팝업 로그인 · 서버 scrypt(또는 개발용 `ADMIN_PASSWORD`) 검증
- HttpOnly 세션 쿠키 · 활동 시 갱신 · 세션 조회/로그아웃 API
- 생산 DATA 수정 시 서버 `PATCH` 권한 검증 + 수정 사유 필수
- 변경 이력 UI · `data/admin-change-log.json` 로컬 감사 로그 (최대 500건)

#### 지표 계산 (클라이언트)
- 생산량 = `SUM(실적수량)`
- 생산불량률 = 불량 / (생산+불량)
- 가동률 = 가동시간 합 / 작업시간 합
- 시간가동률 = 유효 가동시간 합 / 목표 가동시간 합  
  ※ 목표는 **평일·주말** × 주간 / 야간 / 주간+야간 (`연장` 없음)
- 성능가동률 = 작업판수 합 / 목표 작업판수 합 (목표 있는 셀만)  
  ※ 같은 날 설비에 GROMMET·SEAL이 섞여도 PRESS는 GROMMET 목표 우선 적용
- 양품률 = 실적수량 합 / (실적+불량) 합
- 종합설비효율 = 시간가동률 × MIN(성능가동률, 100%) × 양품률
- UPH(일반) = 생산량 / 작업시간(분) × 60  
  ※ 생산 종합 실적 표는 가동시간 기준 UPH — 화면설계서 참고
- 고장 건수 = 정상 행 중 `설비이상` 토큰 포함
- MTTR = 고장 후보(복합 사유 포함) 비가동시간 합 ÷ 건수  
  ※ 현재 구현은 고장 건수와 MTTR 대상이 동일. 단일 `설비이상`만 남기는 정책은 미적용
- 참고 MTBF (고장 0건은 `-`)
- 이전 기간 대비 (동일 일수 직전 구간)

#### 상태 유지
- 글로벌 필터: `production-analytics-filters` (sessionStorage)
- 목록 상태: `production-analytics-page:{screenKey}`
- 목표 가동시간: localStorage (`weekday`/`weekend` 스키마). 구버전 flat 값은 무시
- 목표 판수: localStorage `production-analytics-target-shots-v2`
- 가동률·비가동: `usePreserveGlobalPeriod`로 진입 전 전역 기간 복원
- 드릴다운 기간: URL `startDate`/`endDate` (설비·품번·생산 DATA)
- 데이터 소스: `demo` \| `uploaded` + IndexedDB 업로드 데이터셋
- 엑셀 미업로드 → 시드만 표시 / 업로드 → IndexedDB 유지 / 시드 복원 시에만 가데이터 복귀
- MES 파싱: 제품유형 `G`/`S`·`구분3`, 주야 전용 컬럼, `유압`→GROMMET

---

### 2. 부분 구현 / 데모 ⚠️

| 항목 | 현재 상태 | PRD · 화면설계서 기대 |
|---|---|---|
| 데이터 업로드 | 클라이언트 xlsx 파싱·검증·IndexedDB 즉시 반영 | 서버 저장·배치 이력 API |
| Excel | 화면별 클라이언트 `.xlsx` 생성 (범위는 버튼마다 상이) | 서버 비동기 export·알림 |
| 생산 DATA 수정 | 단건 모달 + 서버 권한·감사. 실제 값은 IndexedDB/메모리 | DB 영속·일괄 편집 UI·그리드 인라인 편집 |
| 변경 이력 | 로컬 JSON 파일 | DB·계정별 감사·접속정보 고도화 |
| 상세 복귀 | BackBanner + 목록 상태 | 스크롤 위치까지 완전 복원 |
| 공유 URL | 라우트·`from`·드릴다운 `startDate`/`endDate`·생산 DATA `equipment` | 공장·제품유형까지 URL 우선 동기화 |
| 모바일 UX | 기본 반응형 | 카드형 목록·full-screen sheet |
| 접근성 | label / aria-label 일부 | WCAG AA·차트 표 전면 |
| 종속 필터 | 옵션 목록 고정에 가깝음 | 상위 필터 존재 값만·무효 해제 Toast |

---

### 3. 미구현 ❌

- 분석 REST API · DB · 서버 페이지네이션 전체
- 업로더/조회자 역할 분리 · 작업자명 마스킹
- 생산 DATA 일괄 수정 UI · 셀 인라인 편집
- 스마트 비교 전용 화면/API (의도적 제거, 비범위)

---

### 4. V1 비범위 🚫

- 단가 · 생산금액 · GRADE · 1SHOT 중량 · 원재료
- 생산계획 대비 · 표준 C/T · 목표 UPH
- 정확한 이벤트 간 MTBF · 계획/표준 C/T 기반 완전 OEE  
  (UTIL-01 목표 기준 종합설비효율은 포함)
- 검사 DATA 결합 · 센서 실시간 · AI 챗봇
- **스마트 비교(`/compare`)**

---

## 프로젝트 구조

```text
src/
├─ app/
│  ├─ api/
│  │  ├─ admin/            # login · logout · session
│  │  └─ production-data/  # PATCH · bulk · changes
│  ├─ page.tsx             # 대시보드
│  ├─ production/
│  ├─ utilization/
│  ├─ downtime/
│  ├─ parts/
│  ├─ equipment/
│  ├─ operators/
│  ├─ molds/
│  ├─ production-data/
│  ├─ data-errors/
│  └─ manage/
├─ components/
│  ├─ admin/               # SettingsModal · ChangeHistoryModal
│  ├─ layout/              # Header, Providers
│  ├─ filters/ · charts/ · downtime/ · production/ · utilization/ · ui/
├─ context/                # Filter · Theme · Toast · DataSource · Admin
├─ data/mock.ts
├─ hooks/                  # usePageState · usePreserveGlobalPeriod
├─ lib/
│  ├─ admin/               # password · session · audit · clientUpdate
│  ├─ metrics · utilization · dimensions · downtime* · dates · excel · navigation …
└─ types/
scripts/
└─ hash-admin-password.mjs
data/                      # 로컬 감사 로그 (gitignore)
└─ admin-change-log.json
```

### 구현된 관리자 API

| Method | Path | 용도 |
|---|---|---|
| POST | `/api/admin/login` | 비밀번호 검증 · 세션 발급 |
| POST | `/api/admin/logout` | 세션 종료 |
| GET | `/api/admin/session` | 세션 유효 여부 |
| PATCH | `/api/production-data/:id` | 단건 수정 감사(관리자 필수) |
| PATCH | `/api/production-data/bulk` | 일괄 수정 감사(관리자 필수, UI 미연결) |
| GET | `/api/production-data/changes` | 변경 이력 조회(관리자 필수) |

---

## 참고 문서

- [`prd.md`](./prd.md) V1.5 — 제품 요구사항, 계산식, API, 인수 기준, 관리자 모드
- [`화면설계서.md`](./화면설계서.md) V1.5 — 메뉴별 UI/기능, 사용 매뉴얼, 상태 키

---

## 다음 우선순위 제안

1. **Sprint 1** — 서버 업로드 · 헤더 탐지 · 검증 · 배치 활성화 · 데이터 모델
2. **Sprint 2** — 분석 API 연동, Excel export 서버화, URL 공유 조건
3. **Sprint 3** — 상세 복귀/스크롤, 드릴다운 칩, 모바일 고도화
4. **Sprint 4** — 관리자 감사 DB화 · 일괄 편집 · 역할 분리 · 성능 · 접근성

---

## 라이선스 · 메모

내부 프로토타입입니다. 화면 숫자는 Mock/업로드 DATA 기준이며, 운영 데이터나 PRD 샘플 파일 수치와 1:1로 고정되어 있지 않을 수 있습니다.
