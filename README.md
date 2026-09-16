# Hyundacorp 생산현황 분석 (Production Analytics)

성형작업일보를 기준으로 **생산량 · 불량수량 · 가동률 · UPH · MTTR · 참고 MTBF**를  
공장 · 제품유형 · 설비 · 품번 · 작업자 · 금형 단위로 분석하는 웹 서비스입니다.

| 항목 | 내용 |
|---|---|
| 기준 문서 | `prd.md` V1.0, `화면설계서.md` V1.0 |
| 브랜딩 | Hyundai / Hyundacorp |
| 기준 타임존 | `Asia/Seoul` |
| 현재 상태 | **프론트엔드 UI + Mock 데이터 프로토타입** |

---

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열어주세요.

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
5. 대시보드 → 설비 상세 → 비가동 → 원본 DATA까지 추적
6. 목록 ↔ 상세 이동 시 조회기간 · 필터 · 검색 · 정렬 · 페이지 유지
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
- **xlsx** (의존성만 포함, 실제 파싱/다운로드 로직은 미연결)
- 상태: React Context + `sessionStorage` / `localStorage`

데이터는 서버 API가 아니라 `src/data/mock.ts` 목업을 사용합니다.

---

## 화면 · 라우트

| 화면 ID | 메뉴 | 라우트 | 구현 |
|---|---|---|---|
| DASH-01 | 대시보드 | `/` | ✅ |
| PROD-01 | 생산 분석 | `/production` | ✅ |
| UTIL-01 | 가동률 현황 | `/utilization` | ✅ |
| EQ-01 | 설비 분석 | `/equipment` | ✅ |
| EQ-02 | 설비 상세 | `/equipment/:equipmentId` | ✅ |
| DOWN-01 | 비가동 분석 | `/downtime` | ✅ |
| DOWN-02 | 비가동 이벤트 상세 | `/downtime/:eventId` | ✅ |
| PART-01 / PART-02 | 품번 분석 · 상세 | `/parts`, `/parts/:partId` | ✅ |
| OP-01 / OP-02 | 작업자 분석 · 상세 | `/operators`, `/operators/:operatorId` | ✅ |
| MOLD-01 / MOLD-02 | 금형 분석 · 상세 | `/molds`, `/molds/:moldId` | ✅ |
| CMP-01 | 스마트 비교 | `/compare` | ✅ |
| DATA-01 | 생산 DATA | `/production-data` | ✅ |
| ERR-01 | 데이터 오류 | `/data-errors` | ✅ |
| UP-01 | 데이터 업로드 | `/manage` | ⚠️ 데모 |
| UP-02 | 업로드 검증 결과 | `/manage/:batchId/result` | ⚠️ 데모 |

---

## 구현 현황

범례: ✅ 구현됨 · ⚠️ 부분/데모 · ❌ 미구현 · 🚫 V1 비범위(의도적 미노출)

### 1. 구현됨 ✅

#### 레이아웃 · UX
- Hyundacorp 브랜딩 sticky 헤더
- 반응형 pill 내비게이션 + `더보기` (폭에 따라 메뉴 이동)
- 라이트 / 다크 테마 (`production-analytics-color-theme`)
- 카드형 공장 · 제품유형 · 기간 필터
- 상세 조회조건 (설비 · 품번 · 작업자 · 금형 · 주야간 · 비가동 사유)
- `PageHeader`, KPI 카드, 데이터 품질 배너
- 검색 · 정렬 · 페이지 크기 · 숫자 페이지네이션
- Toast, EmptyState, BackBanner
- 데스크톱 중심 반응형 레이아웃

#### 분석 화면
- 대시보드 KPI 6종 + 추이 · GROMMET/SEAL 비교 · 비가동 도넛 · 설비 TOP/요약
- 생산 분석 (지표 토글, 일/주/월, 공장×제품유형 비교, 집계 표)
- 가동률 현황 (전체 종합 현황 게이지: GROMMET+SEAL / INJECTION+PRESS, 제품·설비유형 카드+미니 스파크라인, 시간/성능 탭, 목표 가동시간·판수 편집, 날짜×설비 히트맵, Excel)
- 설비 · 비가동 · 품번 · 작업자 · 금형 목록/상세 및 메뉴 간 링크
- 스마트 비교 (기간 / 설비 / 품번)
- 생산 DATA · 데이터 오류 목록 + 오류 원본 drawer

