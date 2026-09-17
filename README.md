# Hyundaecorp 생산현황 분석 (Production Analytics)

성형작업일보를 기준으로 **생산량 · 불량수량 · 가동률 · UPH · MTTR · 참고 MTBF**를  
공장 · 제품유형 · 설비 · 품번 · 작업자 · 금형 단위로 분석하는 웹 서비스입니다.

| 항목 | 내용 |
|---|---|
| 기준 문서 | `prd.md` V1.1, `화면설계서.md` V1.2 |
| 브랜딩 | Hyundai / Hyundaecorp |
| 기준 타임존 | `Asia/Seoul` |
| 현재 상태 | **프론트엔드 UI + Mock/업로드 데이터 프로토타입** |

---

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열어주세요.  
(개발 서버는 직접 실행하지 마시고, 위 명령으로 로컬에서 실행해 주세요.)

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |

---

## 서비스 목표 (PRD 요약)

1. 생산량 · 불량수량 · UPH를 동일한 정제 기준으로 제공
2. 작업시간 · 비가동시간으로 유효 가동시간 · 설비 가동률 제공
3. `설비이상` 이력으로 고장 건수 · MTTR · 참고 MTBF 제공
4. GROMMET / SEAL을 동일 화면 구조에서 분리 · 비교
5. 대시보드 → 가동률/비가동 → 품번·설비 상세 → 원본 DATA까지 추적
6. 목록 ↔ 상세 이동 시 조회기간(또는 조회월) · 필터 · 검색 · 정렬 · 페이지 유지
7. 오류 행을 정상 데이터와 분리하고 제외 사유를 확인

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

기본 데이터는 `src/data/mock.ts` 시드(가데이터)입니다. 엑셀 업로드 시 IndexedDB에 저장되어 새로고침 후에도 유지됩니다.

---

## 화면 · 라우트

주 메뉴 순서와 더보기 구성은 `화면설계서.md` V1.2 / `prd.md` V1.1과 동일합니다.

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
| DATA-01 | 생산 DATA (**더보기**) | `/production-data` | ✅ |
| ERR-01 | 오류 DATA (**더보기**) | `/data-errors` | ✅ |
| UP-01 | 데이터 업로드 | `/manage` | ⚠️ 클라이언트 데모 |
| UP-02 | 업로드 검증 결과 | `/manage/:batchId/result` | ⚠️ 클라이언트 데모 |

> `/compare`(스마트 비교)는 **제거**됨. KPI의 이전 기간 대비만 유지.

### 전역 필터 표시

| 경로 | 공장·제품유형 | 조회기간 |
|---|---|---|
| `/manage*` , `/downtime/:eventId` | 숨김 | 숨김 |
| `/utilization`, `/downtime` | 표시 | **숨김** (화면 내 조회월) |
| 그 외 | 표시 | 표시 |

---

## 메뉴별 기능 요약

| 메뉴 | 할 수 있는 일 |
|---|---|
| 대시보드 | KPI 3종 · 종합 가동률 게이지 · 생산 추이 · SHOT TOP/WORST · 비가동 히트맵 · 비가동 TOP 품번 |
| 생산 분석 | SHOT TOP/WORST · 제품별 생산 종합 실적(검색·정렬·컬럼·전체화면·Excel) · 품번 상세 |
| 가동률 분석 | 조회월·설비유형 · 게이지/카드 · 목표 편집 · 날짜×설비 히트맵 · 셀→설비/원본 DATA |
| 비가동 분석 | 사유 상세 · 선택형 히트맵 · TOP 품번 · 기간별·설비 신뢰성 · 이벤트 상세 |
| 품번 / 설비 / 작업자 | TOP·목록·상세 · 상호 링크 (`WorkPartSelect` on 설비·작업자 상세) |
| 금형 | 목록·상세(설비 사용 실적) |
| 생산 DATA | 원본 조회 · 행 수정 모달 |
| 오류 DATA | 제외 행 · 오류코드 필터 · 원본 패널 |
| 데이터 업로드 | 엑셀 업로드·검증·반영 · 샘플 다운로드 · 시드 복원 |

---

## 구현 현황

범례: ✅ 구현됨 · ⚠️ 부분/데모 · ❌ 미구현 · 🚫 V1 비범위(의도적 미노출)

### 1. 구현됨 ✅

#### 레이아웃 · UX
- Hyundaecorp 브랜딩 sticky 헤더
- 반응형 pill 내비게이션 + `더보기` (작업자 우선 유지, 설비·품번·비가동 우선 이동)
- 라이트 / 다크 테마 (`production-analytics-color-theme`)
- 카드형 공장 · 제품유형 · 기간 필터 + DemoDataBanner(가데이터 시)
- 상세 조회조건 / QueryFilterShell(조회월)
- `PageHeader`, KPI 카드, Toast, EmptyState, BackBanner, `WorkPartSelect`

