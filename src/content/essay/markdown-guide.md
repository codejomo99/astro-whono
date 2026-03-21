---
title: "Markdown 작성 가이드"
description: "이 테마에서 지원하는 Markdown 서식을 한눈에 확인할 수 있는 가이드입니다."
date: 2026-01-15
tags: ["Markdown", "가이드"]
draft: false
archive: true
badge: "가이드"
---

이 글은 테마에서 지원하는 Markdown 서식을 확인하기 위한 가이드입니다.

## 텍스트 서식

일반 텍스트입니다. **굵은 글씨**, *기울임*, ***굵은 기울임***을 사용할 수 있습니다. ~~취소선~~으로 폐기된 내용을 표시할 수도 있습니다.

인라인 코드는 백틱으로 감쌉니다: `const hello = 'world'`

## 인용

> 좋은 디자인은 시간의 시험을 견딜 수 있어야 한다. 세월이 흘러도 고유한 매력과 실용성을 유지하는 것이 진정한 가치다.

여러 단락의 인용도 가능합니다:

> 첫 번째 단락입니다.
>
> 두 번째 단락으로, 여러 단락 효과를 보여줍니다.

## 목록

### 순서 없는 목록

- 첫 번째 항목
- 두 번째 항목
  - 중첩 항목 A
  - 중첩 항목 B
- 세 번째 항목

### 순서 있는 목록

1. 준비 작업
2. 의존성 설치
3. 프로젝트 실행
   1. 개발 모드
   2. 프로덕션 빌드

### 작업 목록

- [x] 디자인 완료
- [x] 메인 페이지 개발
- [ ] 문서 작성
- [ ] 배포

## 코드 블록

### JavaScript

```javascript
// 간단한 피보나치 함수
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
```

### CSS

```css
.card {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Shell

```bash
# 의존성 설치 후 개발 서버 시작
npm install
npm run dev

# 프로덕션 빌드
npm run build
```

## 표

| 기능 | 상태 | 설명 |
|------|:----:|------|
| 반응형 레이아웃 | ✅ | 모바일 완벽 대응 |
| 다크 모드 | ✅ | 지원 |
| 검색 | ✅ | 제목/태그 검색 지원 |
| 다국어 | ❌ | 예정 |

## 링크

[외부 링크 예시](https://astro.build)

## 구분선

위쪽 내용입니다.

---

아래쪽 내용입니다.

## 영문 단락

> The best way to predict the future is to invent it. — Alan Kay

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

---

이상으로 테마에서 지원하는 Markdown 서식을 정리했습니다. 렌더링 문제가 발견되면 Issue를 등록해주세요!