#### 지표 계산 (클라이언트 Mock)
- 생산량 = `SUM(실적수량)`
- 생산불량률 = 불량 / (생산+불량)
- 가동률 = 가동시간 합 / 작업시간 합
- 시간가동률(가동률 현황) = 유효 가동시간 합 / 목표 가동시간 합
- 성능가동률(가동률 현황) = 작업판수 합 / 목표 작업판수 합 (목표가 있는 셀만, SEAL INJECTION 목표 없음)
- 양품률(가동률 현황) = 실적수량 합 / (실적+불량) 합
- 종합설비효율(가동률 현황) = 시간가동률 × MIN(성능가동률, 100%) × 양품률
- UPH = 생산량 / 작업시간(분) × 60
- 고장 건수 = 정상 행 중 `설비이상` 토큰 포함 (복합 사유 포함)
- MTTR = `설비이상` 포함 행의 비가동시간 합 ÷ 건수 (복합이어도 포함, 수리시간은 전체 비가동시간)
- 복합 사유 발생 건수 = 토큰별 분리 집계 (예: 금형교체+설비이상 → 각 1건)
- 참고 MTBF = 유효 가동시간 / 고장 건수 / 60 (고장 0건은 `-`)
- 이전 기간 대비 (동일 일수 직전 구간)

#### 상태 유지
- 글로벌 필터: `production-analytics-filters` (sessionStorage)
- 목록 상태: `production-analytics-page:{screenKey}`
- 목표 가동시간: `production-analytics-target-minutes` (localStorage)
- 목표 작업판수: `production-analytics-target-shots-v2` (localStorage)
- 데이터 소스 모드: `production-analytics-data-source` (`demo` | `uploaded`, localStorage)
- 업로드 데이터셋: IndexedDB `production-analytics-db` / key `uploaded-dataset`
- 새 데이터셋 반영 시 필터/목록 초기화 훅 연결
- **엑셀 미업로드 시**: 가데이터(시드)만 표시
- **엑셀 업로드 시**: 클라이언트 파싱 후 IndexedDB에 저장. 새로고침·재접속해도 유지되며, **시드 데이터로 복원** 시에만 가데이터로 복귀

---

### 2. 부분 구현 / 데모 ⚠️

| 항목 | 현재 상태 | PRD · 화면설계서 기대 |
|---|---|---|
| Excel 다운로드 | 버튼 클릭 시 Toast만 표시 | 필터·검색 결과 전체 비동기 Excel 생성·다운로드 |
| 데이터 업로드 | Dropzone + 샘플 다운로드 + 시드 복원 + 요약 카드 | 서버 저장·배치 이력 API |
| 업로드 검증 | 클라이언트 xlsx 파싱·헤더 탐지·오류/경고 분류 후 즉시 반영 | 서버 검증·대용량 스트리밍 |
| 데이터셋 활성화 | IndexedDB 영속화 (복원 버튼 전까지 유지) | 트랜잭션 활성화, 집계 캐시 재생성 |
| 차트 드릴다운 | 일부 클릭 이동(사유→비가동, 설비→상세) | 선택 칩 표시/해제, 기간 클릭 시 필터 연동 등 전체 규칙 |
| 상세 복귀 | BackBanner로 목록 경로 복귀 | `returnPath` + 검색·정렬·페이지·**스크롤 위치** 완전 복원 |
| 공유 URL | 라우트·일부 쿼리 사용 | 공장·제품유형·기간·대상 ID를 URL 우선 적용 |
| 모바일 UX | 기본 반응형 | 카드형 목록, 핵심 4컬럼+행 확장, full-screen sheet |
| 접근성 | 기본 label / aria-label 일부 | 차트 스크린리더 표, focus trap, WCAG AA 전면 적용 |
| 종속 필터 | 옵션 목록 고정 | 상위 필터에 존재하는 값만 반환, 무효 선택 자동 해제+Toast |
| `xlsx` 패키지 | 업로드 파싱 · 샘플 엑셀 다운로드에 사용 | Excel export(화면별 다운로드)에도 연결 |

---

