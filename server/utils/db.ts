import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

const queryClient = postgres(process.env.DATABASE_URL ?? '', {
    prepare: false,
    // 기본값(10)을 그대로 두면 동접이 늘 때 채팅 저장/조회 같은 요청이 이 풀을 두고 줄을 서기
    // 시작함(부하테스트 실측에서 확인) — Postgres 자체는 이보다 훨씬 많은 동시 연결을 가볍게
    // 받아주니, 앱 프로세스 쪽 한도를 넉넉하게 올려둠. DATABASE_URL과 같은 방식으로 접두사 없이
    // 직접 읽는 환경변수라 배포 스펙에 맞게 조정 가능(안 주면 20)
    max: Number(process.env.DB_POOL_MAX) || 20,
})

export const db = drizzle(queryClient, { schema })