#### 분석 화면
- 대시보드 KPI 3종 + overall 게이지 + 추이 + TOP&WORST + 비가동 히트맵/TOP 품번
- 생산 분석 (TOP&WORST, 종합 실적 표)
- 가동률 분석 (게이지·카드·목표·히트맵)
- 비가동 분석 (사유 상세, 선택 히트맵, TOP 품번, 기간별·신뢰성, 이벤트)
- 설비 · 품번 · 작업자 · 금형 목록/상세
- 생산 DATA(행 수정) · 오류 DATA

#### 지표 계산 (클라이언트)
- 생산량 = `SUM(실적수량)`
- 생산불량률 = 불량 / (생산+불량)
- 가동률 = 가동시간 합 / 작업시간 합
- 시간가동률 = 유효 가동시간 합 / 목표 가동시간 합
- 성능가동률 = 작업판수 합 / 목표 작업판수 합 (목표 있는 셀만)
- 양품률 = 실적수량 합 / (실적+불량) 합
- 종합설비효율 = 시간가동률 × MIN(성능가동률, 100%) × 양품률
- UPH(일반) = 생산량 / 작업시간(분) × 60  
  ※ 생산 종합 실적 표는 가동시간 기준 UPH — 화면설계서 참고
- 고장 건수 = 정상 행 중 `설비이상` 토큰 포함
- MTTR · 참고 MTBF (고장 0건은 `-`)
- 이전 기간 대비 (동일 일수 직전 구간)

#### 상태 유지
- 글로벌 필터: `production-analytics-filters` (sessionStorage)
- 목록 상태: `production-analytics-page:{screenKey}`
- 목표 가동시간 / 목표 판수: localStorage
- 데이터 소스: `demo` \| `uploaded` + IndexedDB 업로드 데이터셋
- 엑셀 미업로드 → 시드만 표시 / 업로드 → IndexedDB 유지 / 시드 복원 시에만 가데이터 복귀

---

### 2. 부분 구현 / 데모 ⚠️

| 항목 | 현재 상태 | PRD · 화면설계서 기대 |
|---|---|---|
| 데이터 업로드 | 클라이언트 xlsx 파싱·검증·IndexedDB 즉시 반영 | 서버 저장·배치 이력 API |
| Excel | 화면별 클라이언트 `.xlsx` 생성 (범위는 버튼마다 상이) | 서버 비동기 export·알림 |
| 상세 복귀 | BackBanner + 목록 상태 | 스크롤 위치까지 완전 복원 |
| 공유 URL | 라우트·일부 쿼리 | 공장·제품유형·기간 URL 우선 |
| 모바일 UX | 기본 반응형 | 카드형 목록·full-screen sheet |
| 접근성 | label / aria-label 일부 | WCAG AA·차트 표 전면 |
| 종속 필터 | 옵션 목록 고정에 가깝음 | 상위 필터 존재 값만·무효 해제 Toast |

---

### 3. 미구현 ❌

- REST API · DB · 서버 페이지네이션 전체
- 권한(조회자/업로더/관리자) · 감사 로그 · 작업자명 마스킹
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
├─ app/                    # 화면 라우트
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
│  ├─ layout/              # Header, Providers
│  ├─ filters/             # 글로벌·상세·조회조건
│  ├─ charts/
│  ├─ downtime/            # 히트맵·사유상세·TOP 품번
│  ├─ production/          # TOP&WORST·종합실적
│  ├─ utilization/         # 가동률 게이지·카드
│  ├─ operators/ · ui/
├─ context/                # Filter · Theme · Toast · DataSource
├─ data/mock.ts
├─ hooks/
├─ lib/                    # metrics · utilization · downtime* · dates · excel
└─ types/
```

---

## 참고 문서

- [`prd.md`](./prd.md) V1.1 — 제품 요구사항, 계산식, API, 인수 기준
- [`화면설계서.md`](./화면설계서.md) V1.2 — 메뉴별 UI/기능, 사용 매뉴얼, 상태 키

---

## 다음 우선순위 제안

1. **Sprint 1** — 서버 업로드 · 헤더 탐지 · 검증 · 배치 활성화 · 데이터 모델
2. **Sprint 2** — API 연동, Excel export 서버화, URL 공유 조건
3. **Sprint 3** — 상세 복귀/스크롤, 드릴다운 칩, 모바일 고도화
4. **Sprint 4** — 권한 · 감사 · 성능 · 접근성

---

## 라이선스 · 메모

내부 프로토타입입니다. 화면 숫자는 Mock/업로드 DATA 기준이며, 운영 데이터나 PRD 샘플 파일 수치와 1:1로 고정되어 있지 않을 수 있습니다.