### 3. 미구현 ❌ (V1 PRD에 있으나 아직 없음)

#### 백엔드 · 데이터
- REST API (`/api/v1/...`) 전체
- DB 모델 (`upload_batch`, `production_record`, `data_quality_issue`, 차원 테이블)
- 일별 집계 뷰 · 서버 페이지네이션 · 요청 캐시
- 실제 파일 업로드 저장소 · 배치 이력 · 이전 배치 복원

#### 업로드 · 검증 엔진
- 상단 40행 헤더 자동 탐지
- 컬럼명 정규화 매핑
- 전체 오류 코드 검증 파이프라인 (중복키 포함)
- 경고 조건 처리 (`MISSING_END_TIME`, `DEFECT_GT_PRODUCTION` 등)
- 오류 행 Excel 다운로드 / 검증 취소 / 이탈 확인 모달(업로드 중)

#### 운영 · 권한 · 비기능
- 조회자 / 업로더 / 관리자 권한 분기 · 403 화면
- 작업자명 마스킹
- 감사 로그
- Excel/PDF 비동기 작업 완료 알림
- API P95 성능 목표에 맞춘 서버 최적화
- 활성 배치 기준 실시간 재집계

#### UX 세부
- 표 sticky left(작업일자·설비·품번 묶음) 완전 구현
- 정렬 중 skeleton / filtering progress bar
- 차트 “표로 보기” 전 화면 통일 (일부만 존재)
- 비교 조건 전체 초기화 확인 모달
- 기간 최대 조회 한도 초과 안내

---

### 4. V1 비범위 🚫 (문서상 의도적으로 숨김)

빈 카드나 “준비 중”으로도 노출하지 않습니다.

- 단가 · 생산금액 · GRADE · 1SHOT 중량 · 원재료 사용량/비용
- 생산계획 대비 달성률 · 표준 C/T · 목표 UPH
- 정확한 이벤트 간 MTBF · 계획·표준 C/T 기반의 완전한 산업표준 OEE  
  (UTIL-01의 목표 가동시간·목표 판수 기준 종합설비효율은 구현됨)
- 검사 DATA 결합 부적합률
- 설비 센서 실시간 모니터링
- AI 생산 챗봇

---

## 프로젝트 구조

```text
src/
├─ app/                    # 화면 라우트
│  ├─ page.tsx             # 대시보드
│  ├─ production/
│  ├─ utilization/
│  ├─ equipment/
│  ├─ downtime/
│  ├─ parts/
│  ├─ operators/
│  ├─ molds/
│  ├─ compare/
│  ├─ production-data/
│  ├─ data-errors/
│  └─ manage/
├─ components/
│  ├─ layout/              # Header, Providers
│  ├─ filters/             # 글로벌·상세 필터
│  ├─ charts/              # 추이·도넛·랭킹
│  ├─ utilization/         # 가동률 종합 게이지·카드
│  └─ ui/                  # KPI, 표 바, 배너 등
├─ context/                # Filter · Theme · Toast · DataSource
├─ data/mock.ts            # Mock 생산 데이터·배치
├─ hooks/usePageState.ts
├─ lib/                    # metrics · aggregates · utilization · dates · format · storage
└─ types/
```

---

## 참고 문서

- [`prd.md`](./prd.md) — 제품 요구사항, 계산식, API, 인수 기준
- [`화면설계서.md`](./화면설계서.md) — 화면별 UI/UX, 컴포넌트, 상태 저장 키

---

## 다음 우선순위 제안

PRD Sprint 순서에 맞춘 권장 순서입니다.

1. **Sprint 1** — 실제 업로드 · 헤더 탐지 · 검증 · 배치 활성화 · 데이터 모델
2. **Sprint 2** — API 연동으로 Mock 제거, Excel export, URL 공유 조건
3. **Sprint 3** — 상세 복귀/스크롤, 차트 드릴다운 칩, 모바일 카드형 목록 고도화
4. **Sprint 4** — 권한 · 감사 · 성능 · 접근성 마감

---

## 라이선스 · 메모

내부 프로토타입입니다. 화면의 숫자는 Mock 기준이며, 운영 데이터나 PRD 샘플 파일 수치와 1:1로 고정되어 있지 않을 수 있습니다.
