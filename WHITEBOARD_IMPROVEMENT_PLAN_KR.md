# 화이트보드 시스템 고도화 기술 명세서

본 문서는 기존 `화이트보드.md`의 분석 내용을 바탕으로, 화이트보드 시스템의 성능 및 안정성 문제를 해결하기 위한 구체적인 구현 계획을 기술합니다.

## 1. 개요 (Executive Summary)

현재 화이트보드 시스템은 프로토타입 단계에서는 정상 작동하나, 데이터 규모가 증가함에 따라 심각한 성능 저하와 데이터 무결성 문제가 발생할 수 있는 구조입니다. 본 고도화 작업은 이를 해결하기 위해 **DB 정규화, 네트워크 패킷 최적화, 렌더링 최적화**를 수행하여 서비스 가능한 수준의 안정성을 확보하는 것을 목표로 합니다.

## 2. 문제점 분석 (Problem Analysis)

### 2.1 Backend: 데이터 저장 구조의 비효율성 (O(N) 저장)
- **현상**: 획(Stroke)이 추가될 때마다 전체 JSON 데이터를 읽고, 파싱하고, 배열에 추가한 뒤 다시 저장하는 **Full Overwrite** 방식입니다.
- **문제**: 데이터 크기(N)에 비례하여 저장 시간이 선형적으로 증가(O(N))하며, 동시 저장 시 **Race Condition**으로 인해 마지막 저장이 이전 데이터를 덮어쓰는(Data Loss) 문제가 발생합니다.

### 2.2 Network: 과도한 이벤트 트래픽
- **현상**: 마우스 이동 이벤트(`pointermove`) 발생 시마다 즉시 소켓 메시지를 전송합니다.
- **문제**: 초당 수백 개의 불필요한 패킷이 발생하여 서버 및 클라이언트의 이벤트 처리 부하를 가중시킵니다.

### 2.3 Frontend: 메모리 및 렌더링 부하
- **현상**: 획마다 개별적인 PIXI `Graphics` 객체를 생성하여 유지합니다.
- **문제**: 객체 수가 수천~수만 개로 늘어나면 메모리 사용량이 급증하고 렌더링 프레임 드랍이 발생합니다.

---

## 3. 구현 계획 (Implementation Plan)

### Phase 1: 백엔드 정규화 (Backend Normalization)

데이터베이스 스키마를 변경하여 저장 성능을 O(1)로 개선하고 동시성 문제를 해결합니다.

#### 3.1 DB 스키마 변경
기존 `whiteboards` 테이블의 JSON 컬럼 대신, 개별 획을 저장하는 `whiteboard_strokes` 테이블을 신규 생성합니다.

```sql
CREATE TABLE whiteboard_strokes (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    meeting_id  BIGINT NOT NULL,
    user_id     BIGINT NOT NULL,      -- 작성자
    stroke_data JSON NOT NULL,        -- 좌표 배열
    layer       INT DEFAULT 0,        -- Z-index
    is_deleted  BOOLEAN DEFAULT FALSE,-- Undo/Redo 용 Soft Delete
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_meeting_created (meeting_id, created_at)
);
```

#### 3.2 Backend 로직 변경 (Go)
- **핸들러 (`whiteboard.go`)**:
  - `add`: `whiteboard_strokes` 테이블에 `INSERT` 수행 (O(1)).
  - `undo`: 해당 미팅의 나의(혹은 전체) 마지막 `is_deleted=false` 획을 찾아 `UPDATE set is_deleted=true`.
  - `redo`: 해당 미팅의 마지막 `is_deleted=true` 획을 찾아 `UPDATE set is_deleted=false`.
  - `clear`: 해당 미팅의 모든 획을 `is_deleted=true` 처리.
  - `get`: `meeting_id` 기준 `is_deleted=false`인 모든 획을 `created_at` 순으로 `SELECT`.

### Phase 2: 네트워크 최적화 (Network Optimization)

패킷 수를 줄이기 위해 이벤트를 모아서 보내는 배칭(Batching)을 도입합니다.

#### 3.3 프론트엔드 배칭 (Frontend Batching)
- **Buffer 도입**: `onPointerMove`에서 즉시 전송하지 않고 `pointBuffer` 배열에 좌표를 쌓습니다.
- **Interval 전송**: 50ms (초당 20회) 간격으로 버퍼에 데이터가 있다면 `draw_batch` 이벤트를 전송하고 버퍼를 비웁니다.
- **수신 처리**: `draw_batch` 이벤트 수신 시 루프를 돌며 포함된 모든 획 세그먼트를 그립니다.

### Phase 3: 프론트엔드 렌더링 최적화 (Rendering Optimization)

PIXI.js 객체 수를 관리 가능한 수준으로 유지합니다.

#### 3.4 비트맵 캐싱 (Bitmap Caching)
- **컨테이너 분리**: `drawingContainer`(그리는 중)와 `staticContainer`(완료된 획)로 분리합니다.
- **캐싱 전략**:
  - 획 그리기가 완료(`mouseup`)되면 `drawingContainer`의 내용을 `staticContainer`로 옮깁니다.
  - 주기적(혹은 획 개수 기준)으로 `staticContainer`를 하나의 텍스처(Bitmap)로 굽거나(Bake), `cacheAsBitmap` 기능을 활용하여 GPU 드로우 콜(Draw Call)을 1회로 줄입니다.

---

## 4. 검증 계획 (Verification Plan)

1. **데이터 저장 검증**: 화이트보드에 그림을 그린 후 DB `whiteboard_strokes` 테이블에 정상적으로 Row가 생성되는지 확인.
2. **새로고침 테스트**: 페이지 새로고침 시 이전에 그린 내용이 순서대로 완벽하게 복원되는지 확인.
3. **동시성 테스트**: 두 개의 브라우저 창(User A, User B)을 열고 동시에 그림을 그렸을 때 서로의 그림이 겹치거나 사라지지 않고 모두 저장되는지 확인.
4. **성능 모니터링**: 긴 시간 드로잉 후에도 프레임 드랍 없이 부드럽게 작동하는지 확인.
