---
title: "Astro 프레임워크 입문기"
description: "정적 사이트 생성기 Astro를 처음 사용해보며 느낀 점과 기본적인 사용법을 정리합니다."
date: 2026-03-15
tags: ["Astro", "웹개발"]
draft: false
badge: "개발"
---

최근 개인 블로그를 만들면서 Astro를 처음 사용해보았다. 결론부터 말하면 꽤 만족스럽다.

## Astro란

Astro는 콘텐츠 중심의 웹사이트를 만들기 위한 프레임워크다. 가장 큰 특징은 기본적으로 JavaScript를 전혀 보내지 않는다는 것이다. 블로그나 문서 사이트처럼 대부분의 콘텐츠가 정적인 경우에 특히 적합하다.

## 첫인상

프로젝트를 생성하고 개발 서버를 띄우기까지 5분도 걸리지 않았다.

```bash
npm create astro@latest my-blog
cd my-blog
npm run dev
```

파일 기반 라우팅이라 `src/pages/` 안에 `.astro` 파일을 만들면 바로 페이지가 된다. 직관적이다.

## 마음에 드는 점

**콘텐츠 컬렉션** 기능이 인상적이었다. Markdown 파일들을 타입 안전하게 관리할 수 있다.

```typescript
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});
```

스키마를 정의해두면 frontmatter에 오타가 있을 때 빌드 시점에 잡아준다. 런타임 에러가 아니라 빌드 에러로 잡히니까 안심이 된다.

**아일랜드 아키텍처**도 흥미롭다. 페이지 대부분은 정적 HTML로 보내고, 인터랙션이 필요한 부분만 선택적으로 JavaScript를 로드할 수 있다.

## 아쉬운 점

`.astro` 파일의 문법이 처음에는 좀 낯설다. JSX 같기도 하고 아닌 것 같기도 하다. 하지만 하루 정도 쓰면 금방 익숙해진다.

## 성능 비교

| 항목 | Astro | Next.js |
|------|-------|---------|
| 기본 번들 크기 | ~0 KB | ~70 KB |
| 빌드 방식 | 정적 우선 | SSR 우선 |
| 학습 곡선 | 낮음 | 보통 |

## 마무리

아직 깊이 있게 써보지는 못했지만, 블로그 같은 콘텐츠 사이트에는 최적의 도구인 것 같다. 당분간은 이 스택으로 계속 운영해볼 생각이다.
